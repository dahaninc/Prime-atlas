/**
 * GET /api/cron/deal-alerts  (hourly — vercel.json)
 * Auth: Bearer CRON_SECRET
 *
 * Matches newly scraped listings against member deal-alert rules and emails
 * the hits via Resend. Every (rule, property) pair is notified at most once
 * (deal_alert_hits unique constraint).
 *
 * Matching criteria per rule (all optional, AND-ed):
 *   municipality_id / country_iso2 · listing_type · max_price ·
 *   min_bedrooms · min_discount_pct (vs market median £/sqm) · min_yield_pct
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "@/lib/supabase/database.types";
import { estimateGrossYield } from "@/lib/yield";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const LOOKBACK_HOURS = 26; // covers the daily scrape cadence with margin
const MAX_PER_EMAIL = 8;

type Property = {
  id: string;
  address: string | null;
  price: number | null;
  currency_code: string;
  bedrooms: number | null;
  size_sqm: number | null;
  listing_type: string;
  listing_url: string | null;
  municipality_id: string | null;
  country_iso2: string | null;
  images: unknown;
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const [{ data: rules }, { data: recent }, { data: stats }, { data: municipalities }] =
    await Promise.all([
      supabase.from("deal_alert_rules").select("*").eq("active", true),
      supabase
        .from("properties")
        .select(
          "id, address, price, currency_code, bedrooms, size_sqm, listing_type, listing_url, municipality_id, country_iso2, images"
        )
        .eq("status", "active")
        .gte("scraped_at", new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString())
        .not("price", "is", null),
      supabase.from("market_listing_stats").select("municipality_id, median_ppsqm"),
      supabase.from("municipalities").select("id, name"),
    ]);

  if (!rules?.length || !recent?.length) {
    return NextResponse.json({ ok: true, matched: 0, reason: "no active rules or no recent listings" });
  }

  const medianPpsqm = new Map<string, number>();
  for (const st of stats ?? []) {
    if (st.municipality_id && st.median_ppsqm) medianPpsqm.set(st.municipality_id, Number(st.median_ppsqm));
  }
  const marketName = new Map((municipalities ?? []).map((m) => [m.id, m.name]));

  // Pre-compute discount + yield per property
  const enriched = (recent as Property[]).map((p) => {
    const median = p.municipality_id ? medianPpsqm.get(p.municipality_id) : undefined;
    const ppsqm = p.price && p.size_sqm && p.size_sqm > 0 ? p.price / Number(p.size_sqm) : null;
    const discountPct = median && ppsqm ? ((median - ppsqm) / median) * 100 : null;
    return { ...p, discountPct, estYield: estimateGrossYield(p) };
  });

  let emailsSent = 0;
  let matchedTotal = 0;
  const errors: string[] = [];
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  for (const rule of rules) {
    const candidates = enriched.filter((p) => {
      if (rule.municipality_id && p.municipality_id !== rule.municipality_id) return false;
      if (rule.country_iso2 && p.country_iso2 !== rule.country_iso2) return false;
      if (rule.listing_type && p.listing_type !== rule.listing_type) return false;
      if (rule.max_price != null && (p.price ?? Infinity) > rule.max_price) return false;
      if (rule.min_bedrooms != null && (p.bedrooms ?? 0) < rule.min_bedrooms) return false;
      if (rule.min_discount_pct != null && (p.discountPct ?? -Infinity) < Number(rule.min_discount_pct)) return false;
      if (rule.min_yield_pct != null && (p.estYield ?? 0) < Number(rule.min_yield_pct)) return false;
      return true;
    });
    if (!candidates.length) continue;

    // Drop already-notified pairs
    const { data: pastHits } = await supabase
      .from("deal_alert_hits")
      .select("property_id")
      .eq("rule_id", rule.id)
      .in("property_id", candidates.map((c) => c.id));
    const seen = new Set((pastHits ?? []).map((h) => h.property_id));
    const fresh = candidates.filter((c) => !seen.has(c.id)).slice(0, MAX_PER_EMAIL);
    if (!fresh.length) continue;

    matchedTotal += fresh.length;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", rule.user_id)
      .maybeSingle();
    if (!profile?.email || !resend) continue;

    const market = rule.municipality_id ? marketName.get(rule.municipality_id) ?? "your market" : "your markets";
    const sym = (c: string) => (c === "GBP" ? "£" : "$");
    const rows = fresh
      .map((p) => {
        const priceStr = p.price ? `${sym(p.currency_code)}${Math.round(p.price / 100).toLocaleString()}` : "POA";
        const extras = [
          p.bedrooms ? `${p.bedrooms} bed` : null,
          p.discountPct != null ? `<strong style="color:#059669">${p.discountPct.toFixed(0)}% below market</strong>` : null,
          p.estYield != null ? `~${p.estYield}% gross yield` : null,
        ].filter(Boolean).join(" · ");
        const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app"}/market-feed/${p.id}`;
        return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">
          <a href="${link}" style="color:#1B4FE4;font-weight:600;text-decoration:none">${p.address ?? "View listing"}</a><br/>
          <span style="font-size:13px;color:#111"><strong>${priceStr}</strong> · ${extras}</span>
        </td></tr>`;
      })
      .join("");

    try {
      const { error: sendErr } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "Prime Atlas <onboarding@resend.dev>",
        to: profile.email,
        subject: `🎯 ${fresh.length} new deal${fresh.length > 1 ? "s" : ""} matching your ${market} alert`,
        html: `<div style="font-family:ui-sans-serif,system-ui;max-width:560px;margin:0 auto">
          <p style="font-size:12px;letter-spacing:2px;color:#888;text-transform:uppercase">Prime Atlas · Deal Alert</p>
          <p style="font-size:15px;color:#111">New listings matched your <strong>${market}</strong> criteria:</p>
          <table style="width:100%;border-collapse:collapse">${rows}</table>
          <p style="font-size:11px;color:#999;margin-top:20px">
            You receive this because of a deal alert you created on the Prime Atlas Deal Board.
            Manage alerts from your <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app"}/watchlists">watchlists page</a>.
            Estimates are heuristic — verify before acting. Not investment advice.
          </p>
        </div>`,
      });
      if (sendErr) throw new Error(sendErr.message);

      const { error: hitErr } = await supabase
        .from("deal_alert_hits")
        .insert(fresh.map((p) => ({ rule_id: rule.id, property_id: p.id })));
      if (hitErr) throw new Error(hitErr.message);
      emailsSent++;
    } catch (err) {
      errors.push(`rule ${rule.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, rules: rules.length, matched: matchedTotal, emailsSent, errors });
}
