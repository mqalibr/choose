import { timingSafeEqual } from "node:crypto";

function secureCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function isInternalRequestAuthorized(req: Request): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;

  const provided = req.headers.get("x-internal-key");
  if (!provided) return false;

  return secureCompare(provided, expected);
}
