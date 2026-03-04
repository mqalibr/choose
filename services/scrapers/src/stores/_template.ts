import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

const STORE_SLUG = "replace-with-store-slug";
const ENTRY_URLS = ["https://example.com/electronics"];

export const templateStoreScraper: StoreScraper = {
  storeSlug: STORE_SLUG,
  async scrape(ctx) {
    const page = await ctx.pageFactory();
    const scrapedAt = new Date().toISOString();
    const items: RawStoreItem[] = [];

    for (const url of ENTRY_URLS) {
      await withRetry(
        async () => {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
          await page.waitForTimeout(900);
        },
        { attempts: 3 }
      );

      const rows = await page.$$eval(".product-card", (nodes) =>
        nodes.map((node) => {
          const link = node.querySelector("a") as HTMLAnchorElement | null;
          const title = (node.querySelector(".title") as HTMLElement | null)?.innerText ?? "";
          const price = (node.querySelector(".price") as HTMLElement | null)?.innerText ?? "";
          const stock = (node.querySelector(".stock") as HTMLElement | null)?.innerText ?? "";
          const image = (node.querySelector("img") as HTMLImageElement | null)?.src ?? null;

          return {
            href: link?.href ?? "",
            title,
            price,
            stock,
            image
          };
        })
      );

      for (const row of rows) {
        if (!row.href || !row.title || !row.price) continue;
        items.push({
          listingKey: row.href,
          storeSlug: STORE_SLUG,
          titleRaw: row.title,
          productUrl: row.href,
          imageUrl: row.image,
          priceRaw: row.price,
          availabilityRaw: row.stock,
          scrapedAt
        });
      }
    }

    await page.close();
    return ctx.maxItems ? items.slice(0, ctx.maxItems) : items;
  }
};
