/**
 * Entitlements — single source of truth for tier-gated capabilities.
 *
 * Every route/server action that gates a feature or a numeric cap by
 * subscription tier reads from this module. Do not re-implement a tier
 * check locally (that's how screener/actions.ts, contact-request/route.ts
 * and export/ic-memo/route.ts drifted out of sync with the pricing page).
 *
 * Numeric caps below were confirmed 2026-07-07 (Explorer screener runs = 5;
 * all other caps as originally proposed).
 *
 * NOT enforced here: `seats`. There is no team/org/invite schema — a seat
 * count has nothing to attach to. Descoped from enforcement for this pass
 * per product decision; pricing copy must not claim an enforced seat count
 * until team support ships (tracked as a follow-up).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Tier = Database["public"]["Enums"]["subscription_tier"];

const TIER_ORDER: Tier[] = ["free", "explorer", "professional", "institutional"];

export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Unknown/missing tier values fail closed to "free". */
export function normalizeTier(tier: string | null | undefined): Tier {
  return (TIER_ORDER as string[]).includes(tier ?? "") ? (tier as Tier) : "free";
}

export interface TierEntitlements {
  /** Real (non-teaser) underpriced listings shown before the locked state kicks in. null = full feed. */
  underpricedListingLimit: number | null;
  /** Screener analyses (manual saves + OM parses) per calendar month. null = unlimited. */
  screenerRunsPerMonth: number | null;
  /** Can drop an OM / rent-roll / T12 PDF and get a parsed pro-forma prefill. */
  omParsingEnabled: boolean;
  /** Can export a single Screener analysis as a forwardable PDF/doc (Phase B builds the export itself). */
  screenerExportEnabled: boolean;
  /** Bulk CSV/Excel data export — the Institutional-only differentiator. */
  bulkExportEnabled: boolean;
  /** Contact/agent-detail reveals per calendar month. null = unlimited. */
  contactRevealsPerMonth: number | null;
  /** Seats included. Display value only — see module header. null = unlimited/pooled. */
  seats: number | null;
}

export const ENTITLEMENTS: Record<Tier, TierEntitlements> = {
  free: {
    underpricedListingLimit: 0,        // unchanged: aggregate stats + waitlist only, no real listings
    screenerRunsPerMonth: 3,           // unchanged: existing FREE_LIMIT, still requires card-on-file (mig 008)
    omParsingEnabled: false,           // CHANGE: free can currently parse once card-activated; new spec reserves parsing for Professional+
    screenerExportEnabled: false,
    bulkExportEnabled: false,
    contactRevealsPerMonth: 0,         // unchanged: contact-request already 403s below "member"
    seats: 1,
  },
  explorer: {
    underpricedListingLimit: 3,        // "top N results" teaser
    screenerRunsPerMonth: 5,           // CHANGE: today unlimited once paid; now a hard entry-tier cap
    omParsingEnabled: false,
    screenerExportEnabled: false,
    bulkExportEnabled: false,
    contactRevealsPerMonth: 10,        // matches existing pricing-page copy ("10 contact reveals per month")
    seats: 1,
  },
  professional: {
    underpricedListingLimit: null,     // full feed
    screenerRunsPerMonth: 100,         // CHANGE: today this is unlimited (unlimited = tier !== "free")
    omParsingEnabled: true,
    screenerExportEnabled: true,       // Phase B builds the export UI; flag defined now so B just consumes it
    bulkExportEnabled: false,
    contactRevealsPerMonth: 100,       // CHANGE: pricing page currently promises "Unlimited" for Professional
    seats: 3,                          // NOT enforced, see module header
  },
  institutional: {
    underpricedListingLimit: null,
    screenerRunsPerMonth: null,
    omParsingEnabled: true,
    screenerExportEnabled: true,
    bulkExportEnabled: true,           // the one Institutional-exclusive differentiator
    contactRevealsPerMonth: null,
    seats: null,                       // "pooled/unlimited" — NOT enforced, see module header
  },
};

export function getEntitlements(tier: string | null | undefined): TierEntitlements {
  return ENTITLEMENTS[normalizeTier(tier)];
}

/* ── Pure quota decision — no I/O, fully unit-testable ──────────────────── */

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number | null;      // null = unlimited
  remaining: number | null;  // null = unlimited
}

export function evaluateQuota(used: number, limit: number | null): QuotaStatus {
  if (limit === null) return { allowed: true, used, limit: null, remaining: null };
  return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

/* ── Server-side counting — caller supplies an authenticated client ─────── */
/* Both tables carry a RLS SELECT policy scoped to auth.uid() = user_id, so  */
/* counting works against the regular session-bound server client — no      */
/* service-role client required for these checks.                          */

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function countThisMonth(
  supabase: SupabaseClient<Database>,
  table: "screener_analyses" | "contact_requests",
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStartIso());
  return count ?? 0;
}

export async function checkScreenerQuota(
  supabase: SupabaseClient<Database>,
  userId: string,
  tier: string | null | undefined,
): Promise<QuotaStatus> {
  const { screenerRunsPerMonth } = getEntitlements(tier);
  const used = await countThisMonth(supabase, "screener_analyses", userId);
  return evaluateQuota(used, screenerRunsPerMonth);
}

export async function checkContactRevealQuota(
  supabase: SupabaseClient<Database>,
  userId: string,
  tier: string | null | undefined,
): Promise<QuotaStatus> {
  const { contactRevealsPerMonth } = getEntitlements(tier);
  const used = await countThisMonth(supabase, "contact_requests", userId);
  return evaluateQuota(used, contactRevealsPerMonth);
}

/* ── Boolean feature gates ───────────────────────────────────────────────── */

export function canParseOm(tier: string | null | undefined): boolean {
  return getEntitlements(tier).omParsingEnabled;
}

export function canExportScreenerDoc(tier: string | null | undefined): boolean {
  return getEntitlements(tier).screenerExportEnabled;
}

export function canBulkExport(tier: string | null | undefined): boolean {
  return getEntitlements(tier).bulkExportEnabled;
}

export function underpricedListingLimit(tier: string | null | undefined): number | null {
  return getEntitlements(tier).underpricedListingLimit;
}
