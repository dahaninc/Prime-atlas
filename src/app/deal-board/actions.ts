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
  // Scope to the caller even though RLS already enforces it — defense-in-depth
  // so a future switch to a service-role client can't silently become an IDOR.
  const { error } = await supabase
    .from("deal_alert_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", user.id);
  return { ok: !error };
}

/**
 * Persists a single Conviction Checklist tick for the signed-in member —
 * one row per checked item, keyed (user, market, checklist item). Toggling
 * off deletes the row. RLS scopes everything to the caller.
 */
export async function setChecklistItem(
  municipalityId: string,
  checklistKey: string,
  checked: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (checked) {
    const { error } = await supabase.from("deal_checklist_items").upsert(
      { user_id: user.id, municipality_id: municipalityId, checklist_key: checklistKey },
      { onConflict: "user_id,municipality_id,checklist_key" }
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("deal_checklist_items")
      .delete()
      .eq("user_id", user.id)
      .eq("municipality_id", municipalityId)
      .eq("checklist_key", checklistKey);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
