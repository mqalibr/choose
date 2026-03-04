import { createBrowser } from "./core/browser";
import { logger } from "./core/logger";
import { RateLimiter } from "./core/rateLimiter";
import { withRetry } from "./core/retry";
import type { ScrapeResult, StoreScraper } from "./core/types";
import { upsertNormalizedItems } from "./core/upsert";
import { normalizeItems } from "./normalize";

interface RunnerOptions {
  stores: StoreScraper[];
  maxConcurrency: number;
  maxItemsPerStore?: number;
}

const DEFAULT_SCRAPER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

function isDryRun(): boolean {
  return String(process.env.SCRAPER_DRY_RUN ?? "").toLowerCase() === "true";
}

async function runStore(store: StoreScraper, browser: Awaited<ReturnType<typeof createBrowser>>, maxItems?: number) {
  const errors: string[] = [];
  const runStartedAt = new Date().toISOString();
  try {
    const pageFactory = async () => {
      const page = await browser.newPage({
        userAgent: process.env.SCRAPER_USER_AGENT ?? DEFAULT_SCRAPER_USER_AGENT,
        locale: "en-US",
        timezoneId: "Asia/Baku"
      });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined
        });
      });
      page.setDefaultTimeout(Number(process.env.SCRAPER_TIMEOUT_MS ?? "45000"));
      return page;
    };

    const raw = await withRetry(() => store.scrape({ browser, pageFactory, maxItems }), {
      attempts: 2,
      onRetry: (error, attempt) => {
        logger.warn({ error, attempt, store: store.storeSlug }, "Retrying store scraper");
      }
    });

    const normalized = normalizeItems(raw);
    const dryRun = isDryRun();
    const { insertedPrices, changedPrices, deactivatedListings } = dryRun
      ? { insertedPrices: 0, changedPrices: 0, deactivatedListings: 0 }
      : await upsertNormalizedItems(normalized, {
          runStartedAt
        });

    if (dryRun) {
      logger.info(
        {
          store: store.storeSlug,
          preview: normalized.slice(0, 3).map((item) => ({
            title: item.canonicalName,
            priceAzn: item.priceAzn,
            url: item.productUrl
          }))
        },
        "Dry run active: DB writes skipped"
      );
    }

    const result: ScrapeResult = {
      storeSlug: store.storeSlug,
      totalFetched: raw.length,
      totalNormalized: normalized.length,
      insertedPrices,
      changedPrices,
      deactivatedListings,
      errors
    };
    return result;
  } catch (error) {
    errors.push((error as Error).message);
    return {
      storeSlug: store.storeSlug,
      totalFetched: 0,
      totalNormalized: 0,
      insertedPrices: 0,
      changedPrices: 0,
      deactivatedListings: 0,
      errors
    } as ScrapeResult;
  }
}

export async function runScrapers(options: RunnerOptions): Promise<ScrapeResult[]> {
  const browser = await createBrowser();
  const limiter = new RateLimiter(1_200);

  try {
    const results: ScrapeResult[] = [];
    const queue = [...options.stores];

    while (queue.length > 0) {
      const batch = queue.splice(0, options.maxConcurrency);
      const batchResults = await Promise.all(
        batch.map(async (store) => {
          await limiter.waitTurn();
          logger.info({ store: store.storeSlug }, "Scrape started");
          const result = await runStore(store, browser, options.maxItemsPerStore);
          logger.info({ result }, "Scrape finished");
          return result;
        })
      );
      results.push(...batchResults);
    }

    return results;
  } finally {
    await browser.close();
  }
}
