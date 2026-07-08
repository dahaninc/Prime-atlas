/**
 * Currency formatting — single source of truth.
 *
 * Extracted from DealBoard.tsx (2026-07-09) after a display bug in a
 * throwaway review-generation script hand-rolled its own price formatter
 * with a wrong divisor, showing $137,500 as $1.38M. The bug never touched
 * the real product (DealBoard.tsx's own fmt() was always correct), but the
 * fix that actually closes the failure mode is structural: a review
 * artifact must import the real formatter, not reimplement it, so it can
 * never again diverge from what the product shows. Any script generating a
 * "here's what the product outputs" artifact must import from here.
 */

export function symFor(code: string): string {
  return code === "GBP" ? "£" : "$";
}

/** `n` is major units (dollars/pounds), not minor units (cents/pence). */
export function fmt(n: number, sym: string): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `${sym}${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000 ? `${sym}${(abs / 1_000).toFixed(1)}K`
    : `${sym}${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}
