import { createCatalogSkeletonScraper } from "./_catalogSkeleton";

export const smartElectronicsScraper = createCatalogSkeletonScraper({
  storeSlug: "smartelectronics",
  baseUrl: "https://smartelectronics.az",
  categoryUrlsEnvKey: "SMARTELECTRONICS_CATEGORY_URLS",
  defaultCategoryUrls: [
    "https://smartelectronics.az/az/smartfon-ve-aksesuarlar",
    "https://smartelectronics.az/az/smartfon-ve-aksesuarlar/plansetler",
    "https://smartelectronics.az/az/tv--audio--foto-texnika/televizorlar"
  ],
  maxPagesEnvKey: "SMARTELECTRONICS_MAX_PAGES_PER_CATEGORY",
  fetchDetailSpecsEnvKey: "SMARTELECTRONICS_FETCH_DETAIL_SPECS",
  maxDetailItemsEnvKey: "SMARTELECTRONICS_MAX_DETAIL_ITEMS",
  detailDelayMsEnvKey: "SMARTELECTRONICS_DETAIL_DELAY_MS",
  waitForSelector: ".products__all, .product_card",
  cardSelectors: [".product_card", ".products__all_card_wrapper"],
  linkSelectors: ["a[href^='/az/mehsullar/']", "a[href*='/mehsullar/']", "a[href]"],
  titleSelectors: [".product_title p", ".product_title", "h3", "h2", "a[title]"],
  priceSelectors: [".product_price p[data-id]", ".product_price p", ".product_price span", ".price"],
  imageSelectors: [".product_img img", "img"],
  stockSelectors: [".product_btn", "[data-product-out-of-stock]"],
  loadMoreSelectors: [".product__list_load_more_btn", "button:has-text('Daha çox')"],
  nextPageSelectors: ["a.next", ".pagination .next a"]
});
