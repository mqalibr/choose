import type { Page } from "playwright";
import { logger } from "../core/logger";
import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

const STORE_SLUG = "soliton";
const BASE_URL = "https://soliton.az";
const DEFAULT_CATEGORY_URL = "https://soliton.az/az/telefon/mobil-telefonlar/";
const DEFAULT_CATEGORY_URLS = [
  "https://soliton.az/az/telefon/mobil-telefonlar/",
  "https://soliton.az/az/komputer-ve-aksesuarlar/plansetler/",
  "https://soliton.az/az/tv-ve-audio/televizorlar/"
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

function getCategoryUrls(): string[] {
  const many = parseCsv(process.env.SOLITON_CATEGORY_URLS);
  if (many.length) return many;

  const single = process.env.SOLITON_CATEGORY_URL?.trim();
  if (single) return [single];

  return DEFAULT_CATEGORY_URLS;
}

function sanitizeSpecText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[:]+$/, "")
    .trim();
}

function normalizeUrl(href: string): string {
  try {
    return new URL(href, BASE_URL).toString();
  } catch {
    return href;
  }
}

function inferCategorySlug(url: string): string | null {
  const value = url.toLowerCase();
  if (value.includes("smartfon") || value.includes("telefon")) return "telefonlar";
  if (value.includes("planset") || value.includes("tablet") || value.includes("/pad")) return "plansetler";
  if (value.includes("notbuk") || value.includes("laptop")) return "noutbuklar";
  if (value.includes("televizor") || value.includes("/tv")) return "televizorlar";
  return null;
}

async function loadCategory(page: Page, categoryUrl: string): Promise<void> {
  await withRetry(
    async () => {
      await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2_200);
      await page.waitForSelector("#products-list .product-item", { timeout: 35_000 });
    },
    { attempts: 3, baseDelayMs: 1_000 }
  );
}

async function parseItemsFromCurrentDom(
  page: Page,
  scrapedAtIso: string,
  categorySlug: string | null
): Promise<RawStoreItem[]> {
  const rows = await page.$$eval(
    "#products-list .product-item",
    (nodes: Element[], payload: { scrapedAtIso: string; categorySlug: string | null }) =>
      nodes
        .map((node: Element, idx: number) => {
          const el = node as HTMLElement;
          const title =
            (el.querySelector("a.prodTitle") as HTMLAnchorElement | null)?.innerText?.replace(/\s+/g, " ").trim() ??
            "";
          const href = (el.querySelector("a.prodTitle") as HTMLAnchorElement | null)?.getAttribute("href") ?? "";
          const imageEl =
            (el.querySelector(".thumbHolder img") as HTMLImageElement | null) ??
            (el.querySelector(".pic img:not(.hediyyePic)") as HTMLImageElement | null);
          const imageUrl =
            imageEl?.currentSrc?.trim() ||
            imageEl?.getAttribute("src")?.trim() ||
            imageEl?.getAttribute("data-src")?.trim() ||
            imageEl?.getAttribute("data-original")?.trim() ||
            imageEl?.getAttribute("data-lazy")?.trim() ||
            imageEl
              ?.getAttribute("srcset")
              ?.split(",")[0]
              ?.trim()
              .split(/\s+/)[0] ||
            null;
          const priceRaw =
            (el.querySelector(".prodPrice > span") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ??
            "";

          const addToCartLabel =
            (el.querySelector(".buttons a.buybt .label") as HTMLElement | null)?.innerText?.replace(/\s+/g, " ").trim() ??
            "";
          const stockText = addToCartLabel.toLowerCase();
          const inStock =
            stockText.length === 0 ||
            (!stockText.includes("yoxdur") && !stockText.includes("satildi") && !stockText.includes("bitib"));

          if (!title || !href || !priceRaw) return null;

          const listingKey = (() => {
            try {
              const u = new URL(href, "https://soliton.az");
              const path = u.pathname.replace(/\/+$/, "").toLowerCase();
              return path || `soliton-${idx}`;
            } catch {
              return href || `soliton-${idx}`;
            }
          })();

          return {
            listingKey,
            storeSlug: "soliton",
            titleRaw: title,
            productUrl: new URL(href, "https://soliton.az").toString(),
            imageUrl,
            categorySlug: payload.categorySlug,
            priceRaw,
            availabilityRaw: inStock ? "in_stock" : "out_of_stock",
            scrapedAt: payload.scrapedAtIso
          } as RawStoreItem;
        })
        .filter((item): item is RawStoreItem => Boolean(item)),
    { scrapedAtIso, categorySlug }
  );
  return rows;
}

async function parseItemsFromHtmlSnippet(
  page: Page,
  html: string,
  scrapedAtIso: string,
  categorySlug: string | null
): Promise<RawStoreItem[]> {
  const rows = (await page.evaluate(
    (payload: { html: string; scrapedAtIso: string; categorySlug: string | null }) => {
      const doc = new DOMParser().parseFromString(`<div id="root">${payload.html}</div>`, "text/html");
      const rows = Array.from(doc.querySelectorAll("#root .product-item"));

      return rows
        .map((node, idx) => {
          const title = node.querySelector("a.prodTitle")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
          const href = node.querySelector("a.prodTitle")?.getAttribute("href") ?? "";
          const imageEl =
            (node.querySelector(".thumbHolder img") as HTMLImageElement | null) ??
            (node.querySelector(".pic img:not(.hediyyePic)") as HTMLImageElement | null);
          const imageUrl =
            imageEl?.currentSrc?.trim() ||
            imageEl?.getAttribute("src")?.trim() ||
            imageEl?.getAttribute("data-src")?.trim() ||
            imageEl?.getAttribute("data-original")?.trim() ||
            imageEl?.getAttribute("data-lazy")?.trim() ||
            imageEl
              ?.getAttribute("srcset")
              ?.split(",")[0]
              ?.trim()
              .split(/\s+/)[0] ||
            null;
          const priceRaw = node.querySelector(".prodPrice > span")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
          const addToCartLabel = node
            .querySelector(".buttons a.buybt .label")
            ?.textContent?.replace(/\s+/g, " ")
            .trim() ?? "";

          const stockText = addToCartLabel.toLowerCase();
          const inStock =
            stockText.length === 0 ||
            (!stockText.includes("yoxdur") && !stockText.includes("satildi") && !stockText.includes("bitib"));

          if (!title || !href || !priceRaw) return null;

          const listingKey = (() => {
            try {
              const u = new URL(href, "https://soliton.az");
              const path = u.pathname.replace(/\/+$/, "").toLowerCase();
              return path || `soliton-${idx}`;
            } catch {
              return href || `soliton-${idx}`;
            }
          })();

          return {
            listingKey,
            storeSlug: "soliton",
            titleRaw: title,
            productUrl: new URL(href, "https://soliton.az").toString(),
            imageUrl,
            categorySlug: payload.categorySlug,
            priceRaw,
            availabilityRaw: inStock ? "in_stock" : "out_of_stock",
            scrapedAt: payload.scrapedAtIso
          };
        })
        .filter(Boolean);
    },
    { html, scrapedAtIso, categorySlug }
  )) as RawStoreItem[];

  return rows;
}

async function extractDetailSpecs(
  page: Page,
  productUrl: string,
  challengeRetries: number
): Promise<Record<string, string>> {
  await withRetry(
    async () => {
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1_500);
    },
    { attempts: 3, baseDelayMs: 1_000 }
  );

  for (let attempt = 0; attempt < challengeRetries; attempt += 1) {
    const title = await page.title();
    if (!/just a moment/i.test(title)) break;
    await page.waitForTimeout(3_000 + attempt * 1_500);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  }

  const specs = (await page.evaluate(`(() => {
    const out = {};
    const clean = (value) => String(value || "").replace(/\\s+/g, " ").replace(/[:]+$/, "").trim();
    const spans = Array.from(document.querySelectorAll(".specsNCommentsHolder .section.specs .specsList span"));

    for (const span of spans) {
      const raw = clean(span.textContent);
      if (!raw) continue;
      const idx = raw.indexOf(":");
      if (idx < 1) continue;
      const key = clean(raw.slice(0, idx));
      const value = clean(raw.slice(idx + 1));
      if (!key || !value) continue;
      out[key] = value;
    }

    return out;
  })()`)) as Record<string, string>;

  return specs;
}

async function enrichItemsWithDetailSpecs(
  ctx: Parameters<StoreScraper["scrape"]>[0],
  items: RawStoreItem[],
  options: {
    challengeRetries: number;
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
      const rawSpecs = await extractDetailSpecs(detailPage, item.productUrl, options.challengeRetries);
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
        "Soliton detail specs parse failed"
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

export const solitonScraper: StoreScraper = {
  storeSlug: STORE_SLUG,
  async scrape(ctx) {
    const categoryUrls = getCategoryUrls();
    const maxPages = toPositiveInt(process.env.SOLITON_MAX_PAGES_PER_CATEGORY, 6);
    const challengeRetries = toPositiveInt(process.env.SOLITON_CHALLENGE_RETRIES, 2);
    const detailEnabled = process.env.SOLITON_FETCH_DETAIL_SPECS !== "false";
    const detailDelayMs = toPositiveInt(process.env.SOLITON_DETAIL_DELAY_MS, 250);
    const maxItems = ctx.maxItems ?? Number.MAX_SAFE_INTEGER;
    const maxDetailItems = toPositiveInt(
      process.env.SOLITON_MAX_DETAIL_ITEMS,
      Number.isFinite(maxItems) && maxItems <= 400 ? maxItems : 120
    );

    const byListingKey = new Map<string, RawStoreItem>();
    const categoryErrors: string[] = [];
    let detailItemsProcessed = 0;

    for (const categoryUrl of categoryUrls) {
      const page = await ctx.pageFactory();
      await page.setExtraHTTPHeaders({
        "accept-language": "az,en-US;q=0.9,en;q=0.8"
      });

      try {
        const categorySlug = inferCategorySlug(categoryUrl);
        await loadCategory(page, categoryUrl);

        const productsPerPage = await page
          .locator("#products-list")
          .first()
          .getAttribute("data-products-per-page")
          .then((v) => toPositiveInt(v ?? "", 15));
        const sectionId = await page.locator("#products-list").first().getAttribute("data-section-id");
        const brandId = await page.locator("#products-list").first().getAttribute("data-brand-id");

        const initialItems = await parseItemsFromCurrentDom(page, new Date().toISOString(), categorySlug);
        if (detailEnabled && detailItemsProcessed < maxDetailItems) {
          detailItemsProcessed = await enrichItemsWithDetailSpecs(ctx, initialItems, {
            challengeRetries,
            maxDetailItems,
            detailDelayMs,
            detailItemsProcessed
          });
        }

        for (const item of initialItems) {
          item.productUrl = normalizeUrl(item.productUrl);
          item.imageUrl = item.imageUrl?.trim() ? normalizeUrl(item.imageUrl) : null;
          byListingKey.set(item.listingKey, item);
          if (byListingKey.size >= maxItems) return [...byListingKey.values()].slice(0, maxItems);
        }

        if (!sectionId) {
          throw new Error("Soliton category metadata (section-id) not found");
        }

        let offset = initialItems.length;
        for (let pageNo = 2; pageNo <= maxPages; pageNo += 1) {
          const response = await page.request.post(`${BASE_URL}/ajax-requests.php`, {
            form: {
              action: "loadProducts",
              sectionID: sectionId,
              brandID: brandId ?? "0",
              offset: String(offset),
              limit: String(productsPerPage),
              sorting: ""
            },
            timeout: 90_000
          });

          if (!response.ok()) {
            throw new Error(`Soliton ajax load failed with status=${response.status()}`);
          }

          const payload = (await response.json()) as {
            html?: string;
            loadedCount?: number;
            hasMore?: boolean;
          };
          if (!payload?.html?.trim()) break;

          const batchItems = await parseItemsFromHtmlSnippet(
            page,
            payload.html,
            new Date().toISOString(),
            categorySlug
          );
          if (!batchItems.length) break;

          if (detailEnabled && detailItemsProcessed < maxDetailItems) {
            detailItemsProcessed = await enrichItemsWithDetailSpecs(ctx, batchItems, {
              challengeRetries,
              maxDetailItems,
              detailDelayMs,
              detailItemsProcessed
            });
          }

          for (const item of batchItems) {
            item.productUrl = normalizeUrl(item.productUrl);
            item.imageUrl = item.imageUrl?.trim() ? normalizeUrl(item.imageUrl) : null;
            byListingKey.set(item.listingKey, item);
            if (byListingKey.size >= maxItems) return [...byListingKey.values()].slice(0, maxItems);
          }

          offset =
            typeof payload.loadedCount === "number" && payload.loadedCount > offset
              ? payload.loadedCount
              : offset + batchItems.length;
          if (!payload.hasMore) break;
          await page.waitForTimeout(900);
        }
      } catch (error) {
        const message = (error as Error).message;
        categoryErrors.push(`${categoryUrl} :: ${message}`);
        logger.warn({ store: STORE_SLUG, categoryUrl, error: message }, "Skipping Soliton category due scrape error");
      } finally {
        await page.close();
      }
    }

    const result = [...byListingKey.values()].slice(0, maxItems);
    if (!result.length) {
      throw new Error(categoryErrors[0] ?? "No products fetched from Soliton");
    }

    if (categoryErrors.length) {
      logger.warn({ store: STORE_SLUG, categoryErrors }, "Soliton scraper finished with partial category failures");
    }

    return result;
  }
};
