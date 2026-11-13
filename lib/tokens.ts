import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Length for public, unguessable links (scenarios, snapshots): 24 chars × log2(54) ≈ 138 bits. */
export const PUBLIC_TOKEN_LENGTH = 24;

/** URL-safe random token from a 54-char alphabet without look-alikes; rejection sampling avoids modulo bias. */
export function randomToken(length = PUBLIC_TOKEN_LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit) out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export function hmacSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
