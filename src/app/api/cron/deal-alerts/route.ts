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
 *   min_bedrooms · min_discount_pct (vs ZIP-level comp basis, see below) ·
 *   min_yield_pct
 *
 * Discount basis (2026-07-08 methodology rebuild): same ZIP-comp screen as
 * the Deal Board / Investment Analysis Report / /underpriced
 * (src/lib/comps.ts via fetchZipCompScreens) — a listing only carries a
 * discount vs the median of ≥5 comps in its own ZIP × property type ×
 * bedrooms, never vs the blended metro median. Consequence: a listing
 * without comp coverage (all UK, thin US ZIPs) has discountPct null and
 * can never satisfy a min_discount_pct rule — an alert email must never
 * claim a discount the product's own report would refuse to rank.
 *
 * Also processes the undervalued-property waitlist (underpriced_waitlist):
 * new sale listings ≥15% below their ZIP-comp basis are mailed to
 * waitlisted users — PAID TIERS ONLY (free users may join the list;
 * delivery activates with membership). Dedupe via underpriced_waitlist_hits.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "@/lib/supabase/database.types";
import { computeRealGrossYieldPct, type RentBasis } from "@/lib/realYield";
import { fetchZipCompScreens } from "@/lib/server/compScreens";

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

  const [{ data: rules }, { data: waitlist }, { data: recent }, { data: municipalities }, { data: rentStats }] =
    await Promise.all([
      supabase.from("deal_alert_rules").select("*").eq("active", true),
      supabase.from("underpriced_waitlist").select("id, user_id, municipality_id"),
      supabase
        .from("properties")
        .select(
          "id, address, price, currency_code, bedrooms, size_sqm, listing_type, listing_url, municipality_id, country_iso2, images"
        )
        .eq("status", "active")
        .gte("scraped_at", new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString())
        .not("price", "is", null),
      supabase.from("municipalities").select("id, name, country"),
      // Real rent-comp basis per market (>=10 comps required — same gate as
      // the Deal Board/market-feed) — replaces the deleted src/lib/yield.ts
      // hardcoded state-rent lookup table.
      supabase.from("market_rent_stats").select("municipality_id, rent_comp_count, median_rent_price"),
    ]);

  if ((!rules?.length && !waitlist?.length) || !recent?.length) {
    return NextResponse.json({ ok: true, matched: 0, reason: "no active rules/waitlist or no recent listings" });
  }

  const marketName = new Map((municipalities ?? []).map((m) => [m.id, m.name]));
  const usMarketIds = new Set((municipalities ?? []).filter((m) => m.country === "United States").map((m) => m.id));
  const rentBasisByMarket = new Map<string, RentBasis>(
    (rentStats ?? []).map((r) => [r.municipality_id as string, {
      rentCompCount: r.rent_comp_count ?? 0,
      medianRentPriceMinor: r.median_rent_price != null ? Number(r.median_rent_price) : null,
    }]),
  );

  // ZIP-comp screens over the FULL sale inventory of every US market with a
  // recent listing — a recent listing's discount is measured against its
  // whole comp set, not just the last 26h of scrapes. UK is structurally
  // uncovered (see compScreens.ts) and skipped.
  const recentUsSaleMarkets = Array.from(new Set(
    (recent as Property[])
      .filter((p) => p.listing_type === "sale" && p.municipality_id && usMarketIds.has(p.municipality_id))
      .map((p) => p.municipality_id as string),
  ));
  const screens = await fetchZipCompScreens(supabase, recentUsSaleMarkets);

  // Pre-compute discount + yield per property. discountPct is non-null ONLY
  // when the ZIP-comp screen ranks it mispriced (15–60% below ≥5 real comps).
  // estYield is non-null ONLY when the market clears the real rent-comp gate
  // (>=10 comps) — never a hardcoded per-state/city rent estimate.
  const enriched = (recent as Property[]).map((p) => {
    const entry = p.municipality_id ? screens.get(p.municipality_id)?.screen.byId.get(p.id) : undefined;
    const discountPct = entry?.status === "mispriced" ? entry.discountPct : null;
    const rentBasis = p.municipality_id ? rentBasisByMarket.get(p.municipality_id) : undefined;
    return { ...p, discountPct, compCount: entry?.comps.length ?? 0, estYield: computeRealGrossYieldPct(p.price, rentBasis) };
  });

  let emailsSent = 0;
  let matchedTotal = 0;
  const errors: string[] = [];
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  for (const rule of rules ?? []) {
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
          p.discountPct != null ? `<strong style="color:#059669">${p.discountPct.toFixed(0)}% below ${p.compCount} ZIP-level comps</strong>` : null,
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

  // ── Undervalued-property waitlist — members only ─────────────────────────
  // Free users may sit on the list; emails go out only once they hold a paid
  // tier ("notifications activate with membership").
  let waitlistEmailsSent = 0;
  if (waitlist?.length && resend) {
    const userIds = Array.from(new Set(waitlist.map((w) => w.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, subscription_tier")
      .in("id", userIds)
      .neq("subscription_tier", "free");
    const paidProfiles = new Map((profiles ?? []).map((p) => [p.id, p]));

    const underpriced = enriched.filter(
      (p) => p.listing_type === "sale" && (p.discountPct ?? -Infinity) >= 15
    );

    for (const entry of waitlist) {
      const profile = paidProfiles.get(entry.user_id);
      if (!profile?.email) continue; // free tier or missing email — list, don't notify

      const candidates = underpriced.filter(
        (p) => !entry.municipality_id || p.municipality_id === entry.municipality_id
      );
      if (!candidates.length) continue;

      const { data: pastHits } = await supabase
        .from("underpriced_waitlist_hits")
        .select("property_id")
        .eq("waitlist_id", entry.id)
        .in("property_id", candidates.map((c) => c.id));
      const seen = new Set((pastHits ?? []).map((h) => h.property_id));
      const fresh = candidates.filter((c) => !seen.has(c.id)).slice(0, MAX_PER_EMAIL);
      if (!fresh.length) continue;

      matchedTotal += fresh.length;
      const sym = (c: string) => (c === "GBP" ? "£" : "$");
      const rows = fresh
        .map((p) => {
          const priceStr = p.price ? `${sym(p.currency_code)}${Math.round(p.price / 100).toLocaleString()}` : "POA";
          const market = p.municipality_id ? marketName.get(p.municipality_id) ?? "" : "";
          const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app"}/market-feed/${p.id}`;
          return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">
            <a href="${link}" style="color:#1B4FE4;font-weight:600;text-decoration:none">${p.address ?? "View listing"}</a><br/>
            <span style="font-size:13px;color:#111"><strong>${priceStr}</strong> · <strong style="color:#059669">${(p.discountPct ?? 0).toFixed(0)}% below ${p.compCount} ZIP-level comps${market ? ` (${market})` : ""}</strong></span>
          </td></tr>`;
        })
        .join("");

      try {
        const { error: sendErr } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "Prime Atlas <onboarding@resend.dev>",
          to: profile.email,
          subject: `📉 ${fresh.length} undervalued propert${fresh.length > 1 ? "ies" : "y"} just launched`,
          html: `<div style="font-family:ui-sans-serif,system-ui;max-width:560px;margin:0 auto">
            <p style="font-size:12px;letter-spacing:2px;color:#888;text-transform:uppercase">Prime Atlas · Undervalued Waitlist</p>
            <p style="font-size:15px;color:#111">New listings flagged ≥15% below the median of their own ZIP-level comparables (same ZIP, property type, bedrooms — minimum 5 comps):</p>
            <table style="width:100%;border-collapse:collapse">${rows}</table>
            <p style="font-size:11px;color:#999;margin-top:20px">
              You receive this because you joined the undervalued-property waitlist on Prime Atlas.
              Manage it from the <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app"}/underpriced">underpriced feed</a>.
              Estimates are heuristic — verify before acting. Not investment advice.
            </p>
          </div>`,
        });
        if (sendErr) throw new Error(sendErr.message);

        const { error: hitErr } = await supabase
          .from("underpriced_waitlist_hits")
          .insert(fresh.map((p) => ({ waitlist_id: entry.id, property_id: p.id })));
        if (hitErr) throw new Error(hitErr.message);
        waitlistEmailsSent++;
      } catch (err) {
        errors.push(`waitlist ${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rules: rules?.length ?? 0,
    waitlist: waitlist?.length ?? 0,
    matched: matchedTotal,
    emailsSent,
    waitlistEmailsSent,
    errors,
  });
}
