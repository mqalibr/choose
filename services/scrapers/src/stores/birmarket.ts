import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const birmarketScraper = createCatalogSkeletonScraper({
  storeSlug: "birmarket",
  baseUrl: "https://birmarket.az",
  categoryUrlsEnvKey: "BIRMARKET_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://birmarket.az",
    "https://birmarket.az/telefonlar",
    "https://birmarket.az/plansetler",
    "https://birmarket.az/televizorlar"
  ],
  maxPagesEnvKey: "BIRMARKET_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "BIRMARKET_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "BIRMARKET_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "BIRMARKET_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
