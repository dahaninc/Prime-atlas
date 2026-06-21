"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Watchlist CRUD ────────────────────────────────────────────────────────────

export async function createWatchlist(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("watchlists")
    .insert({ user_id: user.id, name: name.trim() || "My Watchlist" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/watchlists");
  return data;
}

export async function deleteWatchlist(watchlistId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("id", watchlistId)
    .eq("user_id", user.id); // RLS double-check

  if (error) throw new Error(error.message);
  revalidatePath("/watchlists");
}

// ─── Watchlist items ───────────────────────────────────────────────────────────

export async function addMunicipalityToWatchlist(watchlistId: string, municipalityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify the watchlist belongs to the user
  const { data: wl } = await supabase
    .from("watchlists")
    .select("id")
    .eq("id", watchlistId)
    .eq("user_id", user.id)
    .single();
  if (!wl) throw new Error("Watchlist not found");

  // Check not already added
  const { data: existing } = await supabase
    .from("watchlist_items")
    .select("id")
    .eq("watchlist_id", watchlistId)
    .eq("municipality_id", municipalityId)
    .single();
  if (existing) return; // already there — idempotent

  const { error } = await supabase
    .from("watchlist_items")
    .insert({ watchlist_id: watchlistId, municipality_id: municipalityId });

  if (error) throw new Error(error.message);
  revalidatePath("/watchlists");
}

export async function addOpportunityToWatchlist(watchlistId: string, opportunityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: wl } = await supabase
    .from("watchlists")
    .select("id")
    .eq("id", watchlistId)
    .eq("user_id", user.id)
    .single();
  if (!wl) throw new Error("Watchlist not found");

  const { error } = await supabase
    .from("watchlist_items")
    .insert({ watchlist_id: watchlistId, opportunity_id: opportunityId });

  if (error) throw new Error(error.message);
  revalidatePath("/watchlists");
}

export async function removeWatchlistItem(itemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // RLS handles ownership check via watchlist → user_id
  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);
  revalidatePath("/watchlists");
}

// Quick-add: find or create default watchlist, then add municipality
export async function quickAddMunicipality(municipalityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get or create default watchlist
  let { data: wl } = await supabase
    .from("watchlists")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .single();

  if (!wl) {
    const { data: created } = await supabase
      .from("watchlists")
      .insert({ user_id: user.id, name: "My Watchlist" })
      .select()
      .single();
    wl = created;
  }

  if (!wl) throw new Error("Could not create watchlist");
  await addMunicipalityToWatchlist(wl.id, municipalityId);
  return wl.id;
}

// ─── Alert preferences ─────────────────────────────────────────────────────────

export async function updateAlertPreferences(prefs: {
  email_alerts: boolean;
  signal_threshold: number;
  alert_frequency: "immediate" | "daily" | "weekly";
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ alert_preferences: prefs })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/watchlists");
  revalidatePath("/dashboard");
}
