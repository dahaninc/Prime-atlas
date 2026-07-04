"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Creates (or reactivates) a deal-alert rule for the signed-in member:
 * "email me when a new sale listing in this market is ≥15% below the
 * market's median price per sqm". RLS scopes everything to the caller.
 */
export async function createDealAlert(
  municipalityId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // One rule per user per market — reactivate if it already exists
  const { data: existing } = await supabase
    .from("deal_alert_rules")
    .select("id, active")
    .eq("user_id", user.id)
    .eq("municipality_id", municipalityId)
    .maybeSingle();

  if (existing) {
    if (existing.active) return { ok: true };
    const { error } = await supabase
      .from("deal_alert_rules")
      .update({ active: true })
      .eq("id", existing.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { error } = await supabase.from("deal_alert_rules").insert({
    user_id: user.id,
    municipality_id: municipalityId,
    listing_type: "sale",
    min_discount_pct: 15,
  });

  if (error) {
    console.error("[createDealAlert]", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteDealAlert(ruleId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("deal_alert_rules").delete().eq("id", ruleId);
  return { ok: !error };
}
