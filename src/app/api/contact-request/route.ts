/**
 * POST /api/contact-request
 *
 * Member-only endpoint. Sends a full property research report (HTML email)
 * to the authenticated member and records the request so it is only sent once.
 *
 * Body: { property_id: string }
 * Returns: { ok: true } | { already_sent: true } | { error: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient }                   from "@/lib/supabase/server";
import { createClient as adminClient }    from "@supabase/supabase-js";
import { Resend }                         from "resend";
import { buildPropertyReportEmail, type PropertyReportData } from "@/lib/email/propertyReport";
import { normalizeTier, checkContactRevealQuota } from "@/lib/entitlements";
import { computeRealGrossYieldPct, isYieldEligible, type RentBasis } from "@/lib/realYield";
import { fetchZipCompScreens } from "@/lib/server/compScreens";
import { computeScreener } from "@/lib/screener";
import { buildMarketReport } from "@/lib/marketReport";
import { fmt, symFor } from "@/lib/money";
import { localizedPpsm } from "@/lib/proforma";

export const dynamic = "force-dynamic";

/* ── Supabase admin client (server-side only) ──────────────────── */

function getAdmin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/* ── Enrichment engine (duplicated from page for server-side use) ── */

const SYM: Record<string, string> = { USD: "$", GBP: "£" };

function fmtPrice(cents: number, currency: string): string {
  const s = SYM[currency] ?? currency;
  const n = cents / 100;
  if (n >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${s}${Math.round(n / 1_000)}K`;
  return `${s}${n.toLocaleString()}`;
}

function getState(address: string | null): string {
  if (!address) return "—";
  return address.match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1] ?? "—";
}

function getUKRegion(address: string | null): string {
  if (!address) return "UK";
  const parts = address.split(",").map((p) => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!p.match(/^[A-Z]{1,2}\d/) && p.length > 2) return p;
  }
  return "UK";
}

function getLocationSummary(address: string | null, country: "UK" | "US"): string {
  if (!address) return country === "UK" ? "United Kingdom" : "United States";
  if (country === "US") {
    const parts = address.split(",").map(p => p.trim());
    if (parts.length >= 3) {
      const stateZip = parts[parts.length - 1];
      const stateCode = stateZip.match(/^([A-Z]{2})/)?.[1];
      const city = parts[parts.length - 2];
      if (stateCode && city) return `${city}, ${stateCode}`;
    }
    const s = getState(address);
    return s !== "—" ? s : "United States";
  } else {
    return getUKRegion(address);
  }
}

interface PropertyRow {
  id:              string;
  address:         string | null;
  price:           number | null;
  currency_code:   string;
  bedrooms:        number | null;
  bathrooms:       number | null;
  size_sqm:        number | null;
  property_type:   string | null;
  listing_type:    string;
  scraped_at:      string;
  images:          string[] | null;
  agent_name:      string | null;
  agent_company:   string | null;
  agent_phone:     string | null;
  agent_email:     string | null;
  municipality_id: string | null;
}

/**
 * Real market intelligence for the research-report email — replaces the
 * deleted enrichForReport() heuristic (hardcoded state-rent lookup table +
 * fixed appreciation/conviction formulas, zero real data input; see the
 * 2026-07-09 market-feed audit). Same engines as market-feed/[id]: real
 * rent comps (>=10, market_rent_stats), the ZIP-comp screen (src/lib/comps.ts,
 * >=5 same-ZIP/type/bedroom comps), and computeScreener for financing math.
 */
const REPORT_FIN_ASSUMPTIONS = { ltvPct: 75, amortYears: 30, vacancyPct: 5, expenseRatioPct: 40, closingCostPct: 2, exitCapPct: 5.5, holdYears: 5, ratePct: 6.5 };

async function computeReportIntel(
  supabase: ReturnType<typeof getAdmin>,
  p: PropertyRow,
): Promise<Pick<PropertyReportData,
  "marketName" | "opportunityScore" | "demandSignals" | "grossYieldPct" | "rentCompCount" | "netYieldPct" |
  "monthlyRent" | "discountPct" | "compBasisLabel" | "comps" | "discountUnavailableReason" |
  "financingRatePct" | "monthlyPI" | "dscr" | "cashOnCashPct" | "exitValue" | "financingAssumptions">> {
  const sym = symFor(p.currency_code);
  const empty = {
    marketName: null, opportunityScore: null, demandSignals: [],
    grossYieldPct: null, rentCompCount: 0, netYieldPct: null, monthlyRent: null,
    discountPct: null, compBasisLabel: null, comps: [], discountUnavailableReason: "not_covered" as const,
    financingRatePct: REPORT_FIN_ASSUMPTIONS.ratePct, monthlyPI: "n/a", dscr: null, cashOnCashPct: null, exitValue: null,
    financingAssumptions: `${REPORT_FIN_ASSUMPTIONS.ltvPct}% LTV, ${REPORT_FIN_ASSUMPTIONS.amortYears}yr amortization — illustrative, not a quote.`,
  };
  if (!p.municipality_id || !p.price) return empty;

  const [{ data: muni }, { data: rentStatsRow }] = await Promise.all([
    supabase.from("municipalities")
      .select("id, name, country, currency_code, population, growth_score, development_score, infrastructure_score, liquidity_score, risk_score, opportunity_score")
      .eq("id", p.municipality_id).maybeSingle(),
    supabase.from("market_rent_stats").select("rent_comp_count, median_rent_price").eq("municipality_id", p.municipality_id).maybeSingle(),
  ]);
  if (!muni) return empty;

  const rentBasis: RentBasis = {
    rentCompCount: rentStatsRow?.rent_comp_count ?? 0,
    medianRentPriceMinor: rentStatsRow?.median_rent_price != null ? Number(rentStatsRow.median_rent_price) : null,
  };
  const yieldEligible = isYieldEligible(rentBasis);
  const grossYieldPct = computeRealGrossYieldPct(p.price, rentBasis);

  let discountPct: number | null = null;
  let compBasisLabel: string | null = null;
  let comps: PropertyReportData["comps"] = [];
  let discountUnavailableReason: PropertyReportData["discountUnavailableReason"] = "not_covered";
  if (muni.country === "United States") {
    const screens = await fetchZipCompScreens(supabase, [muni.id]);
    const entry = screens.get(muni.id)?.screen.byId.get(p.id);
    if (entry?.status === "mispriced") {
      discountPct = entry.discountPct;
      compBasisLabel = entry.basisLabel;
      comps = entry.comps.slice(0, 3).map((c) => ({
        address: c.address ?? "Address on file",
        price: fmt(c.price / 100, sym),
        ppsm: localizedPpsm(c.ppsqm, muni.country, sym),
      }));
      discountUnavailableReason = null;
    } else {
      discountUnavailableReason = entry?.status === "implausible" ? "implausible" : "insufficient";
    }
  }

  const out = computeScreener({
    purchasePrice: p.price / 100, units: 1,
    avgRentMo: yieldEligible ? rentBasis.medianRentPriceMinor! / 100 : 0,
    otherIncomeYr: 0, vacancyPct: REPORT_FIN_ASSUMPTIONS.vacancyPct, expenseRatioPct: REPORT_FIN_ASSUMPTIONS.expenseRatioPct,
    ltvPct: REPORT_FIN_ASSUMPTIONS.ltvPct, interestPct: REPORT_FIN_ASSUMPTIONS.ratePct, amortYears: REPORT_FIN_ASSUMPTIONS.amortYears,
    closingCostPct: REPORT_FIN_ASSUMPTIONS.closingCostPct, exitCapPct: REPORT_FIN_ASSUMPTIONS.exitCapPct,
    holdYears: REPORT_FIN_ASSUMPTIONS.holdYears, rentGrowthPct: 0,
  });

  const report = buildMarketReport({
    muni: {
      id: muni.id, name: muni.name, region: "", country: muni.country,
      currency_code: muni.currency_code, population: muni.population,
      opportunity_score: muni.opportunity_score, growth_score: muni.growth_score,
      risk_score: muni.risk_score, development_score: muni.development_score,
      infrastructure_score: muni.infrastructure_score, liquidity_score: muni.liquidity_score,
    },
    stats: null, // pulse stats not fetched for a single-property email — demand signals still compute from scores where possible
    history: [], // no momentum framing — market_score_history has only 2 snapshot days on record
    mispricingBasis: "zip_comps",
  });

  return {
    marketName: muni.name,
    opportunityScore: muni.opportunity_score,
    demandSignals: report.demandSignals.map((s) => ({ label: s.label, value: s.value, note: s.note })),
    grossYieldPct, rentCompCount: rentBasis.rentCompCount,
    netYieldPct: yieldEligible ? Math.round(out.capRate * 10) / 10 : null,
    monthlyRent: yieldEligible ? fmt(rentBasis.medianRentPriceMinor! / 100, sym) : null,
    discountPct, compBasisLabel, comps, discountUnavailableReason,
    financingRatePct: REPORT_FIN_ASSUMPTIONS.ratePct,
    monthlyPI: fmt(out.annualDebtService / 12, sym),
    dscr: yieldEligible ? Math.round(out.dscr * 100) / 100 : null,
    cashOnCashPct: yieldEligible ? Math.round(out.cashOnCash * 10) / 10 : null,
    exitValue: yieldEligible ? fmt(out.exitValue, sym) : null,
    financingAssumptions: `${REPORT_FIN_ASSUMPTIONS.ltvPct}% LTV · ${REPORT_FIN_ASSUMPTIONS.amortYears}yr amortization · ${REPORT_FIN_ASSUMPTIONS.vacancyPct}% vacancy · ${REPORT_FIN_ASSUMPTIONS.expenseRatioPct}% opex · ${REPORT_FIN_ASSUMPTIONS.exitCapPct}% exit cap, ${REPORT_FIN_ASSUMPTIONS.holdYears}yr hold — illustrative, not a quote.`,
  };
}

/* ── Handler ─────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const propertyId = body?.property_id;
    if (!propertyId || typeof propertyId !== "string") {
      return NextResponse.json({ error: "property_id required" }, { status: 400 });
    }

    // Auth: require signed-in member
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, full_name")
      .eq("id", user.id)
      .single();

    const tier = normalizeTier((profile as { subscription_tier?: string } | null)?.subscription_tier);

    // Check for duplicate first — re-revealing an already-sent property is
    // always free and never consumes quota.
    const admin = getAdmin();
    const { data: existing } = await admin
      .from("contact_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ already_sent: true });
    }

    // Entitlements-driven monthly reveal cap (src/lib/entitlements.ts).
    // Free tier has a 0 cap, so this also replaces the old binary
    // "Membership required" check with the same effective behavior.
    const quota = await checkContactRevealQuota(supabase, user.id, tier);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "quota_exceeded", used: quota.used, limit: quota.limit },
        { status: 403 },
      );
    }

    // Fetch property (including new agent/image columns)
    const { data: rawProp, error: propErr } = await admin
      .from("properties")
      .select("id, address, price, currency_code, bedrooms, bathrooms, size_sqm, property_type, listing_type, scraped_at, images, agent_name, agent_company, agent_phone, agent_email, municipality_id")
      .eq("id", propertyId)
      .eq("status", "active")
      .single();

    if (propErr || !rawProp) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const p = rawProp as unknown as PropertyRow;
    const country: "UK" | "US" = p.currency_code === "GBP" ? "UK" : "US";
    const intel = await computeReportIntel(admin, p);

    const priceFormatted = fmtPrice(p.price ?? 0, p.currency_code);
    const location       = getLocationSummary(p.address, country);
    const memberName     = (profile as { full_name?: string } | null)?.full_name
                         ?? user.email?.split("@")[0]
                         ?? "Investor";
    const reportUrl      = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://prime-atlas.io"}/market-feed/${p.id}`;

    // Pick best image (first from array, if available)
    const images = Array.isArray(p.images) ? p.images : [];
    const imageUrl = images.find(img => img && img.startsWith("http")) ?? null;

    // Build email — real market intelligence only (see computeReportIntel)
    const { subject, html } = buildPropertyReportEmail({
      id:          p.id,
      address:     p.address ?? location,
      location,
      price:       priceFormatted,
      currency:    p.currency_code as "GBP" | "USD",
      listingType: p.listing_type as "sale" | "rent",
      propertyType:p.property_type,
      bedrooms:    p.bedrooms,
      bathrooms:   p.bathrooms,
      sizeSqm:     p.size_sqm ? Number(p.size_sqm) : null,
      imageUrl,
      agentName:   p.agent_name,
      agentCompany:p.agent_company,
      agentPhone:  p.agent_phone,
      agentEmail:  p.agent_email,
      memberName,
      reportUrl,
      ...intel,
    });

    // Send email via Resend
    const resend    = new Resend(process.env.RESEND_API_KEY!);
    const emailTo   = user.email!;
    const { error: sendErr } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "Prime Atlas Research <research@prime-atlas.io>",
      to:      emailTo,
      subject,
      html,
    });

    if (sendErr) {
      console.error("[contact-request] Resend error:", sendErr);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    // Record in contact_requests (ignore conflict — safety net)
    await admin.from("contact_requests").upsert(
      { user_id: user.id, property_id: propertyId, sent_at: new Date().toISOString() },
      { onConflict: "user_id,property_id" }
    );

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[contact-request] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
