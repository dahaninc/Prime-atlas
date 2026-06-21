/**
 * daily-digest Edge Function
 * Schedule: 0 8 * * * (8am UTC daily) — set in Supabase Dashboard → Edge Functions → Schedule
 *
 * 1. Fetch signals published in last 24 hours
 * 2. Group by municipality
 * 3. Find Pro+ users with alert_frequency='daily' and email_alerts=true
 * 4. For each user, collect signals for their watched municipalities
 * 5. POST /api/alerts/send with type=daily_digest
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://prime-atlas.com";

Deno.serve(async (_req: Request) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Signals from last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: signals } = await supabase
    .from("signals")
    .select(`
      id, title, summary, ai_summary, signal_type, opportunity_impact,
      confidence_level, source, source_url, published_at, municipality_id,
      municipalities ( id, name, region, opportunity_score )
    `)
    .gte("published_at", since)
    .order("opportunity_impact", { ascending: false });

  if (!signals || signals.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no signals" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build municipality → signals map
  const byMuni: Record<string, typeof signals> = {};
  for (const s of signals) {
    if (!s.municipality_id) continue;
    byMuni[s.municipality_id] ??= [];
    byMuni[s.municipality_id].push(s);
  }
  const muniIds = Object.keys(byMuni);

  // 2. Find watchlist items for these municipalities
  const { data: items } = await supabase
    .from("watchlist_items")
    .select(`municipality_id, watchlists!inner ( user_id )`)
    .in("municipality_id", muniIds);

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no watchers" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // user_id → set of municipality_ids they watch
  const userMunis: Record<string, Set<string>> = {};
  for (const item of items) {
    const uid = (item.watchlists as { user_id: string }).user_id;
    userMunis[uid] ??= new Set();
    if (item.municipality_id) userMunis[uid].add(item.municipality_id);
  }

  // 3. Load profiles for these users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, subscription_tier, alert_preferences")
    .in("id", Object.keys(userMunis));

  if (!profiles) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Send one digest per qualifying user
  const sends: Promise<Response>[] = [];

  for (const profile of profiles) {
    if (profile.subscription_tier === "free") continue;
    const prefs = (profile.alert_preferences ?? {}) as {
      email_alerts?: boolean;
      signal_threshold?: number;
      alert_frequency?: string;
    };
    if (!prefs.email_alerts) continue;
    if (prefs.alert_frequency !== "daily") continue;

    const threshold = prefs.signal_threshold ?? 60;
    const watchedMunis = userMunis[profile.id];

    const userSignals = signals
      .filter(
        (s) =>
          s.municipality_id &&
          watchedMunis.has(s.municipality_id) &&
          s.opportunity_impact >= threshold
      )
      .map((s) => {
        const muni = s.municipalities as {
          name: string; region: string; opportunity_score: number;
        } | null;
        return {
          municipalityName:   muni?.name ?? "Unknown",
          municipalityRegion: muni?.region ?? "",
          municipalitySlug:   (muni?.name ?? "").toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, ""),
          signalTitle:        s.title,
          signalSummary:      s.ai_summary ?? s.summary,
          signalType:         s.signal_type,
          opportunityImpact:  s.opportunity_impact,
          confidenceLevel:    s.confidence_level,
          source:             s.source,
          sourceUrl:          s.source_url ?? undefined,
          opportunityScore:   muni?.opportunity_score ?? 0,
        };
      });

    if (userSignals.length === 0) continue;

    sends.push(
      fetch(`${APP_URL}/api/alerts/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          type: "daily_digest",
          recipient: { email: profile.email, name: profile.full_name ?? "" },
          signals: userSignals,
        }),
      })
    );
  }

  await Promise.allSettled(sends);

  return new Response(
    JSON.stringify({ sent: sends.length, signals_found: signals.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
