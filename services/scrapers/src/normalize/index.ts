import { buildProductFingerprint, normalizeProductTitle, slugify } from "@azcompare/shared";
import type { NormalizedItem, RawStoreItem } from "../core/types";
import { detectBrand } from "./brandDictionary";
import { parsePhoneSpecs } from "./phoneSpecs";

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

type CategorySlug = "telefonlar" | "televizorlar" | "noutbuklar" | "plansetler";
type TitleClass = CategorySlug | "other" | "unknown";

const PHONE_COLOR_TOKENS = new Set([
  "black",
  "white",
  "blue",
  "red",
  "green",
  "gray",
  "grey",
  "silver",
  "gold",
  "pink",
  "purple",
  "yellow",
  "orange",
  "midnight",
  "starlight",
  "titanium",
  "desert",
  "velvet",
  "ocean",
  "forest",
  "space",
  "graphite",
  "moonlight",
  "sunrise",
  "cyan",
  "teal",
  "qara",
  "ag",
  "goy",
  "qirmizi",
  "yasil",
  "boz",
  "gumus",
  "qizili",
  "benovseyi",
  "bej"
]);

const PHONE_NOISE_TOKENS = new Set([
  "new",
  "global",
  "version",
  "official",
  "smartfon",
  "telefon",
  "phone",
  "model",
  "dual",
  "single",
  "sim",
  "nano",
  "esim",
  "nfc",
  "lte",
  "5g"
]);

function normalizeForCategory(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\u0259/g, "e")
    .replace(/\u0131/g, "i")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00e7/g, "c")
    .replace(/\u011f/g, "g")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toAsciiLower(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\u0259/g, "e")
    .replace(/\u0131/g, "i")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00e7/g, "c")
    .replace(/\u011f/g, "g");
}

function parsePhoneMemoryFromTitle(title: string): { ramGb: number | null; storageGb: number | null } {
  const ascii = toAsciiLower(title);
  const pair = ascii.match(/\b(\d{1,2})\s*(?:gb)?\s*\/\s*(\d{2,4})\s*gb\b/);
  if (pair) {
    return {
      ramGb: Number(pair[1]),
      storageGb: Number(pair[2])
    };
  }

  const allGb = [...ascii.matchAll(/\b(\d{1,4})\s*gb\b/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));

  const ramGb = allGb.find((n) => n >= 1 && n <= 24) ?? null;
  const storageGb = allGb.find((n) => n >= 32) ?? null;

  return { ramGb, storageGb };
}

function derivePhoneModelKey(
  normalizedTitle: string,
  brand: string | null,
  phoneSpecs: NormalizedItem["phoneSpecs"]
): string | null {
  const ascii = toAsciiLower(normalizedTitle)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bsm-[a-z0-9-]+\b/g, " ")
    .replace(/\b\d{1,2}\s*\/\s*\d{2,4}\s*gb\b/g, " ")
    .replace(/\b\d{1,4}\s*gb\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = ascii
    .split(" ")
    .filter(Boolean)
    .filter((token) => !PHONE_COLOR_TOKENS.has(token))
    .filter((token) => !PHONE_NOISE_TOKENS.has(token));

  if (!tokens.length) {
    return null;
  }

  const normalizedBrand = brand?.trim().toLowerCase() ?? null;
  if (normalizedBrand) {
    while (tokens.length && tokens[0] === normalizedBrand) {
      tokens.shift();
    }
  }

  const modelBase = tokens.slice(0, 6).join(" ").trim();
  if (!modelBase) {
    return null;
  }

  const titleMemory = parsePhoneMemoryFromTitle(normalizedTitle);
  const ramGb = phoneSpecs?.ramGb ?? titleMemory.ramGb ?? null;
  const storageGb = phoneSpecs?.storageGb ?? titleMemory.storageGb ?? null;

  const parts = [modelBase];
  if (ramGb) parts.push(`${ramGb}gb`);
  if (storageGb) parts.push(`${storageGb}gb`);

  return parts.join(" ").trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function classifyTitleGroup(title: string): TitleClass {
  const text = normalizeForCategory(title);
  const raw = title.toLowerCase();

  const hasInchPattern =
    /\b([2-9]\d)\s?(?:\"|inch|inc)\b/.test(raw) ||
    (/(\b[2-9]\d\b)/.test(text) && /\b(tv|televizor|qled|oled|uhd|smart)\b/.test(text));
  const hasPhoneMemoryPattern = /\b\d{1,3}\s*\/\s*\d{2,4}\s*gb\b/.test(text);
  const hasRamRomPattern = /\b(4|6|8|12|16)\s*gb\b/.test(text) && /\b(64|128|256|512|1024)\s*gb\b/.test(text);

  if (
    includesAny(text, [
      "watch",
      "saat",
      "case",
      "cover",
      "casing",
      "qab",
      "adapter",
      "charger",
      "kabel",
      "cable",
      "powerbank",
      "backpack",
      "cant",
      "earbuds",
      "buds",
      "headset",
      "domofon",
      "console stick",
      "game console",
      "racing wheel",
      "qulaqliq",
      "airpods",
      "headphone",
      "playstation",
      "xbox",
      "gran turismo",
      "tava",
      "qazan",
      "blender",
      "mixer",
      "utu",
      "iron",
      "kettle",
      "caydan",
      "tozsoran",
      "vacuum",
      "kitchen",
      "air fryer",
      "fritoz",
      "soyuducu",
      "paltaryuyan",
      "qabyuyan",
      "mikrodalga",
      "mikrodalqa",
      "midea",
      "tefal",
      "fakir",
      "optiss",
      "indiksion",
      "dispenser",
      "parca",
      "set ",
      "kondisioner",
      "kondisioner",
      "aspirator",
      "soba",
      "ofen",
      "toster"
    ])
  ) {
    return "other";
  }

  if (
    includesAny(text, [
      "televizor",
      "smart tv",
      "qled",
      "oled",
      "uhd",
      "android tv",
      "led tv",
      " tv "
    ]) ||
    hasInchPattern
  ) {
    return "televizorlar";
  }

  if (
    includesAny(text, [
      "notbuk",
      "laptop",
      "macbook",
      "magic book",
      "magicbook",
      "matebook",
      "vivobook",
      "thinkpad",
      "thinkbook",
      "ideapad",
      "pavilion",
      "omen",
      "rog",
      "swift",
      "latitude",
      "inspiron"
    ])
  ) {
    return "noutbuklar";
  }

  if (includesAny(text, ["planset", "tablet", "ipad", "galaxy tab", "xiaomi pad"])) {
    return "plansetler";
  }
  if (
    includesAny(text, [
      "honor pad",
      "matepad",
      "lenovo tab",
      "galaxy tab",
      "xiaomi pad",
      "redmi pad",
      "ipad",
      " tab "
    ])
  ) {
    return "plansetler";
  }

  const hasPhoneSeries = includesAny(text, [
    "iphone",
    "phone",
    "telefon",
    "smartfon",
    "nokia",
    "honor x",
    "honor magic",
    "honor 4",
    "honor 5",
    "honor 6",
    "honor 7",
    "honor 8",
    "honor 9",
    "galaxy a",
    "galaxy s",
    "galaxy z",
    "redmi note",
    "redmi",
    "poco",
    "realme",
    "infinix",
    "tecno",
    "motorola",
    "pixel"
  ]);
  const hasPhoneModelCode = /\b(sm-[a-z0-9]+)\b/.test(text);
  const hasPhoneBrand = includesAny(text, [
    "iphone",
    "samsung",
    "xiaomi",
    "redmi",
    "poco",
    "honor",
    "oppo",
    "realme",
    "nokia",
    "infinix",
    "tecno",
    "motorola",
    "pixel"
  ]);
  const hasTabletOrLaptopToken = includesAny(text, [
    "pad",
    "tab",
    "planset",
    "tablet",
    "notbuk",
    "laptop",
    "macbook",
    "vivobook",
    "thinkpad",
    "ideapad"
  ]);

  if (
    (hasPhoneSeries || hasPhoneModelCode || (hasPhoneBrand && (hasPhoneMemoryPattern || hasRamRomPattern))) &&
    !hasTabletOrLaptopToken
  ) {
    return "telefonlar";
  }

  return "unknown";
}

function resolveCategorySlug(rawSlug: string | null | undefined, title: string, _priceAzn: number): string | null {
  const categorySlug = (rawSlug ?? null) as CategorySlug | null;
  if (!categorySlug) {
    const titleClass = classifyTitleGroup(title);
    return titleClass === "unknown" || titleClass === "other" ? null : titleClass;
  }

  const titleClass = classifyTitleGroup(title);
  if (titleClass === categorySlug) return categorySlug;
  if (titleClass === "other") return null;
  if (titleClass !== "unknown") return titleClass;

  // Unknown titles should not be auto-kept by source URL category.
  return null;
}

export function normalizeItems(rawItems: RawStoreItem[]): NormalizedItem[] {
  const normalized = rawItems
    .map((raw) => {
      const priceAzn = parsePriceAzn(raw.priceRaw);
      const normalizedTitle = normalizeProductTitle(raw.titleRaw);
      const brand = detectBrand(normalizedTitle);
      const categorySlug = resolveCategorySlug(raw.categorySlug, raw.titleRaw, priceAzn);
      const phoneSpecs =
        categorySlug === "telefonlar"
          ? parsePhoneSpecs({
              titleRaw: raw.titleRaw,
              normalizedTitle,
              rawSpecs: raw.specsRaw ?? null
            })
          : null;
      const model = categorySlug === "telefonlar" ? derivePhoneModelKey(normalizedTitle, brand, phoneSpecs) : null;
      const fingerprintTitle = categorySlug === "telefonlar" ? model ?? normalizedTitle : normalizedTitle;
      const fingerprint = buildProductFingerprint({
        brand,
        model,
        title: fingerprintTitle
      });

      return {
        listingKey: raw.listingKey,
        storeSlug: raw.storeSlug,
        canonicalName: raw.titleRaw.trim(),
        normalizedTitle,
        fingerprint,
        brand,
        model,
        productSlug: slugify(normalizedTitle),
        productUrl: raw.productUrl,
        imageUrl: raw.imageUrl?.trim() ? raw.imageUrl.trim() : null,
        categorySlug,
        rawSpecs: raw.specsRaw ?? null,
        phoneSpecs,
        priceAzn,
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


