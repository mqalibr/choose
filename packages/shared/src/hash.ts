export function shortHash(input: string, length = 6): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(36).padStart(length, "0").slice(0, length);
}
