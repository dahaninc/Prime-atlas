"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const FREE_LIMIT = 3;

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/**
 * Analyses used this calendar month, paid-tier status, and whether the free
 * quota is activated (free tier requires a card on file — set only by
 * Stripe webhook / setup-confirm, never client-writable).
 */
export async function getQuota(): Promise<{
  used: number; unlimited: boolean; limit: number; cardOnFile: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { used: 0, unlimited: false, limit: FREE_LIMIT, cardOnFile: false };

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("subscription_tier, payment_method_on_file").eq("id", user.id).single(),
    supabase.from("screener_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStartIso()),
  ]);
  const unlimited = (profile?.subscription_tier ?? "free") !== "free";
  return {
    used: count ?? 0,
    unlimited,
    limit: FREE_LIMIT,
    cardOnFile: unlimited || (profile?.payment_method_on_file ?? false),
  };
}

/** Upsert the user's (single, MVP) criteria profile. */
export async function saveCriteria(input: {
  name: string;
  target_cap_pct: number | null;
  min_dscr: number | null;
  max_price_per_unit: number | null;
  target_coc_pct: number | null;
  hold_years: number | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: existing } = await supabase
    .from("screener_criteria")
    .select("id").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();

  const row = { ...input, user_id: user.id, country: "United States", active: true };
  const q = existing
    ? supabase.from("screener_criteria").update(row).eq("id", existing.id).eq("user_id", user.id).select("id").single()
    : supabase.from("screener_criteria").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/screener");
  return { ok: true, id: data.id };
}

/** Persist an analysis — this is the metered unit (free tier: 3/month). */
export async function saveAnalysis(input: {
  name: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  scorecard: object[] | null;
  criteria_id: string | null;
}): Promise<{ ok: boolean; error?: string; remaining?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const quota = await getQuota();
  if (!quota.cardOnFile) {
    return { ok: false, error: "card_required" };
  }
  if (!quota.unlimited && quota.used >= quota.limit) {
    return { ok: false, error: "quota_exceeded" };
  }

  const { error } = await supabase.from("screener_analyses").insert({
    user_id: user.id,
    criteria_id: input.criteria_id,
    name: input.name || "Untitled analysis",
    country: "United States",
    inputs: input.inputs,
    outputs: input.outputs,
    scorecard: input.scorecard as never,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/screener");
  const used = quota.used + 1;
  return { ok: true, remaining: quota.unlimited ? -1 : Math.max(0, quota.limit - used) };
}
