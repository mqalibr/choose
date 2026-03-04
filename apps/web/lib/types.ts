export type SearchSort = "relevance" | "price_asc" | "price_desc" | "updated_desc";

export interface StoreRow {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
}

export interface ProductRow {
  id: number;
  slug: string;
  canonical_name: string;
  brand: string | null;
  model: string | null;
  image_url: string | null;
  category_id: number | null;
  last_price_at: string | null;
}

export interface ProductOffer {
  store_product_id: number;
  store_id: number;
  store_name: string;
  store_slug: string;
  product_id: number;
  current_price_azn: number;
  previous_price_azn: number | null;
  product_url: string;
  in_stock: boolean;
  price_updated_at: string;
}

export interface SearchProduct {
  id: number;
  slug: string;
  canonical_name: string;
  image_url: string | null;
  brand: string | null;
  min_price_azn: number | null;
  offer_count: number;
  last_price_at: string | null;
}

export interface StoreProductListItem {
  store_slug: string;
  store_name: string;
  slug: string;
  canonical_name: string;
  image_url: string | null;
  min_price_azn: number | null;
  price_updated_at: string | null;
}
