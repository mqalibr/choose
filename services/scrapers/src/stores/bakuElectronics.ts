import type { Page } from "playwright";
import { logger } from "../core/logger";
import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

const STORE_SLUG = "baku-electronics";
const BASE_URL = "https://www.bakuelectronics.az";
const DEFAULT_SEARCH_TERMS = [
  "telefon",
  "smartfon",
  "iphone",
  "samsung",
  "xiaomi",
  "redmi",
  "poco",
  "honor",
  "oppo",
  "realme",
  "vivo",
  "infinix",
  "tecno",
  "nokia",
  "motorola"
];

type BakuCategory = "telefonlar" | "plansetler";

interface BakuSearchItem {
  name?: string;
  slug?: string;
  price?: number;
  quantity?: number;
  image?: string;
}

function toPositiveInt(input: string | undefined, fallback: number): number {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function getSearchTerms(): string[] {
  const raw = process.env.BAKU_SEARCH_TERMS;
  if (!raw?.trim()) return DEFAULT_SEARCH_TERMS;

  const terms = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return terms.length ? terms : DEFAULT_SEARCH_TERMS;
}

function sanitizeSpecText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[:]+$/, "")
    .trim();
}

function normalizeCategorySlug(input: string | undefined): BakuCategory {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "plansetler" || value === "tabletler" || value === "tablets" || value === "tablet") {
    return "plansetler";
  }
  return "telefonlar";
}

function isLikelyPhone(item: { slug?: string; name?: string }): boolean {
  const slug = (item.slug ?? "").toLowerCase();
  const name = (item.name ?? "").toLowerCase();

  const hasPhoneToken =
    slug.startsWith("telefon-") ||
    slug.startsWith("smartfon-") ||
    /\b(iphone|galaxy|redmi|xiaomi|honor|poco|realme|oppo|vivo|infinix|tecno|nokia|motorola)\b/.test(name);
  const hasAccessoryToken = /\b(headphone|airpods|buds|case|cover|adapter|kabel|kabell|watch|saat)\b/.test(
    `${slug} ${name}`
  );

  return hasPhoneToken && !hasAccessoryToken;
}

function isLikelyTablet(item: { slug?: string; name?: string }): boolean {
  const slug = (item.slug ?? "").toLowerCase();
  const name = (item.name ?? "").toLowerCase();
  const text = `${slug} ${name}`;

  const hasTabletToken =
    /\b(ipad|tablet|tab|pad|planset|planset|galaxy tab|redmi pad|xiaomi pad|honor pad|lenovo tab)\b/.test(text) ||
    slug.startsWith("planset-") ||
    slug.startsWith("tablet-");
  const hasAccessoryToken =
    /\b(case|cover|qab|stylus|pen|klaviatura|keyboard|adapter|kabel|cable|stand)\b/.test(text);

  return hasTabletToken && !hasAccessoryToken;
}

function normalizeUrl(pathOrUrl: string): string {
  try {
    return new URL(pathOrUrl, BASE_URL).toString();
  } catch {
    return pathOrUrl;
  }
}

async function loadSearchPage(page: Page, term: string, pageNo: number): Promise<void> {
  const url = `${BASE_URL}/axtaris-neticesi?name=${encodeURIComponent(term)}&page=${pageNo}`;
  await withRetry(
    async () => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2_500);
    },
    { attempts: 3, baseDelayMs: 1_000 }
  );
}

async function extractSearchItems(page: Page): Promise<{
  items: BakuSearchItem[];
  total: number;
  page: number;
  size: number;
}> {
  const rawNextData = (await page.locator("script#__NEXT_DATA__").first().textContent().catch(() => null)) ?? "";
  if (!rawNextData.trim()) {
    throw new Error("Baku search NEXT_DATA not found");
  }

  const nextData = JSON.parse(rawNextData) as {
    props?: {
      pageProps?: {
        products?: {
          products?: {
            items?: BakuSearchItem[];
            total?: number;
            page?: number;
            size?: number;
          };
        };
      };
    };
  };

  const list = nextData.props?.pageProps?.products?.products;
  return {
    items: list?.items ?? [],
    total: Number(list?.total ?? 0),
    page: Number(list?.page ?? 1),
    size: Number(list?.size ?? 18)
  };
}

async function extractDetailSpecs(
  page: Page,
  productUrl: string
): Promise<Record<string, string>> {
  await withRetry(
    async () => {
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1_400);
    },
    { attempts: 3, baseDelayMs: 1_000 }
  );

  const rawNextData = (await page.locator("script#__NEXT_DATA__").first().textContent().catch(() => null)) ?? "";
  if (!rawNextData.trim()) return {};

  const nextData = JSON.parse(rawNextData) as {
    props?: {
      pageProps?: {
        prodDetails?: {
          attributes?: Array<{ key?: string; value?: string }>;
        };
      };
    };
  };

  const attrs = nextData.props?.pageProps?.prodDetails?.attributes ?? [];
  const specs: Record<string, string> = {};
  for (const row of attrs) {
    const key = sanitizeSpecText(row.key ?? "");
    const value = sanitizeSpecText(row.value ?? "");
    if (!key || !value) continue;
    specs[key] = value;
  }
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

    const detailPage = await ctx.pageFactory();
    await detailPage.setExtraHTTPHeaders({
      "accept-language": "az,en-US;q=0.9,en;q=0.8"
    });

    try {
      const specs = await extractDetailSpecs(detailPage, item.productUrl);
      if (specs && Object.keys(specs).length > 0) {
        item.specsRaw = specs;
      }
    } catch (error) {
      logger.warn(
        { store: STORE_SLUG, productUrl: item.productUrl, error: (error as Error).message },
        "Baku detail specs parse failed"
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

export const bakuElectronicsScraper: StoreScraper = {
  storeSlug: STORE_SLUG,
  async scrape(ctx) {
    const searchTerms = getSearchTerms();
    const categorySlug = normalizeCategorySlug(process.env.BAKU_CATEGORY_SLUG);
    const maxPagesPerTerm = toPositiveInt(process.env.BAKU_MAX_PAGES_PER_TERM, 4);
    const detailEnabled = process.env.BAKU_FETCH_DETAIL_SPECS !== "false";
    const detailDelayMs = toPositiveInt(process.env.BAKU_DETAIL_DELAY_MS, 250);
    const maxItems = ctx.maxItems ?? Number.MAX_SAFE_INTEGER;
    const maxDetailItems = toPositiveInt(
      process.env.BAKU_MAX_DETAIL_ITEMS,
      Number.isFinite(maxItems) && maxItems <= 400 ? maxItems : 120
    );

    const page = await ctx.pageFactory();
    await page.setExtraHTTPHeaders({
      "accept-language": "az,en-US;q=0.9,en;q=0.8"
    });

    const byListingKey = new Map<string, RawStoreItem>();
    let detailItemsProcessed = 0;

    try {
      for (const term of searchTerms) {
        for (let pageNo = 1; pageNo <= maxPagesPerTerm; pageNo += 1) {
          await loadSearchPage(page, term, pageNo);

          const searchPayload = await extractSearchItems(page);
          const batch = (searchPayload.items ?? [])
            .filter((item) => item.slug && item.name)
            .filter((item) =>
              categorySlug === "plansetler"
                ? isLikelyTablet({ slug: item.slug, name: item.name })
                : isLikelyPhone({ slug: item.slug, name: item.name })
            )
            .map<RawStoreItem>((item) => {
              const slug = item.slug as string;
              const price = Number(item.price ?? 0);
              const inStock = Number(item.quantity ?? 0) > 0;
              return {
                listingKey: `/mehsul/${slug}`,
                storeSlug: STORE_SLUG,
                titleRaw: (item.name as string).trim(),
                productUrl: normalizeUrl(`/mehsul/${slug}`),
                imageUrl: item.image ? normalizeUrl(item.image) : null,
                categorySlug,
                priceRaw: String(price),
                availabilityRaw: inStock ? "in_stock" : "out_of_stock",
                scrapedAt: new Date().toISOString()
              };
            });

          if (detailEnabled && detailItemsProcessed < maxDetailItems && batch.length) {
            detailItemsProcessed = await enrichItemsWithDetailSpecs(ctx, batch, {
              maxDetailItems,
              detailDelayMs,
              detailItemsProcessed
            });
          }

          for (const row of batch) {
            byListingKey.set(`${STORE_SLUG}|${row.listingKey}`, row);
            if (byListingKey.size >= maxItems) {
              return [...byListingKey.values()].slice(0, maxItems);
            }
          }

          const loadedTill = searchPayload.page * searchPayload.size;
          if (!searchPayload.total || loadedTill >= searchPayload.total) {
            break;
          }
        }
      }

      const result = [...byListingKey.values()].slice(0, maxItems);
      if (!result.length) {
        throw new Error("No products fetched from Baku Electronics");
      }
      return result;
    } finally {
      await page.close();
    }
  }
};
