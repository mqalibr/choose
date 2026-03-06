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

export interface ProductPhoneSpecs {
  product_id: number;
  battery_mah: number | null;
  has_nfc: boolean | null;
  ram_gb: number | null;
  storage_gb: number | null;
  chipset_vendor: string | null;
  chipset_model: string | null;
  cpu_cores: number | null;
  gpu_model: string | null;
  os_name: string | null;
  os_version: string | null;
  sim_count: number | null;
  has_esim: boolean | null;
  has_wifi_6: boolean | null;
  bluetooth_version: string | null;
  main_camera_mp: number | null;
  ultrawide_camera_mp: number | null;
  telephoto_camera_mp: number | null;
  selfie_camera_mp: number | null;
  has_ois: boolean | null;
  has_wireless_charge: boolean | null;
  wired_charge_w: number | null;
  wireless_charge_w: number | null;
  has_5g: boolean | null;
  screen_size_in: number | null;
  refresh_rate_hz: number | null;
  panel_type: string | null;
  resolution_width: number | null;
  resolution_height: number | null;
  weight_g: number | null;
  ip_rating: string | null;
  release_year: number | null;
  last_parsed_at: string | null;
  raw_specs: Record<string, unknown> | null;
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
  brand_slug: string | null;
  min_price_azn: number | null;
  offer_count: number;
  last_price_at: string | null;
}

export interface CategoryBrandFacet {
  category_id: number;
  brand: string;
  brand_slug: string;
  product_count: number;
}

export interface CategoryStoreFacet {
  category_id: number;
  store_slug: string;
  store_name: string;
  product_count: number;
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
