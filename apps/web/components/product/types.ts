export interface ProductOfferPreview {
  store_name: string;
  price: number;
  stock: "Stokda var" | "Stokda yoxdur";
  link: string;
}

export interface ProductPricePoint {
  date: string;
  price: number;
}

export interface SimilarProductPreview {
  name: string;
  image: string;
  link: string;
}

export interface ProductSpecsPreview {
  battery_mah?: number | null;
  has_nfc?: boolean | null;
  ram_gb?: number | null;
  storage_gb?: number | null;
  chipset_vendor?: string | null;
  chipset_model?: string | null;
  cpu_cores?: number | null;
  gpu_model?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  sim_count?: number | null;
  has_esim?: boolean | null;
  has_wifi_6?: boolean | null;
  bluetooth_version?: string | null;
  main_camera_mp?: number | null;
  ultrawide_camera_mp?: number | null;
  telephoto_camera_mp?: number | null;
  selfie_camera_mp?: number | null;
  has_ois?: boolean | null;
  has_wireless_charge?: boolean | null;
  wired_charge_w?: number | null;
  wireless_charge_w?: number | null;
  has_5g?: boolean | null;
  screen_size_in?: number | null;
  refresh_rate_hz?: number | null;
  panel_type?: string | null;
  resolution_width?: number | null;
  resolution_height?: number | null;
  weight_g?: number | null;
  ip_rating?: string | null;
  release_year?: number | null;
  last_parsed_at?: string | null;
  raw_specs?: Record<string, unknown> | null;
}

export interface ProductPreview {
  name: string;
  images: string[];
  offers: ProductOfferPreview[];
  price_history: ProductPricePoint[];
  similar_products: SimilarProductPreview[];
  last_updated_at?: string | null;
  specs?: ProductSpecsPreview | null;
}
