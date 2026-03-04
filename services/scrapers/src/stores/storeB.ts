import { withRetry } from "../core/retry";
import type { RawStoreItem, StoreScraper } from "../core/types";

const STORE_SLUG = "store-b";
const LISTING_URL = "https://store-b.example/catalog/electronics";

export const storeBScraper: StoreScraper = {
  storeSlug: STORE_SLUG,
  async scrape(ctx) {
    const page = await ctx.pageFactory();
    const now = new Date().toISOString();

    await withRetry(
      async () => {
        await page.goto(LISTING_URL, { waitUntil: "networkidle", timeout: 45_000 });
        await page.waitForTimeout(1_000);
      },
      { attempts: 3 }
    );

    const items = await page.$$eval("article.catalog-item", (nodes) =>
      nodes.map((node) => {
        const link = node.querySelector("a") as HTMLAnchorElement | null;
        const title = (node.querySelector("h3") as HTMLElement | null)?.innerText ?? "";
        const price = (node.querySelector("[data-price]") as HTMLElement | null)?.innerText ?? "";
        const stock = (node.querySelector(".availability") as HTMLElement | null)?.innerText ?? "";
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

    await page.close();

    return items
      .filter((item) => item.title && item.price && item.href)
      .slice(0, ctx.maxItems ?? items.length)
      .map<RawStoreItem>((item) => ({
        listingKey: item.href,
        storeSlug: STORE_SLUG,
        titleRaw: item.title,
        productUrl: item.href,
        imageUrl: item.image,
        priceRaw: item.price,
        availabilityRaw: item.stock,
        scrapedAt: now
      }));
  }
};
