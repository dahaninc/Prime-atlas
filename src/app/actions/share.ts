"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Create (or reuse) a read-only share link for a screener analysis or a
 * market report. Ownership is enforced by RLS: the ref row must be readable
 * by the caller's own client before a link is issued. Tokens are 144-bit
 * base64url capabilities — unguessable, revocable via share_links.revoked.
 */
export async function createShareLink(
  kind: "analysis" | "report",
  refId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  // Report sharing disabled for launch (2026-07-09): /reports/market still
  // computes its mispricing count from the blended metro median
  // (market_listing_stats.underpriced_count), not the ZIP-comp basis every
  // other surface (Deal Board, Market Feed, All Markets) now uses. A public
  // /s/[token] link could show a different "N underpriced" for the same
  // market than Deal Board does. Re-enable once /reports/market is migrated
  // onto the ZIP-comp engine (queued next). Screener-analysis sharing is
  // unaffected — different engine, no blended-median dependency — and stays
  // enabled.
  if (kind === "report") return { ok: false, error: "report_sharing_disabled" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Ownership check through RLS — returns a row only if the caller owns it.
  const table = kind === "analysis" ? "screener_analyses" : "deal_board_reports";
  const { data: ref } = await supabase.from(table).select("id").eq("id", refId).maybeSingle();
  if (!ref) return { ok: false, error: "not_found" };

  // Reuse an existing live link for the same artifact (idempotent shares).
  const { data: existing } = await supabase
    .from("share_links")
    .select("token")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .eq("ref_id", refId)
    .eq("revoked", false)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, path: `/s/${existing.token}` };

  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("share_links").insert({
    token, user_id: user.id, kind, ref_id: refId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: `/s/${token}` };
}
