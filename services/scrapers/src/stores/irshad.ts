import type { Page } from "playwright";
import { logger } from "../core/logger";
import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

const STORE_SLUG = "irshad";

const DEFAULT_CATEGORY_URLS = [
  "https://irshad.az/az/telefon-ve-aksesuarlar/mobil-telefonlar",
  "https://irshad.az/az/notbuk-planset-ve-komputer-texnikasi/notbuklar",
  "https://irshad.az/az/tv-ve-audio/televizorlar",
  "https://irshad.az/az/notbuk-planset-ve-komputer-texnikasi/plansetler"
];

function toPositiveInt(input: string | undefined, fallback: number): number {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function sanitizeSpecText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[:]+$/, "")
    .trim();
}

function getCategoryUrls(): string[] {
  const raw = process.env.IRSHAD_CATEGORY_URLS;
  if (!raw?.trim()) return DEFAULT_CATEGORY_URLS;

  const urls = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return urls.length ? urls : DEFAULT_CATEGORY_URLS;
}

function inferCategorySlug(url: string): string | null {
  const value = url.toLowerCase();
  if (value.includes("mobil-telefon") || value.includes("smartfon")) return "telefonlar";
  if (value.includes("notbuk")) return "noutbuklar";
  if (value.includes("televizor") || value.includes("/tv-")) return "televizorlar";
  if (value.includes("planset") || value.includes("tablet")) return "plansetler";
  return null;
}

async function loadCategory(page: Page, categoryUrl: string): Promise<void> {
  await withRetry(
    async () => {
      await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(3_000);
      await page.waitForSelector(".products .product", { timeout: 35_000 });
    },
    { attempts: 3, baseDelayMs: 1_100 }
  );
}

async function clickLoadMoreIfExists(page: Page, previousCount: number): Promise<boolean> {
  const loadMore = page.locator("#loadMore").first();
  if ((await loadMore.count()) === 0) return false;
  if (!(await loadMore.isVisible().catch(() => false))) return false;

  const nextPage = await loadMore.getAttribute("data-page").catch(() => null);
  if (!nextPage) return false;

  await withRetry(
    async () => {
      await loadMore.click({ timeout: 15_000 });
    },
    { attempts: 2, baseDelayMs: 700 }
  );

  try {
    await page.waitForFunction(
      (prev: number) => document.querySelectorAll(".products .product").length > prev,
      previousCount,
      { timeout: 30_000 }
    );
  } catch {
    const nowCount = await page.locator(".products .product").count();
    return nowCount > previousCount;
  }

  await page.waitForTimeout(900);
  return true;
}

async function extractVisibleItems(
  page: Page,
  scrapedAt: string,
  categorySlug: string | null
): Promise<RawStoreItem[]> {
  const rows = await page.$$eval(
    ".products .product",
    (nodes: Element[], payload: { scrapedAtIso: string; categorySlug: string | null }) =>
      nodes
        .map((node: Element, idx: number) => {
          const el = node as HTMLElement;
          const nameLink = el.querySelector("a.product__name.product-link") as HTMLAnchorElement | null;
          const title = nameLink?.innerText?.replace(/\s+/g, " ").trim() ?? "";
          const href = nameLink?.href?.trim() ?? "";

          const newPrice =
            (el.querySelector("p.new-price") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ?? "";
          const oldPrice =
            (el.querySelector("span.old-price") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ?? "";
          const fallbackPrice =
            (el.querySelector(".product__price") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ?? "";

          const availabilityRaw =
            (el.querySelector(".product__label") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ?? "";
          const addToCartText =
            (el.querySelector(".product__to-cart") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ??
            "";
          const imageUrl =
            (el.querySelector("img") as HTMLImageElement | null)?.currentSrc ??
            (el.querySelector("img") as HTMLImageElement | null)?.src ??
            null;

          const listingKey = (() => {
            if (!href) return `irshad-${idx}`;
            try {
              const u = new URL(href);
              const path = u.pathname.replace(/\/+$/, "").toLowerCase();
              return path || `irshad-${idx}`;
            } catch {
              return href.trim().toLowerCase() || `irshad-${idx}`;
            }
          })();
          const priceRaw = newPrice || oldPrice || fallbackPrice;

          if (!href || !title || !priceRaw) return null;

          const inStock = (() => {
            const stockText = `${availabilityRaw} ${addToCartText}`.toLowerCase();
            if (!stockText.trim()) return true;
            if (stockText.includes("stokda var")) return true;
            if (stockText.includes("stokda yoxdur")) return false;
            if (stockText.includes("yoxdur")) return false;
            if (stockText.includes("out of stock")) return false;
            if (stockText.includes("bitib")) return false;
            return true;
          })();

          return {
            listingKey,
            storeSlug: "irshad",
            titleRaw: title,
            productUrl: href,
            imageUrl,
            categorySlug: payload.categorySlug,
            priceRaw,
            availabilityRaw: inStock ? "in_stock" : "out_of_stock",
            scrapedAt: payload.scrapedAtIso
          };
        })
        .filter(Boolean),
    { scrapedAtIso: scrapedAt, categorySlug }
  );

  return rows as RawStoreItem[];
}

async function extractDetailSpecs(page: Page, productUrl: string): Promise<Record<string, string>> {
  await withRetry(
    async () => {
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1_400);
    },
    { attempts: 3, baseDelayMs: 900 }
  );

  const specs = (await page.evaluate(`(() => {
    const out = {};
    const clean = (value) =>
      String(value || "")
        .replace(/\\s+/g, " ")
        .replace(/[:]+$/, "")
        .trim();

    const addPair = (key, value) => {
      const k = clean(key);
      const v = clean(value);
      if (!k || !v) return;
      if (k.length > 140 || v.length > 400) return;
      out[k] = v;
    };

    // Primary selector on Irshad product pages.
    const techBlocks = Array.from(document.querySelectorAll(".product-view__details__technical-info__item"));
    for (const block of techBlocks) {
      const lines = (block.textContent || "")
        .split("\\n")
        .map(clean)
        .filter(Boolean);

      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx < 1) continue;
        addPair(line.slice(0, idx), line.slice(idx + 1));
      }
    }

    if (Object.keys(out).length >= 4) {
      return out;
    }

    // Fallback selectors for variant templates.
    const rows = Array.from(
      document.querySelectorAll(
        ".specifications tr, .product-specification tr, .product-properties tr, .tabs__content tr, table tr"
      )
    );
    for (const row of rows) {
      const keyEl = row.querySelector("th, td:first-child, .name, .title, .label, .left");
      const valueEl = row.querySelector("td:last-child, .value, .right, .desc, .description");
      addPair(keyEl ? keyEl.textContent : "", valueEl ? valueEl.textContent : "");
    }

    if (Object.keys(out).length >= 4) {
      return out;
    }

    const textBlocks = Array.from(
      document.querySelectorAll(
        ".product-view__details, .tabs__content, .characteristics, .product-details, .specifications"
      )
    );
    for (const block of textBlocks) {
      const lines = (block.textContent || "")
        .split("\\n")
        .map(clean)
        .filter(Boolean);
      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx < 1) continue;
        addPair(line.slice(0, idx), line.slice(idx + 1));
      }
    }

    return out;
  })()`)) as Record<string, string>;

  return specs;
}

async function enrichItemsWithDetailSpecs(
  ctx: Parameters<StoreScraper["scrape"]>[0],
  items: RawStoreItem[],
  options: {
    maxDetailItems: number;
    detailDelayMs: number;
    detailItemsProcessed: number;
  }
): Promise<number> {
  let processed = options.detailItemsProcessed;

  for (const item of items) {
    if (processed >= options.maxDetailItems) break;
    if (item.categorySlug !== "telefonlar" && item.categorySlug !== "plansetler") continue;

    const detailPage = await ctx.pageFactory();
    await detailPage.setExtraHTTPHeaders({
      "accept-language": "az,en-US;q=0.9,en;q=0.8"
    });

    try {
      const rawSpecs = await extractDetailSpecs(detailPage, item.productUrl);
      if (rawSpecs && Object.keys(rawSpecs).length > 0) {
        const specs: Record<string, string> = {};
        for (const [key, value] of Object.entries(rawSpecs)) {
          const cleanKey = sanitizeSpecText(key);
          const cleanValue = sanitizeSpecText(value);
          if (!cleanKey || !cleanValue) continue;
          specs[cleanKey] = cleanValue;
        }

        if (Object.keys(specs).length > 0) {
          item.specsRaw = specs;
        }
      }
    } catch (error) {
      logger.warn(
        { store: STORE_SLUG, productUrl: item.productUrl, error: (error as Error).message },
        "Irshad detail specs parse failed"
      );
    } finally {
      await detailPage.close();
    }

    processed += 1;
    if (options.detailDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.detailDelayMs));
    }
  }

  return processed;
}

export const irshadScraper: StoreScraper = {
  storeSlug: STORE_SLUG,
  async scrape(ctx) {
    const maxPagesPerCategory = toPositiveInt(process.env.IRSHAD_MAX_PAGES_PER_CATEGORY, 3);
    const detailEnabled = process.env.IRSHAD_FETCH_DETAIL_SPECS !== "false";
    const detailDelayMs = toPositiveInt(process.env.IRSHAD_DETAIL_DELAY_MS, 250);
    const maxItems = ctx.maxItems ?? Number.MAX_SAFE_INTEGER;
    const maxDetailItems = toPositiveInt(
      process.env.IRSHAD_MAX_DETAIL_ITEMS,
      Number.isFinite(maxItems) && maxItems <= 400 ? maxItems : 120
    );
    const categoryUrls = getCategoryUrls();
    const categoryErrors: string[] = [];
    const listingMap = new Map<string, RawStoreItem>();
    let detailItemsProcessed = 0;

    for (const categoryUrl of categoryUrls) {
      const page = await ctx.pageFactory();
      await page.setExtraHTTPHeaders({
        "accept-language": "az,en-US;q=0.9,en;q=0.8"
      });

      try {
        const categorySlug = inferCategorySlug(categoryUrl);
        await loadCategory(page, categoryUrl);

        let loadedPages = 1;
        while (loadedPages < maxPagesPerCategory) {
          const previousCount = await page.locator(".products .product").count();
          if (previousCount === 0) break;

          const loaded = await clickLoadMoreIfExists(page, previousCount);
          if (!loaded) break;
          loadedPages += 1;
        }

        const items = await extractVisibleItems(page, new Date().toISOString(), categorySlug);
        if (detailEnabled && detailItemsProcessed < maxDetailItems) {
          detailItemsProcessed = await enrichItemsWithDetailSpecs(ctx, items, {
            maxDetailItems,
            detailDelayMs,
            detailItemsProcessed
          });
        }
        for (const item of items) {
          listingMap.set(`${item.storeSlug}|${item.listingKey}`, item);
          if (listingMap.size >= maxItems) {
            return [...listingMap.values()].slice(0, maxItems);
          }
        }
      } catch (error) {
        const message = (error as Error).message;
        categoryErrors.push(`${categoryUrl} :: ${message}`);
        logger.warn({ store: STORE_SLUG, categoryUrl, error: message }, "Skipping Irshad category due scrape error");
      } finally {
        await page.close();
      }

      await new Promise((resolve) => setTimeout(resolve, 1_600));
    }

    const result = [...listingMap.values()].slice(0, maxItems);
    if (!result.length) {
      throw new Error(categoryErrors[0] ?? "No products fetched from Irshad.");
    }

    if (categoryErrors.length) {
      logger.warn({ store: STORE_SLUG, categoryErrors }, "Irshad scraper finished with partial category failures");
    }

    return result;
  }
};
