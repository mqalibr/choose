import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const megamartScraper = createCatalogSkeletonScraper({
  storeSlug: "megamart",
  baseUrl: "https://megamart.az",
  categoryUrlsEnvKey: "MEGAMART_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://megamart.az",
    "https://megamart.az/telefonlar",
    "https://megamart.az/plansetler",
    "https://megamart.az/televizorlar"
  ],
  maxPagesEnvKey: "MEGAMART_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "MEGAMART_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "MEGAMART_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "MEGAMART_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
