/**
 * POST /api/export/deal-brochure  { propertyIds: string[] }
 *
 * Multi-property Deal Brochure — the structured pack a member hands to a
 * partner, agent, or mortgage broker to open a preliminary financing
 * conversation. Rendering lives in src/lib/dealBrochure.ts (pure, tested);
 * this route is auth, gating, data assembly, and contact-reveal metering.
 *
 * Gating (server-side, entitlements.ts):
 *  - anonymous → 401; below Professional → 403 with upgrade flag
 *    (canExportDealBrochure).
 *  - Agent contacts inside the pack are REAL contact reveals and meter
 *    against contactRevealsPerMonth exactly like /api/contact-request:
 *    already-revealed properties are free (dedupe), new ones consume quota
 *    in selection order, and past-quota contacts are withheld WITH a note
 *    in the document — never silently dropped, never leaked past the cap.
 *
 * Data honesty (same rules as /api/deal-board/listings):
 *  - Discount/comp evidence from the ZIP-comp screen over the market's
 *    full sane inventory (fetchZipCompScreens) — insufficient basis renders
 *    as an explicit gap.
 *  - Yield/DSCR only where >= 10 real rent comps exist for the market.
 *  - Financing scenarios computed by the real screener engine
 *    (computeScreener) at labeled assumptions — never a bespoke formula.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { canExportDealBrochure, checkContactRevealQuota, normalizeTier } from "@/lib/entitlements";
import { fetchZipCompScreens } from "@/lib/server/compScreens";
import { computeScreener } from "@/lib/screener";
import { fmt, symFor } from "@/lib/money";
import { localizedPpsm } from "@/lib/proforma";
import { MAX_SANE_PRICE } from "@/lib/listingSanity";
import { buildDealBrochureHtml, type BrochurePayload, type BrochurePropertyPayload } from "@/lib/dealBrochure";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PROPERTIES = 12;
const YIELD_MIN_RENT_COMPS = 10;
const RATE_SCENARIOS = [5.5, 6.5, 7.5];
const ASSUMPTIONS = { ltvPct: 75, amortYears: 30, vacancyPct: 5, expenseRatioPct: 40, closingCostPct: 2 };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("subscription_tier").eq("id", user.id).single();
  const tier = normalizeTier(profile?.subscription_tier);
  if (!canExportDealBrochure(tier)) {
    return NextResponse.json(
      { error: "upgrade_required", requiredTier: "professional", message: "Deal Brochure export is a Professional feature." },
      { status: 403 },
    );
  }

  let propertyIds: string[];
  try {
    const body = await req.json();
    propertyIds = Array.from(new Set((body?.propertyIds ?? []) as string[])).slice(0, MAX_PROPERTIES);
    if (!propertyIds.length || propertyIds.some((id) => typeof id !== "string")) throw new Error("bad ids");
  } catch {
    return NextResponse.json({ error: "invalid_payload", message: `Provide 1-${MAX_PROPERTIES} propertyIds.` }, { status: 400 });
  }

  const { data: props } = await supabase
    .from("properties")
    .select("id, address, price, currency_code, bedrooms, bathrooms, property_type, size_sqm, images, listing_url, municipality_id, agent_name, agent_company, agent_phone, agent_email, listing_type, status")
    .in("id", propertyIds)
    .eq("status", "active")
    .eq("listing_type", "sale")
    .not("price", "is", null)
    .lte("price", MAX_SANE_PRICE);
  if (!props?.length) {
    return NextResponse.json({ error: "not_found", message: "No active sale listings matched the selection." }, { status: 404 });
  }

  const muniIds = Array.from(new Set(props.map((p) => p.municipality_id).filter(Boolean))) as string[];
  const [{ data: munis }, { data: rentStats }] = await Promise.all([
    supabase.from("municipalities").select("id, name, region, country, currency_code").in("id", muniIds),
    supabase.from("market_rent_stats").select("municipality_id, rent_comp_count, median_rent_price").in("municipality_id", muniIds),
  ]);
  const muniMap = new Map((munis ?? []).map((m) => [m.id, m]));
  const rentMap = new Map((rentStats ?? []).map((r) => [r.municipality_id as string, r]));

  // ZIP-comp screens for US markets in the selection (UK: structurally uncovered).
  const usMuniIds = (munis ?? []).filter((m) => m.country === "United States").map((m) => m.id);
  const screens = await fetchZipCompScreens(supabase, usMuniIds);

  // Contact-reveal metering — mirrors /api/contact-request: dedupe is free,
  // new reveals consume quota in selection order, recorded via service role.
  const admin = adminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: pastReveals } = await admin
    .from("contact_requests").select("property_id").eq("user_id", user.id).in("property_id", propertyIds);
  const alreadyRevealed = new Set((pastReveals ?? []).map((r) => r.property_id));
  const quota = await checkContactRevealQuota(supabase, user.id, tier);
  let remaining = quota.remaining; // null = unlimited
  const newlyRevealed: string[] = [];

  // Preserve the user's selection order.
  const ordered = propertyIds.map((id) => props.find((p) => p.id === id)).filter(Boolean) as typeof props;

  const properties: BrochurePropertyPayload[] = ordered.map((p) => {
    const muni = p.municipality_id ? muniMap.get(p.municipality_id) : undefined;
    const sym = symFor(p.currency_code ?? "USD");
    const comp = p.municipality_id ? screens.get(p.municipality_id)?.screen.byId.get(p.id) : undefined;
    const rent = p.municipality_id ? rentMap.get(p.municipality_id) : undefined;
    const rentCompCount = rent?.rent_comp_count ?? 0;
    const medianRent = rent?.median_rent_price != null ? Number(rent.median_rent_price) : null;
    const yieldEligible = rentCompCount >= YIELD_MIN_RENT_COMPS && medianRent != null && p.price! > 0;

    const financing = RATE_SCENARIOS.map((ratePct) => {
      const out = computeScreener({
        purchasePrice: p.price! / 100, units: 1,
        avgRentMo: yieldEligible ? medianRent! / 100 : 0,
        otherIncomeYr: 0, vacancyPct: ASSUMPTIONS.vacancyPct, expenseRatioPct: ASSUMPTIONS.expenseRatioPct,
        ltvPct: ASSUMPTIONS.ltvPct, interestPct: ratePct, amortYears: ASSUMPTIONS.amortYears,
        closingCostPct: ASSUMPTIONS.closingCostPct, exitCapPct: 5.5, holdYears: 5, rentGrowthPct: 0,
      });
      return {
        ratePct,
        monthlyPI: fmt(out.annualDebtService / 12, sym),
        dscr: yieldEligible ? out.dscr : null,
        cashToClose: fmt(out.equity, sym),
      };
    });

    const hasAgent = !!(p.agent_name || p.agent_company || p.agent_phone || p.agent_email);
    let agent: BrochurePropertyPayload["agent"] = null;
    let contactWithheldReason: BrochurePropertyPayload["contactWithheldReason"] = null;
    if (hasAgent) {
      if (alreadyRevealed.has(p.id) || remaining === null || remaining > 0) {
        agent = { name: p.agent_name, company: p.agent_company, phone: p.agent_phone, email: p.agent_email };
        if (!alreadyRevealed.has(p.id)) {
          if (remaining !== null) remaining -= 1;
          newlyRevealed.push(p.id);
        }
      } else {
        contactWithheldReason = "quota";
      }
    }

    return {
      address: p.address ?? "Address on file",
      market: muni ? `${muni.name}, ${muni.region} — ${muni.country === "United States" ? "USA" : "UK"}` : "Market on file",
      price: fmt(p.price! / 100, sym),
      detail: [
        p.bedrooms ? `${p.bedrooms} bed` : null,
        p.bathrooms ? `${p.bathrooms} bath` : null,
        p.property_type ?? "Residential",
        p.size_sqm ? `${Math.round(Number(p.size_sqm))} sqm` : null,
      ].filter(Boolean).join(" · "),
      images: ((p.images ?? []) as string[]).slice(0, 2),
      listingUrl: p.listing_url,
      discountPct: comp?.status === "mispriced" ? comp.discountPct : null,
      compBasisLabel: comp?.status === "mispriced" ? comp.basisLabel : null,
      comps: comp?.status === "mispriced"
        ? comp.comps.map((c) => ({
            address: c.address ?? "Address on file",
            price: fmt(c.price / 100, sym),
            ppsm: localizedPpsm(c.ppsqm, muni?.country ?? "United States", sym),
          }))
        : [],
      grossYieldPct: yieldEligible ? ((medianRent! * 12) / p.price!) * 100 : null,
      rentCompCount,
      medianRentDisplay: yieldEligible ? fmt(medianRent! / 100, sym) : null,
      financing,
      agent,
      contactWithheldReason,
    };
  });

  if (newlyRevealed.length) {
    await admin.from("contact_requests").upsert(
      newlyRevealed.map((property_id) => ({ user_id: user.id, property_id, sent_at: new Date().toISOString() })),
      { onConflict: "user_id,property_id" },
    );
  }

  const payload: BrochurePayload = {
    preparedFor: user.email ?? "Prime Atlas member",
    properties,
    assumptions: ASSUMPTIONS,
    generatedAtIso: new Date().toISOString(),
  };

  return new NextResponse(buildDealBrochureHtml(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/msword",
      "Content-Disposition": `attachment; filename="prime-atlas-deal-brochure.doc"`,
      "Cache-Control": "no-store",
    },
  });
}
