const KNOWN_BRANDS = [
  "apple",
  "samsung",
  "xiaomi",
  "hp",
  "lenovo",
  "asus",
  "acer",
  "sony",
  "lg",
  "dell"
];

export function detectBrand(title: string): string | null {
  const lower = title.toLowerCase();
  return KNOWN_BRANDS.find((brand) => lower.includes(brand)) ?? null;
}
