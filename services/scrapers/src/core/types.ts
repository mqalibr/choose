import type { Browser, Page } from "playwright";

export interface RawStoreItem {
  listingKey: string;
  storeSlug: string;
  titleRaw: string;
  productUrl: string;
  imageUrl?: string | null;
  specsRaw?: Record<string, unknown> | null;
  categorySlug?: string | null;
  priceRaw: string;
  availabilityRaw?: string | null;
  storeSku?: string | null;
  scrapedAt: string;
}

export interface PhoneSpecsData {
  batteryMah?: number | null;
  hasNfc?: boolean | null;
  ramGb?: number | null;
  storageGb?: number | null;
  chipsetVendor?: string | null;
  chipsetModel?: string | null;
  cpuCores?: number | null;
  gpuModel?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  simCount?: number | null;
  hasEsim?: boolean | null;
  hasWifi6?: boolean | null;
  bluetoothVersion?: string | null;
  mainCameraMp?: number | null;
  ultrawideCameraMp?: number | null;
  telephotoCameraMp?: number | null;
  selfieCameraMp?: number | null;
  hasOis?: boolean | null;
  hasWirelessCharge?: boolean | null;
  wiredChargeW?: number | null;
  wirelessChargeW?: number | null;
  has5g?: boolean | null;
  screenSizeIn?: number | null;
  refreshRateHz?: number | null;
  panelType?: string | null;
  resolutionWidth?: number | null;
  resolutionHeight?: number | null;
  weightG?: number | null;
  ipRating?: string | null;
  releaseYear?: number | null;
  specsConfidence?: number | null;
  rawSpecs?: Record<string, unknown> | null;
}

export interface NormalizedItem {
  listingKey: string;
  storeSlug: string;
  canonicalName: string;
  normalizedTitle: string;
  fingerprint: string;
  brand?: string | null;
  model?: string | null;
  productSlug: string;
  productUrl: string;
  imageUrl?: string | null;
  categorySlug?: string | null;
  rawSpecs?: Record<string, unknown> | null;
  phoneSpecs?: PhoneSpecsData | null;
  priceAzn: number;
  inStock: boolean;
  scrapedAt: string;
}

export interface StoreScraper {
  storeSlug: string;
  scrape: (ctx: ScraperContext) => Promise<RawStoreItem[]>;
}

export interface ScraperContext {
  browser: Browser;
  pageFactory: () => Promise<Page>;
  maxItems?: number;
}

export interface ScrapeResult {
  storeSlug: string;
  totalFetched: number;
  totalNormalized: number;
  insertedPrices: number;
  changedPrices: number;
  deactivatedListings: number;
  errors: string[];
}
