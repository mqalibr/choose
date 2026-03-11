import type { Page } from "playwright";
import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

interface StoreCategoryRule {
  slug: string;
  keywords: string[];
}

interface CatalogSkeletonConfig {
  storeSlug: string;
  baseUrl: string;
  categoryUrlsEnvKey: string;
  defaultCategoryUrls: string[];
  maxPagesEnvKey: string;
  fetchDetailSpecsEnvKey: string;
  maxDetailItemsEnvKey: string;
  detailDelayMsEnvKey: string;
  waitForSelector?: string;
  cardSelectors?: string[];
  linkSelectors?: string[];
  titleSelectors?: string[];
  priceSelectors?: string[];
  imageSelectors?: string[];
  stockSelectors?: string[];
  loadMoreSelectors?: string[];
  nextPageSelectors?: string[];
  categoryRules?: StoreCategoryRule[];
}

interface ExtractedCard {
  listingKey: string;
  titleRaw: string;
  productUrl: string;
  imageUrl: string | null;
  priceRaw: string;
  availabilityRaw: string;
}

const DEFAULT_CARD_SELECTORS = [".product-card", ".product", ".products__item", ".item", "[data-product-id]"];
const DEFAULT_LINK_SELECTORS = [
  "a[href*='/product']",
  "a[href*='/mehsul']",
  "a[href*='/smartfon']",
  "a[href*='/telefon']",
  "a[href]"
];
const DEFAULT_TITLE_SELECTORS = [".title", ".product-title", ".name", "h3", "h2", "a[title]"];
const DEFAULT_PRICE_SELECTORS = [".price", ".product-price", "[data-price]", ".current-price", ".new-price"];
const DEFAULT_IMAGE_SELECTORS = ["img[data-src]", "img[data-lazy]", "img"];
const DEFAULT_STOCK_SELECTORS = [".stock", ".availability", ".status", ".product_btn", "[data-product-out-of-stock]"];
const DEFAULT_LOAD_MORE_SELECTORS = [
  ".load-more",
  "#loadMore",
  ".product__list_load_more_btn",
  "button:has-text('Daha çox')",
  "a:has-text('Daha çox')"
];
const DEFAULT_NEXT_PAGE_SELECTORS = [".pagination .next a", "a[rel='next']", ".next-page", ".page-next"];
const DEFAULT_CATEGORY_RULES: StoreCategoryRule[] = [
  { slug: "telefonlar", keywords: ["telefon", "smartfon", "iphone", "phone"] },
  { slug: "plansetler", keywords: ["planset", "tablet", "ipad", "tab"] },
  { slug: "televizorlar", keywords: ["televizor", "televizorlar", "tv", "oled", "qled"] },
  { slug: "noutbuklar", keywords: ["noutbuk", "notbuk", "laptop", "notebook"] }
];

function toPositiveInt(input: string | undefined, fallback: number): number {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function parseCsv(input: string | undefined): string[] {
  if (!input?.trim()) return [];
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUrl(baseUrl: string, href: string | null | undefined): string {
  const value = (href ?? "").trim();
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function sanitizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPriceText(text: string): string {
  const cleaned = sanitizeText(text);
  if (!cleaned) return "";

  const explicit = cleaned.match(/(\d[\d\s.,]{1,20})\s*(azn|₼)?/i);
  if (explicit?.[0]) return sanitizeText(explicit[0]);
  return "";
}

function toListingKey(url: string, fallback: string): string {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    const key = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return key || fallback;
  } catch {
    return url.toLowerCase() || fallback;
  }
}

function inferAvailability(raw: string): string {
  const value = sanitizeText(raw).toLowerCase();
  if (!value) return "in_stock";
  if (
    value.includes("yoxdur") ||
    value.includes("stokda yoxdur") ||
    value.includes("mövcud deyil") ||
    value.includes("movcud deyil") ||
    value.includes("out of stock") ||
    value.includes("bitib")
  ) {
    return "out_of_stock";
  }
  return "in_stock";
}

function inferCategorySlug(url: string, rules: StoreCategoryRule[]): string | null {
  const value = url.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => value.includes(keyword))) {
      return rule.slug;
    }
  }
  return null;
}

function getCategoryUrls(config: CatalogSkeletonConfig): string[] {
  const envUrls = parseCsv(process.env[config.categoryUrlsEnvKey]);
  if (envUrls.length) return envUrls;
  return config.defaultCategoryUrls;
}

async function loadPage(page: Page, url: string, waitForSelector?: string): Promise<void> {
  await withRetry(
    async () => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1_800);
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 25_000 });
      }
    },
    { attempts: 3, baseDelayMs: 900 }
  );
}

async function extractCards(
  page: Page,
  baseUrl: string,
  selectors: {
    cardSelectors: string[];
    linkSelectors: string[];
    titleSelectors: string[];
    priceSelectors: string[];
    imageSelectors: string[];
    stockSelectors: string[];
  }
): Promise<ExtractedCard[]> {
  const payload = {
    baseUrlValue: baseUrl,
    selectorConfig: selectors
  };
  const payloadJson = JSON.stringify(payload);
  const rows = await page.evaluate(`(() => {
    const payload = ${payloadJson};
    const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();

    const collect = (root, choices) => {
      for (const choice of choices) {
        const nodes = Array.from(root.querySelectorAll(choice));
        if (nodes.length) return nodes;
      }
      return [];
    };

    const pickText = (root, choices) => {
      for (const choice of choices) {
        const node = root.querySelector(choice);
        const text = clean(node ? node.textContent : "");
        if (text) return text;
        const title = clean(node ? node.getAttribute("title") : "");
        if (title) return title;
      }
      return "";
    };

    const pickLink = (root, choices) => {
      for (const choice of choices) {
        const anchor = root.querySelector(choice);
        const href = clean(anchor ? anchor.getAttribute("href") : "") || clean(anchor ? anchor.href : "");
        if (href) return href;
      }
      return "";
    };

    const pickImage = (root, choices) => {
      for (const choice of choices) {
        const image = root.querySelector(choice);
        if (!image) continue;
        const src =
          clean(image.currentSrc) ||
          clean(image.getAttribute("src")) ||
          clean(image.getAttribute("data-src")) ||
          clean(image.getAttribute("data-lazy")) ||
          clean(image.getAttribute("data-original"));
        if (src) return src;
      }
      return null;
    };

    const pickPrice = (root, choices) => {
      for (const choice of choices) {
        const node = root.querySelector(choice);
        const text = clean(node ? node.textContent : "");
        if (!text) continue;
        const match = text.match(/(\\d[\\d\\s.,]{1,20})\\s*(azn|₼)?/i);
        if (match && match[0]) return clean(match[0]);
      }

      const fallbackText = clean(root.textContent || "");
      const fallbackMatch = fallbackText.match(/(\\d[\\d\\s.,]{1,20})\\s*(azn|₼)?/i);
      return fallbackMatch && fallbackMatch[0] ? clean(fallbackMatch[0]) : "";
    };

    const pickStock = (root, choices) => {
      for (const choice of choices) {
        const node = root.querySelector(choice);
        const text = clean(node ? node.textContent : "");
        if (text) return text;
        const attr = clean(node ? node.getAttribute("data-product-out-of-stock") : "");
        if (attr) return attr;
      }
      return "";
    };

    const cards = collect(document, payload.selectorConfig.cardSelectors);
    const rows = [];

    cards.forEach((card, idx) => {
      const link = pickLink(card, payload.selectorConfig.linkSelectors);
      const title = pickText(card, payload.selectorConfig.titleSelectors);
      const price = pickPrice(card, payload.selectorConfig.priceSelectors);
      const stock = pickStock(card, payload.selectorConfig.stockSelectors);
      const image = pickImage(card, payload.selectorConfig.imageSelectors);

      if (!link || !title || !price) return;

      let absoluteLink = link;
      try {
        absoluteLink = new URL(link, payload.baseUrlValue).toString();
      } catch {}

      rows.push({
        listingKey: "",
        titleRaw: title,
        productUrl: absoluteLink,
        imageUrl: image,
        priceRaw: price,
        availabilityRaw: stock || "index:" + idx
      });
    });

    return rows;
  })()`);
  return rows as ExtractedCard[];
}

async function tryLoadMore(page: Page, selectors: string[]): Promise<boolean> {
  const beforeCount = await page.locator("a[href]").count();

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if ((await button.count()) === 0) continue;
    if (!(await button.isVisible().catch(() => false))) continue;
    if (!(await button.isEnabled().catch(() => false))) continue;

    await button.click({ timeout: 12_000 }).catch(() => null);
    await page.waitForTimeout(1_200);

    const afterCount = await page.locator("a[href]").count();
    if (afterCount > beforeCount) {
      return true;
    }
  }

  return false;
}

async function getNextPageUrl(page: Page, selectors: string[], baseUrl: string): Promise<string | null> {
  for (const selector of selectors) {
    const href = await page.locator(selector).first().getAttribute("href").catch(() => null);
    const resolved = normalizeUrl(baseUrl, href);
    if (resolved) return resolved;
  }
  return null;
}

async function extractDetailSpecs(page: Page, productUrl: string): Promise<Record<string, string>> {
  await withRetry(
    async () => {
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1_100);
    },
    { attempts: 2, baseDelayMs: 700 }
  );

  const specs = (await page.evaluate(`(() => {
    const out = {};
    const clean = (value) => String(value || "").replace(/\\s+/g, " ").replace(/[:]+$/, "").trim();
    const add = (key, value) => {
      const k = clean(key);
      const v = clean(value);
      if (!k || !v) return;
      if (k.length > 140 || v.length > 400) return;
      out[k] = v;
    };

    const tableRows = Array.from(document.querySelectorAll("table tr"));
    for (const row of tableRows) {
      const key = row.querySelector("th,td:first-child,.name,.title,.label,.left");
      const value = row.querySelector("td:last-child,.value,.right,.desc,.description");
      add(key ? key.textContent : "", value ? value.textContent : "");
    }

    const specItems = Array.from(
      document.querySelectorAll(
        ".specs li, .specification li, .specifications li, .technical li, .product-specs li, .characteristics li"
      )
    );
    for (const item of specItems) {
      const raw = clean(item.textContent || "");
      if (!raw) continue;
      const separatorIndex = raw.indexOf(":");
      if (separatorIndex < 1) continue;
      add(raw.slice(0, separatorIndex), raw.slice(separatorIndex + 1));
    }

    return out;
  })()`)) as Record<string, string>;

  return specs;
}

async function enrichWithSpecs(
  pageFactory: () => Promise<Page>,
  items: RawStoreItem[],
  options: {
    maxDetailItems: number;
    detailDelayMs: number;
  }
): Promise<void> {
  let processed = 0;
  for (const item of items) {
    if (processed >= options.maxDetailItems) break;
    if (item.categorySlug !== "telefonlar" && item.categorySlug !== "plansetler" && item.categorySlug !== "televizorlar") {
      continue;
    }

    const detailPage = await pageFactory();
    await detailPage.setExtraHTTPHeaders({ "accept-language": "az,en-US;q=0.9,en;q=0.8" });
    try {
      const specs = await extractDetailSpecs(detailPage, item.productUrl);
      if (Object.keys(specs).length) {
        item.specsRaw = specs;
      }
    } catch {
      // skeleton scraper: silently continue
    } finally {
      await detailPage.close();
    }

    processed += 1;
    if (options.detailDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.detailDelayMs));
    }
  }
}

export function createCatalogSkeletonScraper(config: CatalogSkeletonConfig): StoreScraper {
  return {
    storeSlug: config.storeSlug,
    async scrape(ctx) {
      const categoryUrls = getCategoryUrls(config);
      const maxItems = ctx.maxItems ?? Number.MAX_SAFE_INTEGER;
      const maxPagesPerCategory = toPositiveInt(process.env[config.maxPagesEnvKey], 3);
      const fetchDetailSpecs = String(process.env[config.fetchDetailSpecsEnvKey] ?? "true").toLowerCase() !== "false";
      const maxDetailItems = toPositiveInt(process.env[config.maxDetailItemsEnvKey], Math.min(maxItems, 80));
      const detailDelayMs = toPositiveInt(process.env[config.detailDelayMsEnvKey], 250);
      const categoryRules = config.categoryRules ?? DEFAULT_CATEGORY_RULES;

      const cardSelectors = config.cardSelectors ?? DEFAULT_CARD_SELECTORS;
      const linkSelectors = config.linkSelectors ?? DEFAULT_LINK_SELECTORS;
      const titleSelectors = config.titleSelectors ?? DEFAULT_TITLE_SELECTORS;
      const priceSelectors = config.priceSelectors ?? DEFAULT_PRICE_SELECTORS;
      const imageSelectors = config.imageSelectors ?? DEFAULT_IMAGE_SELECTORS;
      const stockSelectors = config.stockSelectors ?? DEFAULT_STOCK_SELECTORS;
      const loadMoreSelectors = config.loadMoreSelectors ?? DEFAULT_LOAD_MORE_SELECTORS;
      const nextPageSelectors = config.nextPageSelectors ?? DEFAULT_NEXT_PAGE_SELECTORS;

      const listingMap = new Map<string, RawStoreItem>();

      for (const categoryUrl of categoryUrls) {
        const page = await ctx.pageFactory();
        await page.setExtraHTTPHeaders({ "accept-language": "az,en-US;q=0.9,en;q=0.8" });

        try {
          let currentUrl: string | null = categoryUrl;
          const visited = new Set<string>();
          let pageNo = 1;
          const categorySlug = inferCategorySlug(categoryUrl, categoryRules);

          while (currentUrl && pageNo <= maxPagesPerCategory) {
            if (visited.has(currentUrl)) break;
            visited.add(currentUrl);

            await loadPage(page, currentUrl, config.waitForSelector);

            const extracted = await extractCards(page, config.baseUrl, {
              cardSelectors,
              linkSelectors,
              titleSelectors,
              priceSelectors,
              imageSelectors,
              stockSelectors
            });

            const normalized: RawStoreItem[] = extracted
              .map((row, idx) => {
                const productUrl = normalizeUrl(config.baseUrl, row.productUrl);
                const imageUrl = normalizeUrl(config.baseUrl, row.imageUrl);
                const priceRaw = extractPriceText(row.priceRaw);
                if (!productUrl || !priceRaw) return null;

                const fallbackKey = `${config.storeSlug}-${pageNo}-${idx}`;
                return {
                  listingKey: toListingKey(productUrl, fallbackKey),
                  storeSlug: config.storeSlug,
                  titleRaw: sanitizeText(row.titleRaw),
                  productUrl,
                  imageUrl: imageUrl || null,
                  categorySlug,
                  priceRaw,
                  availabilityRaw: inferAvailability(row.availabilityRaw),
                  scrapedAt: new Date().toISOString()
                } as RawStoreItem;
              })
              .filter((item): item is RawStoreItem => Boolean(item?.titleRaw));

            if (fetchDetailSpecs && normalized.length) {
              await enrichWithSpecs(ctx.pageFactory, normalized, { maxDetailItems, detailDelayMs });
            }

            for (const item of normalized) {
              listingMap.set(`${item.storeSlug}|${item.listingKey}`, item);
              if (listingMap.size >= maxItems) {
                await page.close();
                return [...listingMap.values()].slice(0, maxItems);
              }
            }

            const loadedMore = await tryLoadMore(page, loadMoreSelectors);
            if (loadedMore) {
              pageNo += 1;
              continue;
            }

            const nextPageUrl = await getNextPageUrl(page, nextPageSelectors, config.baseUrl);
            if (!nextPageUrl || nextPageUrl === currentUrl) break;
            currentUrl = nextPageUrl;
            pageNo += 1;
          }
        } finally {
          await page.close();
        }
      }

      if (!listingMap.size) {
        throw new Error(`No products fetched from ${config.storeSlug}`);
      }

      return [...listingMap.values()].slice(0, maxItems);
    }
  };
}
