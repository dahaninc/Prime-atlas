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
import { buildPropertyReportEmail }       from "@/lib/email/propertyReport";

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

const STATE_RENTS: Record<string, number> = {
  NY: 2800, CA: 2600, WA: 2200, MA: 2800, CO: 2000,
  FL: 2000, MD: 2000, OR: 1800, TX: 1800, AZ: 1600,
  GA: 1600, TN: 1600, NC: 1500, MN: 1500, PA: 1500,
  NV: 1700, IL: 1700, OH: 1200, MI: 1200, WI: 1200,
  KY: 1100, VA: 2000, SC: 1400, IN: 1100, MO: 1200,
};

const BED_MULT: Record<number, number> = { 0: 0.60, 1: 0.75, 2: 1.00, 3: 1.30, 4: 1.55 };
const SUNBELT = new Set(["TX", "FL", "GA", "NC", "TN", "SC", "AZ", "NV"]);
const COASTAL = new Set(["CA", "NY", "WA", "MA", "OR"]);

interface PropertyRow {
  id:            string;
  address:       string | null;
  price:         number | null;
  currency_code: string;
  bedrooms:      number | null;
  bathrooms:     number | null;
  size_sqm:      number | null;
  property_type: string | null;
  listing_type:  string;
  scraped_at:    string;
  images:        string[] | null;
  agent_name:    string | null;
  agent_company: string | null;
  agent_phone:   string | null;
  agent_email:   string | null;
}

function enrichForReport(p: PropertyRow) {
  const country: "UK" | "US" = p.currency_code === "GBP" ? "UK" : "US";
  const priceUSD = p.price
    ? country === "UK"
      ? (p.price / 100) * 1.27
      : p.price / 100
    : 0;
  const stateCode = getState(p.address);
  const beds = p.bedrooms ?? 2;
  const bedMult = BED_MULT[Math.min(beds, 4)] ?? 1.00;

  let baseRent: number;
  if (country === "UK") {
    const addr = (p.address ?? "").toLowerCase();
    if (addr.includes("london"))                                               baseRent = 2500 * 1.27;
    else if (addr.includes("manchester") || addr.includes("birmingham"))      baseRent = 1200 * 1.27;
    else if (addr.includes("bristol") || addr.includes("edinburgh") || addr.includes("oxford")) baseRent = 1400 * 1.27;
    else                                                                       baseRent = 1100 * 1.27;
  } else {
    baseRent = STATE_RENTS[stateCode] ?? 1600;
  }

  const monthlyRentUSD  = baseRent * bedMult;
  const annualRentUSD   = monthlyRentUSD * 12;
  const grossYield      = priceUSD > 0 ? (annualRentUSD / priceUSD) * 100 : 0;
  const netYield        = grossYield * 0.75;
  const irr3yr          = Math.round((netYield + 2.5) * 10) / 10;
  const irr5yr          = Math.round((netYield + 3.0) * 10) / 10;
  const irr10yr         = Math.round((netYield + 3.5) * 10) / 10;
  const debtServicePct  = 0.70 * 5.0;
  const netCashFlow     = grossYield * 0.75 - debtServicePct;
  const cashOnCash      = Math.round((netCashFlow / 0.30) * 10) / 10;
  const pricePounds     = (p.price ?? 0) / 100;
  const exit3yr         = pricePounds * Math.pow(1.03, 3);
  const exit5yr         = pricePounds * Math.pow(1.03, 5);
  const exit10yr        = pricePounds * Math.pow(1.03, 10);

  let conviction = 55;
  if (grossYield >= 8) conviction += 20;
  else if (grossYield >= 6) conviction += 12;
  else if (grossYield >= 4) conviction += 5;
  else conviction -= 10;
  if ((p.bedrooms ?? 0) >= 3) conviction += 8;
  if (priceUSD >= 200_000 && priceUSD <= 650_000) conviction += 10;
  if (SUNBELT.has(stateCode)) conviction += 5;
  if (country === "UK") conviction += 5;
  if (priceUSD > 1_200_000) conviction -= 12;
  if (!p.bedrooms) conviction -= 5;
  conviction = Math.max(35, Math.min(92, conviction));

  const monthlyRentDisplay = country === "UK"
    ? Math.round(monthlyRentUSD / 1.27)
    : Math.round(monthlyRentUSD);

  // Strategy label
  let strategy: string;
  if (country === "UK") {
    if      (priceUSD < 200_000)   strategy = "High-Yield BTL";
    else if (priceUSD < 450_000)   strategy = "Buy-to-Let";
    else if (priceUSD < 900_000)   strategy = "Prime Residential";
    else                           strategy = "High-Value / HNW";
  } else {
    if      (priceUSD < 250_000 && beds >= 2) strategy = "High-Yield BTL";
    else if (SUNBELT.has(stateCode) && priceUSD < 500_000) strategy = "Sunbelt Growth Play";
    else if (COASTAL.has(stateCode) && priceUSD > 900_000) strategy = "Premium Residential";
    else if (priceUSD < 450_000)   strategy = "Buy-to-Let";
    else if (priceUSD < 850_000)   strategy = "Prime Residential";
    else                           strategy = "High-Value / HNW";
  }

  // Macro text
  let macroLabel: string;
  let macroText: string;
  if (country === "UK") {
    macroLabel = "BULLISH";
    macroText  = "Post-rate-peak UK market. Rental demand at historic highs as mortgage affordability constrains owner-occupation. Gross yields trending upward in regional cities. Housing supply pipeline well below historical averages, supporting price floors.";
  } else if (SUNBELT.has(stateCode)) {
    macroLabel = "BULLISH";
    macroText  = "Sunbelt state with strong inbound population migration and business-friendly tax environment. Above-average rent growth expected over a 5-year horizon. Entry cost remains accessible relative to coastal markets.";
  } else if (COASTAL.has(stateCode)) {
    macroLabel = "CAUTIOUS";
    macroText  = "High-cost coastal market. Entry price compresses initial yield but long-term capital appreciation runs above national average. Supply constraints support rental demand. Rate sensitivity elevated — stress-test financing assumptions.";
  } else {
    macroLabel = "NEUTRAL";
    macroText  = "Stable mid-market fundamentals. Cashflow-first strategy viable at current price levels. Capital appreciation more modest than growth markets, but defensive income profile offers downside protection.";
  }

  const microText = p.listing_type === "sale"
    ? `${p.property_type ?? "Residential asset"} in ${getLocationSummary(p.address, country)}. ${grossYield >= 7 ? "Gross yield above 7% indicates strong day-one cashflow. BTL fundamentals are compelling at this price point." : grossYield >= 5 ? "Mid-tier yield — value-add or above-market rent growth required to hit double-digit IRR targets." : "Below-average initial yield. Thesis depends on capital appreciation and refinancing upside at exit."} ${(p.bedrooms ?? 0) >= 3 ? "Multi-bed configuration supports family rental demand with lower void rates." : "Compact unit — strong liquidity at exit but higher tenant turnover risk to model."}`
    : `Rental asset${p.bedrooms ? ` with ${p.bedrooms} bedrooms` : ""} in ${getLocationSummary(p.address, country)}. ${country === "UK" ? "UK rental market operating near record tightness." : SUNBELT.has(stateCode) ? "Sunbelt rental demand supported by continued population inflow." : "Stable rental demand profile with vacancy rates below historical averages."}`;

  return {
    country,
    stateCode,
    priceUSD,
    grossYield:   Math.round(grossYield * 10) / 10,
    netYield:     Math.round(netYield * 10) / 10,
    monthlyRentDisplay,
    irr3yr, irr5yr, irr10yr,
    cashOnCash,
    exit3yr, exit5yr, exit10yr,
    conviction,
    strategy,
    macroLabel,
    macroText,
    microText,
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

    const tier       = (profile as { subscription_tier?: string } | null)?.subscription_tier ?? "free";
    const isMember   = ["explorer", "analyst", "institutional"].includes(tier);
    if (!isMember) {
      return NextResponse.json({ error: "Membership required" }, { status: 403 });
    }

    // Check for duplicate (only one per property per user)
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

    // Fetch property (including new agent/image columns)
    const { data: rawProp, error: propErr } = await admin
      .from("properties")
      .select("id, address, price, currency_code, bedrooms, bathrooms, size_sqm, property_type, listing_type, scraped_at, images, agent_name, agent_company, agent_phone, agent_email")
      .eq("id", propertyId)
      .eq("status", "active")
      .single();

    if (propErr || !rawProp) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const p = rawProp as unknown as PropertyRow;
    const e = enrichForReport(p);

    const sym            = SYM[p.currency_code] ?? "£";
    const priceFormatted = fmtPrice(p.price ?? 0, p.currency_code);
    const location       = getLocationSummary(p.address, e.country);
    const memberName     = (profile as { full_name?: string } | null)?.full_name
                         ?? user.email?.split("@")[0]
                         ?? "Investor";
    const reportUrl      = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://prime-atlas.io"}/market-feed/${p.id}`;

    // Pick best image (first from array, if available)
    const images = Array.isArray(p.images) ? p.images : [];
    const imageUrl = images.find(img => img && img.startsWith("http")) ?? null;

    // Build email
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
      conviction:  e.conviction,
      grossYield:  e.grossYield,
      netYield:    e.netYield,
      irr3yr:      e.irr3yr,
      irr5yr:      e.irr5yr,
      irr10yr:     e.irr10yr,
      cashOnCash:  e.cashOnCash,
      exit3yr:     fmtPrice(Math.round(e.exit3yr * 100), p.currency_code),
      exit5yr:     fmtPrice(Math.round(e.exit5yr * 100), p.currency_code),
      exit10yr:    fmtPrice(Math.round(e.exit10yr * 100), p.currency_code),
      monthlyRent: `${sym}${e.monthlyRentDisplay.toLocaleString()}`,
      strategy:    e.strategy,
      macroLabel:  e.macroLabel,
      macroText:   e.macroText,
      microText:   e.microText,
      agentName:   p.agent_name,
      agentCompany:p.agent_company,
      agentPhone:  p.agent_phone,
      agentEmail:  p.agent_email,
      memberName,
      reportUrl,
    });

    // Send email via Resend
    const resend    = new Resend(process.env.RESEND_API_KEY!);
    const emailTo   = user.email!;
    const { error: sendErr } = await resend.emails.send({
      from:    "Prime Atlas Research <research@prime-atlas.io>",
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
