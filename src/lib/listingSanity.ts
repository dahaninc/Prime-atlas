/**
 * Stopgap sanity bounds against known, confirmed scraper corruption
 * (onthemarket rent-price parsing, zillow price/size_sqm/bedrooms parsing
 * — see the 2026-07-08 data-integrity audit, migrations 014/015, and the
 * scraper root-cause follow-up task). A corrupted value must never reach
 * a user-facing surface or a calculation.
 *
 * This is display-layer defense, not the fix — the scraper is still
 * writing bad rows on every run until the parser itself is corrected.
 * These bounds are deliberately generous: real luxury listings in this
 * platform's 32 in-scope markets should never approach them.
 */
export const MAX_SANE_PRICE = 5_000_000_000; // $50M / £50M, minor units — matches migration 015/017's ceiling. Was 5_000_000_00 ($5M, one zero short) until 2026-07-08 — wrongly nulled/excluded every real listing priced $5M-$50M (116 rows across 14 markets, confirmed by audit).
export const MIN_SANE_SIZE_SQM = 15;
export const MAX_SANE_SIZE_SQM = 2000;      // matches market_listing_stats' existing band
export const MAX_SANE_BEDROOMS = 20;

interface SanitizableRow {
  price?: number | null;
  size_sqm?: number | string | null;
  bedrooms?: number | null;
}

/**
 * Nulls out (never zeroes, never fabricates) any field outside a sane
 * bound, on a copy of the row — everything else passes through untouched.
 * Existing UI already renders these fields conditionally on `!= null`, so
 * a sanitized field disappears from the card/page rather than showing a
 * fabricated placeholder.
 */
export function sanitizeListingFields<T extends SanitizableRow>(row: T): T {
  const price = row.price != null && row.price > 0 && row.price <= MAX_SANE_PRICE ? row.price : null;
  const sizeNum = row.size_sqm != null ? Number(row.size_sqm) : null;
  const size_sqm = sizeNum != null && sizeNum >= MIN_SANE_SIZE_SQM && sizeNum <= MAX_SANE_SIZE_SQM ? row.size_sqm : null;
  const bedrooms = row.bedrooms != null && row.bedrooms > 0 && row.bedrooms <= MAX_SANE_BEDROOMS ? row.bedrooms : null;
  return { ...row, price, size_sqm, bedrooms };
}

/**
 * For list-style surfaces (market feed, comparables): a listing with no
 * price is closer to unusable than one worth showing as "unavailable" —
 * excluded rather than displayed broken. Bedrooms/size_sqm on surviving
 * rows are still individually nulled, not used to exclude the row.
 */
export function sanitizeListingRows<T extends SanitizableRow>(rows: T[]): T[] {
  return rows
    .filter((r) => r.price == null || (r.price > 0 && r.price <= MAX_SANE_PRICE))
    .map(sanitizeListingFields);
}
