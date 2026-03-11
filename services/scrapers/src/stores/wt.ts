import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const wtScraper = createCatalogSkeletonScraper({
  storeSlug: "w-t",
  baseUrl: "https://www.w-t.az",
  categoryUrlsEnvKey: "WT_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://www.w-t.az",
    "https://www.w-t.az/telefonlar",
    "https://www.w-t.az/plansetler",
    "https://www.w-t.az/televizorlar"
  ],
  maxPagesEnvKey: "WT_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "WT_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "WT_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "WT_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
