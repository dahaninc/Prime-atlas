/**
 * signal-alert Edge Function
 *
 * Triggered by Supabase Database Webhooks on INSERT to public.signals.
 * For each new signal:
 *   1. Find watchlist_items watching the affected municipality
 *   2. Load each watcher's profile + alert preferences
 *   3. If they want immediate alerts and the signal meets their threshold → send via /api/alerts/send
 *   4. Daily digest recipients are batched by a separate scheduled function
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://prime-atlas.com";

interface SignalRecord {
  id: string;
  municipality_id: string;
  title: string;
  summary: string;
  signal_type: string;
  opportunity_impact: number;
  confidence_level: number;
  source: string;
  source_url?: string;
  published_at: string;
}

interface AlertPreferences {
  email_alerts?: boolean;
  signal_threshold?: number;
  alert_frequency?: "immediate" | "daily" | "weekly";
}

Deno.serve(async (req: Request) => {
  // Supabase DB webhook sends a POST with { type, table, record, ... }
  let payload: { type: string; record: SignalRecord };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  // Only handle INSERT events
  if (payload.type !== "INSERT") {
    return new Response("ignored", { status: 200 });
  }

  const signal = payload.record;
  if (!signal?.municipality_id) {
    return new Response("no municipality_id", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Get municipality details
  const { data: municipality } = await supabase
    .from("municipalities")
    .select("id, name, region, opportunity_score")
    .eq("id", signal.municipality_id)
    .single();

  if (!municipality) {
    return new Response("municipality not found", { status: 200 });
  }

  const municipalitySlug = municipality.name
    .toLowerCase()
    .replace(/[\s']/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  // 2. Find all watchlist items watching this municipality
  const { data: watchlistItems } = await supabase
    .from("watchlist_items")
    .select(`
      id,
      watchlists!inner ( user_id )
    `)
    .eq("municipality_id", signal.municipality_id);

  if (!watchlistItems || watchlistItems.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Unique user IDs
  const userIds = [
    ...new Set(
      watchlistItems.map((item: { watchlists: { user_id: string } }) =>
        item.watchlists.user_id
      )
    ),
  ];

  // 3. Load profiles for all watchers
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, subscription_tier, alert_preferences")
    .in("id", userIds);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signalData = {
    municipalityName: municipality.name,
    municipalityRegion: municipality.region,
    municipalitySlug,
    signalTitle: signal.title,
    signalSummary: signal.summary,
    signalType: signal.signal_type,
    opportunityImpact: signal.opportunity_impact,
    confidenceLevel: signal.confidence_level,
    source: signal.source,
    sourceUrl: signal.source_url,
    opportunityScore: municipality.opportunity_score,
  };

  // 4. Send immediate alerts to qualifying users
  const sends: Promise<Response>[] = [];

  for (const profile of profiles) {
    // Only Pro subscribers get email alerts
    if (profile.subscription_tier === "free") continue;

    const prefs = (profile.alert_preferences ?? {}) as AlertPreferences;

    // Check alert preferences
    if (!prefs.email_alerts) continue;
    if ((prefs.signal_threshold ?? 60) > signal.opportunity_impact) continue;
    if (prefs.alert_frequency !== "immediate") continue; // daily handled separately

    sends.push(
      fetch(`${APP_URL}/api/alerts/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          type: "immediate",
          recipient: {
            email: profile.email,
            name: profile.full_name ?? "",
          },
          signal: signalData,
        }),
      })
    );
  }

  await Promise.allSettled(sends);

  return new Response(
    JSON.stringify({ sent: sends.length, municipality: municipality.name }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
