const TOKEN_NOISE = new Set([
  "new",
  "original",
  "official",
  "qara",
  "ag",
  "blue",
  "black",
  "white"
]);

export function normalizeProductTitle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .split(" ")
    .filter((token) => token && !TOKEN_NOISE.has(token))
    .join(" ");
}
