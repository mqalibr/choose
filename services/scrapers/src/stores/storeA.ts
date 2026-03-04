import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

const STORE_SLUG = "store-a";
const CATEGORY_URLS = [
  "https://store-a.example/phones",
  "https://store-a.example/laptops"
];

export const storeAScraper: StoreScraper = {
  storeSlug: STORE_SLUG,
  async scrape(ctx) {
    const page = await ctx.pageFactory();
    const now = new Date().toISOString();
    const items: RawStoreItem[] = [];

    for (const url of CATEGORY_URLS) {
      await withRetry(
        async () => {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
          await page.waitForTimeout(800);
        },
        { attempts: 3 }
      );

      const rows = await page.$$eval(".product-card", (nodes) =>
        nodes.map((node) => {
          const link = node.querySelector("a.product-link") as HTMLAnchorElement | null;
          const title = (node.querySelector(".product-title") as HTMLElement | null)?.innerText ?? "";
          const price = (node.querySelector(".price") as HTMLElement | null)?.innerText ?? "";
          const stock = (node.querySelector(".stock") as HTMLElement | null)?.innerText ?? "";
          const image = (node.querySelector("img") as HTMLImageElement | null)?.src ?? null;

          return {
            title,
            price,
            stock,
            href: link?.href ?? "",
            image
          };
        })
      );

      for (const row of rows) {
        if (!row.title || !row.price || !row.href) continue;
        items.push({
          listingKey: row.href,
          storeSlug: STORE_SLUG,
          titleRaw: row.title,
          productUrl: row.href,
          imageUrl: row.image,
          priceRaw: row.price,
          availabilityRaw: row.stock,
          scrapedAt: now
        });
      }

      if (ctx.maxItems && items.length >= ctx.maxItems) {
        break;
      }
    }

    await page.close();
    return ctx.maxItems ? items.slice(0, ctx.maxItems) : items;
  }
};
