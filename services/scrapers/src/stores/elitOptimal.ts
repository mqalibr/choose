import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const elitOptimalScraper = createCatalogSkeletonScraper({
  storeSlug: "elit-optimal",
  baseUrl: "https://elitoptimal.az",
  categoryUrlsEnvKey: "ELIT_OPTIMAL_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://elitoptimal.az",
    "https://elitoptimal.az/telefonlar",
    "https://elitoptimal.az/plansetler",
    "https://elitoptimal.az/televizorlar"
  ],
  maxPagesEnvKey: "ELIT_OPTIMAL_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "ELIT_OPTIMAL_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "ELIT_OPTIMAL_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "ELIT_OPTIMAL_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
