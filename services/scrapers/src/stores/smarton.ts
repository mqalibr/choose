import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const smartonScraper = createCatalogSkeletonScraper({
  storeSlug: "smarton",
  baseUrl: "https://smarton.az",
  categoryUrlsEnvKey: "SMARTON_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://smarton.az",
    "https://smarton.az/telefonlar",
    "https://smarton.az/plansetler",
    "https://smarton.az/televizorlar"
  ],
  maxPagesEnvKey: "SMARTON_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "SMARTON_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "SMARTON_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "SMARTON_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
