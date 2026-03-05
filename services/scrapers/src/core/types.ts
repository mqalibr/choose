import type { Browser, Page } from "playwright";

export interface RawStoreItem {
  listingKey: string;
  storeSlug: string;
  titleRaw: string;
  productUrl: string;
  imageUrl?: string | null;
  categorySlug?: string | null;
  priceRaw: string;
  availabilityRaw?: string | null;
  storeSku?: string | null;
  scrapedAt: string;
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
