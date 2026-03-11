import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const barkodElectronicsScraper = createCatalogSkeletonScraper({
  storeSlug: "barkod-electronics",
  baseUrl: "https://www.barkodelectronics.az",
  categoryUrlsEnvKey: "BARKOD_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://www.barkodelectronics.az",
    "https://www.barkodelectronics.az/telefonlar",
    "https://www.barkodelectronics.az/plansetler",
    "https://www.barkodelectronics.az/televizorlar"
  ],
  maxPagesEnvKey: "BARKOD_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "BARKOD_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "BARKOD_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "BARKOD_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
