import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const bytelecomScraper = createCatalogSkeletonScraper({
  storeSlug: "bytelecom",
  baseUrl: "https://bytelecom.az",
  categoryUrlsEnvKey: "BYTELECOM_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://bytelecom.az",
    "https://bytelecom.az/telefonlar",
    "https://bytelecom.az/plansetler",
    "https://bytelecom.az/televizorlar"
  ],
  maxPagesEnvKey: "BYTELECOM_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "BYTELECOM_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "BYTELECOM_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "BYTELECOM_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
