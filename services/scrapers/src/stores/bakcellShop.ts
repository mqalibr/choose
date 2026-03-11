import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const bakcellShopScraper = createCatalogSkeletonScraper({
  storeSlug: "bakcell-shop",
  baseUrl: "https://shop.bakcell.com",
  categoryUrlsEnvKey: "BAKCELL_SHOP_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://shop.bakcell.com",
    "https://shop.bakcell.com/telefonlar",
    "https://shop.bakcell.com/plansetler",
    "https://shop.bakcell.com/televizorlar"
  ],
  maxPagesEnvKey: "BAKCELL_SHOP_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "BAKCELL_SHOP_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "BAKCELL_SHOP_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "BAKCELL_SHOP_DETAIL_DELAY_MS",
  waitForSelector: ".product, .product-card, [data-product-id]"
});
