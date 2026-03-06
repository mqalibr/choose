const BRAND_PATTERNS: Array<{ brand: string; patterns: RegExp[] }> = [
  { brand: "apple", patterns: [/\bapple\b/, /\biphone\b/, /\bipad\b/] },
  { brand: "samsung", patterns: [/\bsamsung\b/, /\bgalaxy\b/] },
  { brand: "xiaomi", patterns: [/\bxiaomi\b/, /\bredmi\b/, /\bpoco\b/] },
  { brand: "honor", patterns: [/\bhonor\b/] },
  { brand: "oppo", patterns: [/\boppo\b/] },
  { brand: "realme", patterns: [/\brealme\b/] },
  { brand: "nokia", patterns: [/\bnokia\b/] },
  { brand: "infinix", patterns: [/\binfinix\b/] },
  { brand: "tecno", patterns: [/\btecno\b/] },
  { brand: "motorola", patterns: [/\bmotorola\b/, /\bmoto\b/] },
  { brand: "google", patterns: [/\bgoogle\b/, /\bpixel\b/] },
  { brand: "hp", patterns: [/\bhp\b/] },
  { brand: "lenovo", patterns: [/\blenovo\b/] },
  { brand: "asus", patterns: [/\basus\b/] },
  { brand: "acer", patterns: [/\bacer\b/] },
  { brand: "sony", patterns: [/\bsony\b/] },
  { brand: "lg", patterns: [/\blg\b/] },
  { brand: "dell", patterns: [/\bdell\b/] }
];

export function detectBrand(title: string): string | null {
  const lower = title.toLowerCase();
  for (const entry of BRAND_PATTERNS) {
    if (entry.patterns.some((rx) => rx.test(lower))) {
      return entry.brand;
    }
  }
  return null;
}
