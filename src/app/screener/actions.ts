"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  normalizeTier, getEntitlements, checkScreenerQuota, canParseOm, canExportScreenerDoc,
} from "@/lib/entitlements";

/**
 * Analyses used this calendar month, tier-driven cap, and whether the free
 * quota is activated (free tier requires a card on file — set only by
 * Stripe webhook / setup-confirm, never client-writable). All caps come
 * from src/lib/entitlements.ts — the single source of truth.
 */
export async function getQuota(): Promise<{
  used: number; unlimited: boolean; limit: number | null; cardOnFile: boolean;
  tier: ReturnType<typeof normalizeTier>; canParseOm: boolean; canExportDoc: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      used: 0, unlimited: false, limit: getEntitlements("free").screenerRunsPerMonth,
      cardOnFile: false, tier: "free", canParseOm: false, canExportDoc: false,
    };
  }

  const { data: profile } = await supabase
    .from("profiles").select("subscription_tier, payment_method_on_file").eq("id", user.id).single();
  const tier = normalizeTier(profile?.subscription_tier);
  const quota = await checkScreenerQuota(supabase, user.id, tier);

  return {
    used: quota.used,
    unlimited: quota.limit === null,
    limit: quota.limit,
    cardOnFile: tier !== "free" || (profile?.payment_method_on_file ?? false),
    tier,
    canParseOm: canParseOm(tier),
    canExportDoc: canExportScreenerDoc(tier),
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
}): Promise<{ ok: boolean; error?: string; remaining?: number; id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: profile } = await supabase
    .from("profiles").select("subscription_tier, payment_method_on_file").eq("id", user.id).single();
  const tier = normalizeTier(profile?.subscription_tier);
  const cardOnFile = tier !== "free" || (profile?.payment_method_on_file ?? false);
  if (!cardOnFile) {
    return { ok: false, error: "card_required" };
  }
  const quota = await checkScreenerQuota(supabase, user.id, tier);
  if (!quota.allowed) {
    return { ok: false, error: "quota_exceeded" };
  }

  const { data, error } = await supabase.from("screener_analyses").insert({
    user_id: user.id,
    criteria_id: input.criteria_id,
    name: input.name || "Untitled analysis",
    country: "United States",
    inputs: input.inputs,
    outputs: input.outputs,
    scorecard: input.scorecard as never,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/screener");
  return { ok: true, id: data.id, remaining: quota.limit === null ? -1 : Math.max(0, quota.limit - (quota.used + 1)) };
}
