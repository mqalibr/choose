import { logger } from "../core/logger";
import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

const STORE_SLUG = "kontakt-home";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

const DEFAULT_CATEGORY_URLS = [
  "https://kontakt.az/telefoniya/smartfonlar",
  "https://kontakt.az/notbuk-ve-kompyuterler/komputerler/notbuklar",
  "https://kontakt.az/tv-audio-ve-video/televizorlar",
  "https://kontakt.az/plansetler-ve-elektron-kitablar/plansetler"
];

function toPositiveInt(input: string | undefined, fallback: number): number {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function getCategoryUrls(): string[] {
  const raw = process.env.KONTAKT_CATEGORY_URLS;
  if (!raw?.trim()) return DEFAULT_CATEGORY_URLS;

  const urls = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return urls.length ? urls : DEFAULT_CATEGORY_URLS;
}

function isChallengePage(title: string): boolean {
  return /just a moment/i.test(title);
}

function inferCategorySlug(url: string): string | null {
  const value = url.toLowerCase();
  if (value.includes("smartfon") || value.includes("telefoniya")) return "telefonlar";
  if (value.includes("notbuk")) return "noutbuklar";
  if (value.includes("televizor") || value.includes("/tv-")) return "televizorlar";
  if (value.includes("planset") || value.includes("tablet")) return "plansetler";
  return null;
}

async function loadAndValidateCategoryPage(page: any, url: string, challengeRetries: number) {
  await withRetry(
    async () => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(7_000);
    },
    { attempts: 3, baseDelayMs: 1_200 }
  );

  let title = await page.title();
  let productCount = await page.locator(".prodItem.product-item").count();

  for (let attempt = 0; attempt < challengeRetries; attempt += 1) {
    if (!isChallengePage(title) && productCount > 0) {
      break;
    }

    await page.waitForTimeout(5_000 + attempt * 2_000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(6_000);
    title = await page.title();
    productCount = await page.locator(".prodItem.product-item").count();
  }

  if (isChallengePage(title)) {
    throw new Error(`Cloudflare challenge on Kontakt page: ${url}`);
  }
  if (productCount === 0) {
    throw new Error(`No product cards on Kontakt page: ${url}`);
  }
}

async function extractPageItems(page: any, scrapedAt: string, categorySlug: string | null): Promise<RawStoreItem[]> {
  return page.$$eval(
    ".prodItem.product-item",
    (nodes: Element[], payload: { scrapedAtIso: string; categorySlug: string | null }) =>
      nodes
        .map((node: Element, idx: number) => {
          const el = node as HTMLElement;

          const rawGtm = el.getAttribute("data-gtm");
          let gtmPrice = "";
          let gtmTitle = "";
          let gtmSku = "";
          try {
            if (rawGtm) {
              const parsed = JSON.parse(rawGtm) as {
                item_name?: string;
                item_id?: string;
                price?: number;
              };
              gtmTitle = parsed.item_name?.trim() ?? "";
              gtmSku = parsed.item_id?.trim() ?? "";
              if (typeof parsed.price === "number") {
                gtmPrice = parsed.price.toString();
              }
            }
          } catch {
            // ignore parse failure and use fallback selectors
          }

          const href = (el.querySelector("a.prodItem__img") as HTMLAnchorElement | null)?.href?.trim() ?? "";
          const titleText =
            (el.querySelector(".prodItem__title") as HTMLElement | null)?.innerText?.trim() ?? gtmTitle;
          const imageUrl =
            (el.querySelector("a.prodItem__img img.product-image") as HTMLImageElement | null)?.src ??
            (el.querySelector("a.prodItem__img img") as HTMLImageElement | null)?.src ??
            null;
          const sku = (el.getAttribute("data-sku") ?? gtmSku).trim();
          const pricesText =
            (el.querySelector(".prodItem__prices") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ?? "";

          const addToCartBtn = el.querySelector("button.prodItem__addCart") as HTMLButtonElement | null;
          const addBtnText = addToCartBtn?.innerText?.trim() ?? "";
          const addBtnDisabled = Boolean(addToCartBtn?.disabled);
          const outOfStock = /movcud deyil|stokda yoxdur|satilda yoxdur/i.test(addBtnText);

          const listingKey = sku || href || `kontakt-${idx}`;
          const priceRaw = gtmPrice || pricesText;
          if (!href || !titleText || !priceRaw) {
            return null;
          }

          return {
            listingKey,
            storeSlug: "kontakt-home",
            titleRaw: titleText,
            productUrl: href,
            imageUrl,
            categorySlug: payload.categorySlug,
            priceRaw,
            availabilityRaw: addBtnText || null,
            storeSku: sku || null,
            scrapedAt: payload.scrapedAtIso,
            inStock: !addBtnDisabled && !outOfStock
          } as RawStoreItem & { inStock: boolean };
        })
        .filter((item: (RawStoreItem & { inStock: boolean }) | null): item is RawStoreItem & { inStock: boolean } =>
          Boolean(item)
        )
        .map((item: RawStoreItem & { inStock: boolean }) => ({
          ...item,
          availabilityRaw: item.inStock ? "in_stock" : "out_of_stock"
        })),
    { scrapedAtIso: scrapedAt, categorySlug }
  );
}

export const kontaktHomeScraper: StoreScraper = {
  storeSlug: STORE_SLUG,
  async scrape(ctx) {
    const maxPagesPerCategory = toPositiveInt(process.env.KONTAKT_MAX_PAGES_PER_CATEGORY, 2);
    const challengeRetries = toPositiveInt(process.env.KONTAKT_CHALLENGE_RETRIES, 2);
    const maxItems = ctx.maxItems ?? Number.MAX_SAFE_INTEGER;
    const categoryUrls = getCategoryUrls();

    const results: RawStoreItem[] = [];
    const categoryErrors: string[] = [];

    for (const categoryUrl of categoryUrls) {
      const page = await ctx.pageFactory();
      await page.setExtraHTTPHeaders({
        "accept-language": "az,en-US;q=0.9,en;q=0.8"
      });

      try {
        const categorySlug = inferCategorySlug(categoryUrl);
        let currentUrl: string | null = categoryUrl;
        let pageNo = 1;
        const seenPages = new Set<string>();

        while (currentUrl && pageNo <= maxPagesPerCategory) {
          if (seenPages.has(currentUrl)) break;
          seenPages.add(currentUrl);

          await loadAndValidateCategoryPage(page, currentUrl, challengeRetries);

          const pageItems = await extractPageItems(page, new Date().toISOString(), categorySlug);
          if (!pageItems.length) {
            throw new Error(`No parsable products on Kontakt page: ${currentUrl}`);
          }

          results.push(...pageItems);
          if (results.length >= maxItems) {
            return results.slice(0, maxItems);
          }

          const nextUrl = await page.locator("a.action.next").first().getAttribute("href").catch(() => null);
          if (!nextUrl) break;

          currentUrl = nextUrl;
          pageNo += 1;
          await page.waitForTimeout(1_600);
        }
      } catch (error) {
        const message = (error as Error).message;
        categoryErrors.push(`${categoryUrl} :: ${message}`);
        logger.warn({ store: STORE_SLUG, categoryUrl, error: message }, "Skipping Kontakt category due scrape error");
      } finally {
        await page.close();
      }

      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    if (!results.length) {
      throw new Error(categoryErrors[0] ?? "No products fetched from Kontakt.");
    }

    if (categoryErrors.length) {
      logger.warn({ store: STORE_SLUG, categoryErrors }, "Kontakt scraper finished with partial category failures");
    }

    return results.slice(0, maxItems);
  }
};

export { USER_AGENT as KONTAKT_USER_AGENT };
