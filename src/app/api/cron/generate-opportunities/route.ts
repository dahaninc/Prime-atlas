/**
 * GET /api/cron/generate-opportunities?markets=6&per=3
 * Auth: Bearer CRON_SECRET
 *
 * Fills opportunity coverage: every US/UK market should carry `per` active
 * opportunities. For each under-covered market, Claude writes grounded
 * macro/micro investment theses from the market's OWN live data — conviction
 * scores, listing statistics, cheapest-per-sqm live listings, recent signals.
 * The model is instructed to cite only supplied figures (never invent
 * addresses or prices); evidence records exactly what it was grounded on.
 * Analysis, not advice — the thesis format mirrors the human-curated rows.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CATEGORIES = ["BTR", "PBSA", "Commercial", "Industrial", "Mixed-use", "Land & Development", "Affordable Housing"];

interface GeneratedOpp {
  title: string;
  category: string;
  investment_thesis: string;
  opportunity_score: number;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "anthropic_unconfigured" }, { status: 503 });

  const perMarket = Math.min(3, Math.max(1, Number(req.nextUrl.searchParams.get("per") ?? 3)));
  const maxMarkets = Math.min(10, Math.max(1, Number(req.nextUrl.searchParams.get("markets") ?? 6)));
  const deadline = Date.now() + 270_000; // leave headroom under maxDuration

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const [{ data: munis }, { data: opps }, { data: stats }] = await Promise.all([
    supabase
      .from("municipalities")
      .select("id, name, region, country, currency_code, population, opportunity_score, growth_score, risk_score, development_score, infrastructure_score, liquidity_score")
      .in("country", ["United States", "United Kingdom"]),
    supabase.from("opportunities").select("municipality_id").eq("status", "active"),
    supabase.from("market_listing_stats").select("municipality_id, sale_count, rent_count, median_price, median_ppsqm, underpriced_count"),
  ]);

  const oppCount = new Map<string, number>();
  for (const o of opps ?? []) {
    oppCount.set(o.municipality_id, (oppCount.get(o.municipality_id) ?? 0) + 1);
  }
  const statsMap = new Map((stats ?? []).map((s) => [s.municipality_id, s]));

  const targets = (munis ?? [])
    .filter((m) => (oppCount.get(m.id) ?? 0) < perMarket)
    .sort((a, b) => (oppCount.get(a.id) ?? 0) - (oppCount.get(b.id) ?? 0))
    .slice(0, maxMarkets);

  if (!targets.length) {
    return NextResponse.json({ ok: true, created: 0, reason: "all markets covered" });
  }

  let created = 0;
  const errors: string[] = [];
  const processed: string[] = [];

  for (const m of targets) {
    if (Date.now() > deadline) break;
    const need = perMarket - (oppCount.get(m.id) ?? 0);
    const st = statsMap.get(m.id);

    const [{ data: cheapest }, { data: signals }] = await Promise.all([
      supabase
        .from("properties")
        .select("id, price, size_sqm, bedrooms, property_type")
        .eq("municipality_id", m.id)
        .eq("status", "active")
        .eq("listing_type", "sale")
        .not("price", "is", null)
        .gt("size_sqm", 15)
        .order("price", { ascending: true })
        .limit(5),
      supabase
        .from("signals")
        .select("title, signal_type, opportunity_impact")
        .eq("municipality_id", m.id)
        .order("detected_at", { ascending: false })
        .limit(3),
    ]);

    const sym = m.currency_code === "GBP" ? "£" : "$";
    const grounding = {
      market: `${m.name}, ${m.region}, ${m.country}`,
      population: m.population,
      conviction_scores: {
        opportunity: m.opportunity_score, growth: m.growth_score, risk: m.risk_score,
        development: m.development_score, infrastructure: m.infrastructure_score, liquidity: m.liquidity_score,
      },
      live_inventory: st
        ? {
            sale_listings: st.sale_count, rent_listings: st.rent_count,
            median_price: st.median_price != null ? `${sym}${Math.round(Number(st.median_price) / 100).toLocaleString()}` : null,
            median_per_sqm: st.median_ppsqm != null ? `${sym}${Math.round(Number(st.median_ppsqm) / 100).toLocaleString()}` : null,
            listings_15pct_below_median: st.underpriced_count,
          }
        : null,
      entry_price_band: (cheapest ?? []).map((p) => ({
        price: `${sym}${Math.round((p.price ?? 0) / 100).toLocaleString()}`,
        sqm: Math.round(Number(p.size_sqm)), type: p.property_type, beds: p.bedrooms,
      })),
      recent_signals: (signals ?? []).map((s) => ({ title: s.title, type: s.signal_type, impact: s.opportunity_impact })),
      rate_context: m.currency_code === "GBP"
        ? "UK base financing context ~5.25%; affordability-constrained demand, rental depth elevated"
        : "US 30y mortgage ~6.4%; DSCR-constrained underwriting, supply normalizing",
    };

    const prompt =
      `You are a real-estate investment analyst at an institutional intelligence platform. ` +
      `Write ${need} distinct investment-opportunity theses for the market below, grounded STRICTLY in the supplied data.\n\n` +
      `DATA:\n${JSON.stringify(grounding, null, 2)}\n\n` +
      `Rules:\n` +
      `- Each thesis: one MACRO paragraph angle (rates, national dynamics from rate_context) woven with MICRO specifics (this market's scores, inventory, price levels, signals).\n` +
      `- Cite ONLY figures provided above. NEVER invent addresses, specific buildings, developers, or prices.\n` +
      `- 90–150 words per thesis. Analytical register. No recommendation language ("buy", "guaranteed", "can't lose"). No advice.\n` +
      `- category must be one of: ${CATEGORIES.join(", ")}. Vary categories across theses; pick what the data best supports.\n` +
      `- opportunity_score 0-100 (anchor near the market's opportunity score ±8), risk_score 0-100 (anchor near market risk ±10), risk_level consistent with risk_score (low<35, medium 35-60, high>60).\n\n` +
      `Respond with ONLY a JSON array of ${need} objects: ` +
      `[{"title": string (≤70 chars, specific to this market), "category": string, "investment_thesis": string, "opportunity_score": number, "risk_score": number, "risk_level": "low"|"medium"|"high"}]`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = await res.json();
      // content may lead with a thinking block — take the first text block.
      const text: string = (data?.content as { type: string; text?: string }[] | undefined)
        ?.find((b) => b.type === "text")?.text ?? "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("no JSON array in response");
      const parsed = JSON.parse(jsonMatch[0]) as GeneratedOpp[];

      const rows = parsed
        .filter((o) => o.title && o.investment_thesis && CATEGORIES.includes(o.category))
        .slice(0, need)
        .map((o) => ({
          municipality_id: m.id,
          title: String(o.title).slice(0, 120),
          category: o.category,
          investment_thesis: String(o.investment_thesis).slice(0, 2000),
          opportunity_score: Math.min(100, Math.max(0, Math.round(Number(o.opportunity_score) || m.opportunity_score))),
          risk_score: Math.min(100, Math.max(0, Math.round(Number(o.risk_score) || m.risk_score))),
          risk_level: (["low", "medium", "high"].includes(o.risk_level) ? o.risk_level : "medium") as "low" | "medium" | "high",
          status: "active" as const,
          source_name: "Prime Atlas Intelligence",
          data_confidence: 0.6,
          evidence: {
            generated_by: "claude-sonnet-5",
            grounded_on: {
              conviction_scores: grounding.conviction_scores,
              live_inventory: grounding.live_inventory,
              listing_ids: (cheapest ?? []).map((p) => p.id),
              signals: grounding.recent_signals.map((s) => s.title),
            },
            generated_at: new Date().toISOString(),
          },
          retrieved_at: new Date().toISOString(),
        }));

      if (rows.length) {
        // Partial unique index (municipality_id, title) makes replays no-ops.
        const { error } = await supabase
          .from("opportunities")
          .upsert(rows, { onConflict: "municipality_id,title", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        created += rows.length;
      }
      processed.push(`${m.name} (+${rows.length})`);
    } catch (err) {
      errors.push(`${m.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      created,
      processed,
      remaining_under_covered: Math.max(0, (munis ?? []).filter((mm) => (oppCount.get(mm.id) ?? 0) < perMarket).length - processed.length),
      errors,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
