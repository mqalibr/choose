import { normalizeProductTitle } from "./text";

export function buildProductFingerprint(input: {
  brand?: string | null;
  model?: string | null;
  title: string;
}): string {
  const brand = input.brand?.trim().toLowerCase() ?? "";
  const model = input.model?.trim().toLowerCase() ?? "";
  const title = normalizeProductTitle(input.title);
  return [brand, model, title].filter(Boolean).join("|");
}
