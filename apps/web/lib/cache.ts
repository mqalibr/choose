export const CACHE_SECONDS = {
  search: 120,
  product: 180,
  category: 180,
  store: 180
} as const;

export const CACHE_TAGS = {
  products: "products",
  categories: "categories",
  stores: "stores",
  offers: "offers"
} as const;
