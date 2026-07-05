/**
 * Tier access + listing redaction helpers.
 *
 * Free-tier funnel rule: anonymous and free users see listings at
 * locality level only (city/county/region — never street address) and
 * zero property photos. Members (any paid tier) see everything.
 * Redaction happens SERVER-SIDE before data reaches the client — UI
 * lock badges are presentation, not enforcement.
 */

export const PAID_TIERS = ["explorer", "professional", "institutional"] as const;

export function isPaidTier(tier: string | null | undefined): boolean {
  return (PAID_TIERS as readonly string[]).includes(tier ?? "");
}

/** Unit/street indicators — any comma segment matching these is dropped. */
const STREET_WORD_RE =
  /\b(street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|court|ct|place|pl|terrace|close|crescent|way|walk|row|mews|gardens|grove|highway|hwy|circle|cir|trail|trl|parkway|pkwy|apt|apartment|flat|unit|suite|floor|penthouse|house)\b/i;
/** House/unit number: a digit run followed by a word ("166 Rockingham…"). */
const HOUSE_NUMBER_RE = /\d+\s+[a-z]/i;

/**
 * Strip street-level detail from an address, keeping locality only.
 * "12 Maple St, Austin, TX 78701"            → "Austin, TX 78701"
 * "Flat 2, 166 Rockingham St, Sheffield S2"  → "Sheffield S2"
 * "Maple Road, Peckham, London SE15"         → "Peckham, London SE15"
 * Every segment is tested — addresses that are all street (no locality
 * segment survives) redact to null rather than leak.
 */
export function redactStreet(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  // The first segment is always presumed street-level; the rest keep only
  // segments with no street words and no house/unit numbers.
  const locality = parts.slice(1).filter(
    (p) => !STREET_WORD_RE.test(p) && !HOUSE_NUMBER_RE.test(p)
  );
  return locality.length ? locality.join(", ") : null;
}

/** Redact listing rows for non-members: locality-only address, zero photos. */
export function redactRows<T extends { address?: string | null; images?: unknown }>(
  rows: T[],
  isMember: boolean,
): T[] {
  if (isMember) return rows;
  return rows.map((r) => ({ ...r, address: redactStreet(r.address ?? null), images: [] }));
}
