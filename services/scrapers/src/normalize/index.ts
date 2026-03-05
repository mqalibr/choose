import { buildProductFingerprint, normalizeProductTitle, slugify } from "@azcompare/shared";
import type { NormalizedItem, RawStoreItem } from "../core/types";
import { detectBrand } from "./brandDictionary";

function parsePriceAzn(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid price: ${raw}`);
  }
  return Number(value.toFixed(2));
}

function inferInStock(raw?: string | null): boolean {
  const text = raw?.toLowerCase() ?? "";
  if (!text) return true;
  return !text.includes("yoxdur") && !text.includes("out of stock");
}

export function normalizeItems(rawItems: RawStoreItem[]): NormalizedItem[] {
  const normalized = rawItems
    .map((raw) => {
      const normalizedTitle = normalizeProductTitle(raw.titleRaw);
      const brand = detectBrand(normalizedTitle);
      const fingerprint = buildProductFingerprint({
        brand,
        model: null,
        title: normalizedTitle
      });

      return {
        listingKey: raw.listingKey,
        storeSlug: raw.storeSlug,
        canonicalName: raw.titleRaw.trim(),
        normalizedTitle,
        fingerprint,
        brand,
        model: null,
        productSlug: slugify(normalizedTitle),
        productUrl: raw.productUrl,
        imageUrl: raw.imageUrl ?? null,
        categorySlug: raw.categorySlug ?? null,
        priceAzn: parsePriceAzn(raw.priceRaw),
        inStock: inferInStock(raw.availabilityRaw),
        scrapedAt: raw.scrapedAt
      } as NormalizedItem;
    })
    .filter((item) => item.productSlug.length > 2);

  const unique = new Map<string, NormalizedItem>();
  for (const item of normalized) {
    unique.set(`${item.storeSlug}|${item.listingKey}`, item);
  }

  return [...unique.values()];
}
