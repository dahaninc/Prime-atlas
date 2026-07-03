import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const dynamic = "force-dynamic";

/* ─── types ──────────────────────────────────────────────────── */

interface Property {
  id: string;
  provider: string;
  address: string | null;
  price: number | null;
  currency_code: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  property_type: string | null;
  listing_type: string;
  scraped_at: string;
}


/* ─── helpers ─────────────────────────────────────────────────── */

const SYM: Record<string, string> = { USD: "$", GBP: "£" };

function fmtPrice(cents: number, currency: string): string {
  const s = SYM[currency] ?? currency;
  const n = cents / 100;
  if (n >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${s}${Math.round(n / 1_000)}K`;
  return `${s}${n.toLocaleString()}`;
}

function getState(address: string | null): string {
  if (!address) return "—";
  return address.match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1] ?? "—";
}

function getUKRegion(address: string | null): string {
  if (!address) return "UK";
  const parts = address.split(",").map((p) => p.trim());
  // Skip postcode-like tokens to find the real city/county
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!p.match(/^[A-Z]{1,2}\d/) && p.length > 2) return p;
  }
  return "UK";
}

/** City/state or region only — never exposes street-level data */
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

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "< 1h ago" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

const STATE_NAMES: Record<string, string> = {
  NY: "New York", CA: "California", TX: "Texas", FL: "Florida",
  IL: "Illinois", PA: "Pennsylvania", OH: "Ohio", GA: "Georgia",
  NC: "North Carolina", WA: "Washington", CO: "Colorado", TN: "Tennessee",
  OR: "Oregon", NV: "Nevada", MN: "Minnesota", MA: "Massachusetts",
  MI: "Michigan", AZ: "Arizona", WI: "Wisconsin", MD: "Maryland",
  KY: "Kentucky", VA: "Virginia", SC: "South Carolina", IN: "Indiana", MO: "Missouri",
};

/* ─── enrichment engine ─────────────────────────────────────── */

// Monthly rent estimates (USD, 2-bed equivalent) by US state
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

function getMacro(state: string, country: "UK" | "US"): {
  sentiment: "bullish" | "cautious" | "neutral";
  label: string;
  color: string;
  text: string;
} {
  if (country === "UK") return {
    sentiment: "bullish", label: "BULLISH",
    color: "text-green-600 border-green-200 bg-green-50",
    text: "Post-rate-peak UK market. Rental demand at historic highs as mortgage affordability constrains owner-occupation. Gross yields trending upward in regional cities. Housing supply pipeline well below historical averages, supporting price floors.",
  };
  if (SUNBELT.has(state)) return {
    sentiment: "bullish", label: "BULLISH",
    color: "text-green-600 border-green-200 bg-green-50",
    text: `Sunbelt state with strong inbound population migration and business-friendly tax environment. Above-average rent growth expected over a 5-year horizon. Entry cost remains accessible relative to coastal markets. Remote-work demographic continues to drive demand.`,
  };
  if (COASTAL.has(state)) return {
    sentiment: "cautious", label: "CAUTIOUS",
    color: "text-amber-600 border-amber-200 bg-amber-50",
    text: `High-cost coastal market. Entry price compresses initial yield but long-term capital appreciation runs above national average. Supply constraints support rental demand. Rate sensitivity elevated at current price bands — stress-test financing assumptions.`,
  };
  return {
    sentiment: "neutral", label: "NEUTRAL",
    color: "text-gray-500 border-gray-200 bg-gray-50",
    text: `Stable mid-market fundamentals. Cashflow-first strategy viable at current price levels. Capital appreciation more modest than growth markets, but defensive income profile offers downside protection in a softening rate environment.`,
  };
}

function getStrategy(priceUSD: number, beds: number | null, state: string, country: "UK" | "US"): string {
  if (country === "UK") {
    if (priceUSD < 200_000) return "High-Yield BTL";
    if (priceUSD < 450_000) return "Buy-to-Let";
    if (priceUSD < 900_000) return "Prime Residential";
    return "High-Value / HNW";
  }
  if (priceUSD < 250_000 && (beds ?? 0) >= 2) return "High-Yield BTL";
  if (SUNBELT.has(state) && priceUSD < 500_000) return "Sunbelt Growth Play";
  if (COASTAL.has(state) && priceUSD > 900_000) return "Premium Residential";
  if (priceUSD < 450_000) return "Buy-to-Let";
  if (priceUSD < 850_000) return "Prime Residential";
  return "High-Value / HNW";
}

function enrichProperty(p: Property) {
  const country: "UK" | "US" = p.currency_code === "GBP" ? "UK" : "US";
  const priceUSD = p.price
    ? country === "UK"
      ? (p.price / 100) * 1.27
      : p.price / 100
    : 0;
  const stateCode = getState(p.address);
  const beds = p.bedrooms ?? 2;
  const bedMult = BED_MULT[Math.min(beds, 4)] ?? 1.80;

  // Estimate monthly rent in USD
  let baseRent: number;
  if (country === "UK") {
    const addr = (p.address ?? "").toLowerCase();
    if (addr.includes("london")) baseRent = 2500 * 1.27;
    else if (addr.includes("manchester") || addr.includes("birmingham")) baseRent = 1200 * 1.27;
    else if (addr.includes("bristol") || addr.includes("edinburgh") || addr.includes("oxford")) baseRent = 1400 * 1.27;
    else baseRent = 1100 * 1.27;
  } else {
    baseRent = STATE_RENTS[stateCode] ?? 1600;
  }
  const monthlyRentUSD = baseRent * bedMult;
  const annualRentUSD = monthlyRentUSD * 12;
  const grossYield = priceUSD > 0 ? (annualRentUSD / priceUSD) * 100 : 0;

  // Net yield after ~25% expenses (management, maintenance, voids)
  const netYield = grossYield * 0.75;

  // IRR: net yield + capital appreciation assumption
  const irr3yr  = Math.round((netYield + 2.5) * 10) / 10;
  const irr5yr  = Math.round((netYield + 3.0) * 10) / 10;
  const irr10yr = Math.round((netYield + 3.5) * 10) / 10;

  // Cash-on-cash: 70% LTV, 5% interest rate
  const debtServicePct = 0.70 * 5.0; // % of total value
  const netCashFlow = grossYield * 0.75 - debtServicePct;
  const cashOnCash = Math.round((netCashFlow / 0.30) * 10) / 10;

  // Exit values (3% p.a. appreciation)
  const pricePounds = (p.price ?? 0) / 100;
  const exit3yr  = pricePounds * Math.pow(1.03, 3);
  const exit5yr  = pricePounds * Math.pow(1.03, 5);
  const exit10yr = pricePounds * Math.pow(1.03, 10);

  // Conviction score (0-100)
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

  // Monthly rent in native currency for display
  const monthlyRentDisplay = country === "UK"
    ? Math.round(monthlyRentUSD / 1.27)
    : Math.round(monthlyRentUSD);

  return {
    country,
    stateCode,
    priceUSD,
    grossYield: Math.round(grossYield * 10) / 10,
    netYield:   Math.round(netYield * 10) / 10,
    monthlyRentDisplay,
    irr3yr, irr5yr, irr10yr,
    cashOnCash,
    exit3yr, exit5yr, exit10yr,
    conviction,
    strategy: getStrategy(priceUSD, p.bedrooms, stateCode, country),
    macro: getMacro(stateCode, country),
  };
}

/* ─── sub-components ─────────────────────────────────────────── */

function ConvictionRing({ score }: { score: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? "#16a34a" : score >= 55 ? "#1B4FE4" : "#d97706";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono" style={{ color }}>{score}</span>
          <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider -mt-0.5">/ 100</span>
        </div>
      </div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">
        Conviction Score
      </p>
    </div>
  );
}

function MetricBox({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: "green" | "blue" | "amber" | "red";
}) {
  const valueColor =
    accent === "green" ? "text-green-600" :
    accent === "blue"  ? "text-[#1B4FE4]" :
    accent === "amber" ? "text-amber-600" :
    accent === "red"   ? "text-red-500"   :
    "text-gray-900";

  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 text-center">
      <p className={`text-xl font-black font-mono leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mt-2">{label}</p>
    </div>
  );
}

function ThesisBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-[#F8FAFF]">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">{title}</p>
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}

/* ─── metadata ─────────────────────────────────────────────────── */

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("address, price, currency_code")
    .eq("id", id)
    .single();

  if (!data) return { title: "Property Not Found | Prime Atlas" };

  const meta = data as unknown as Property;
  const country: "UK" | "US" = meta.currency_code === "GBP" ? "UK" : "US";
  // Use location summary in title — never expose full street address in metadata
  const locationTitle = country === "UK" ? getUKRegion(meta.address) : getState(meta.address);
  return {
    title: `${fmtPrice(meta.price ?? 0, meta.currency_code)} · ${locationTitle} | Prime Atlas`,
    description: `Investment analysis for ${locationTitle} — yield, IRR, and conviction scoring powered by Prime Atlas.`,
  };
}

/* ─── page ─────────────────────────────────────────────────────── */

export default async function MarketFeedPropertyPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: p },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("properties")
      .select("id, provider, address, price, currency_code, bedrooms, bathrooms, size_sqm, property_type, listing_type, scraped_at")
      .eq("id", id)
      .eq("status", "active")
      .single(),
  ]);

  if (!p) notFound();

  const property = p as unknown as Property;

  // Membership gate
  const { data: profile } = user
    ? await supabase.from("profiles").select("subscription_tier").eq("id", user.id).single()
    : { data: null };
  const tier = (profile as { subscription_tier?: string } | null)?.subscription_tier ?? "free";
  const isMember = ["explorer", "analyst", "institutional"].includes(tier);

  // Comparable properties — same market, similar price (±40%)
  const priceMin = Math.round((property.price ?? 0) * 0.60);
  const priceMax = Math.round((property.price ?? 0) * 1.40);
  const { data: rawComps } = await supabase
    .from("properties")
    .select("id, address, price, currency_code, bedrooms, bathrooms, size_sqm, property_type, listing_type, scraped_at")
    .eq("status", "active")
    .eq("currency_code", property.currency_code)
    .eq("listing_type", property.listing_type)
    .neq("id", property.id)
    .gte("price", priceMin)
    .lte("price", priceMax)
    .order("scraped_at", { ascending: false })
    .limit(6);

  const comps = (rawComps ?? []) as unknown as Property[];
  const e = enrichProperty(property);
  const isSale = property.listing_type === "sale";
  const locationLabel = e.country === "UK"
    ? getUKRegion(property.address)
    : STATE_NAMES[e.stateCode] ?? e.stateCode;

  return (
    <>
      <Navbar user={user} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/market-feed" className="hover:text-gray-700 transition-colors">Market Feed</Link>
          <span>/</span>
          <span className="text-gray-700 line-clamp-1">{getLocationSummary(property.address, e.country)}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Main column ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Hero */}
            <div className="border border-gray-200 rounded-2xl p-6 bg-white">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  isSale ? "text-green-600 bg-green-50" : "text-blue-600 bg-blue-50"
                }`}>
                  {isSale ? "For Sale" : "For Rent"}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-gray-500 bg-gray-100">
                  {e.country === "UK" ? "🇬🇧 UK" : "🇺🇸 USA"}
                </span>
                {property.property_type && (
                  <span className="text-[9px] text-gray-400 capitalize border border-gray-200 rounded px-2 py-0.5">
                    {property.property_type}
                  </span>
                )}
                <span className="text-[9px] text-gray-400 ml-auto">{timeAgo(property.scraped_at)}</span>
              </div>

              <p className="text-4xl sm:text-5xl font-black text-gray-900 leading-none tabular-nums mb-3">
                {fmtPrice(property.price ?? 0, property.currency_code)}
                {!isSale && <span className="text-base font-semibold text-gray-400 ml-2">/mo</span>}
              </p>

              {/* Address — full street address gated behind membership */}
              {isMember ? (
                <p className="text-base font-semibold text-gray-800 mb-1">
                  {property.address ?? "Address unavailable"}
                </p>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-semibold text-gray-800 blur-sm select-none">
                    {property.address ?? "123 Example Street"}
                  </p>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-[#1B4FE4] bg-[#EEF3FD] border border-[#1B4FE4]/20 px-2 py-0.5 rounded-full">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Members only
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-400 uppercase tracking-widest">{locationLabel}</p>

              {/* Specs */}
              <div className="flex flex-wrap gap-5 mt-5 pt-5 border-t border-gray-100">
                {property.bedrooms  != null && (
                  <div className="text-center">
                    <p className="text-2xl font-black font-mono text-gray-900">{property.bedrooms}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Bedrooms</p>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="text-center">
                    <p className="text-2xl font-black font-mono text-gray-900">{property.bathrooms}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Bathrooms</p>
                  </div>
                )}
                {property.size_sqm  != null && (
                  <div className="text-center">
                    <p className="text-2xl font-black font-mono text-gray-900">
                      {Number(property.size_sqm).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">sqm</p>
                  </div>
                )}
                {property.size_sqm != null && property.price != null && isSale && (() => {
                  const sym = SYM[property.currency_code] ?? "";
                  const priceRaw = property.price / 100;
                  const sqm = Number(property.size_sqm);
                  const perSqm  = Math.round(priceRaw / sqm);
                  const perSqft = Math.round(priceRaw / (sqm * 10.764));
                  return (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-black font-mono text-[#1B4FE4]">
                          {sym}{perSqm.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest">per sqm</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black font-mono text-[#1B4FE4]">
                          {sym}{perSqft.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest">per sq ft</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── Intelligence Panel ── */}
            {!isMember ? (
              /* ── Non-member: blurred teaser + unlock CTA ── */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-[#1B4FE4] uppercase tracking-widest mb-0.5">
                      Prime Atlas Intelligence
                    </p>
                    <h2 className="text-xl font-bold text-gray-900">Investment Analysis</h2>
                  </div>
                  <span className="text-[9px] font-bold px-3 py-1 rounded-full border text-gray-400 border-gray-200 bg-gray-50">
                    MEMBERS ONLY
                  </span>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-gray-200">
                  {/* Blurred preview */}
                  <div className="blur-sm select-none pointer-events-none p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {["Est. Gross Yield", "Net Yield", "5-Yr IRR (Est.)"].map(l => (
                        <div key={l} className="border border-gray-100 rounded-xl p-4 bg-gray-50 text-center">
                          <p className="text-xl font-black font-mono text-green-600">—.—%</p>
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mt-2">{l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="border border-gray-100 rounded-xl p-4 bg-[#F8FAFF]">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Macro Outlook</p>
                        <p className="text-sm text-gray-600 leading-relaxed">Sunbelt state with strong inbound population migration and business-friendly tax environment. Above-average rent growth expected over a 5-year horizon.</p>
                      </div>
                      <div className="border border-gray-100 rounded-xl p-4 bg-[#F8FAFF]">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Micro Outlook</p>
                        <p className="text-sm text-gray-600 leading-relaxed">Gross yield above 7% indicates strong day-one cashflow. Multi-bed configuration supports family rental demand with lower void rates.</p>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-[#F8FAFF] border-b border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Predictive Exit Architecture</p>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-gray-100">
                        {[{ y: 3, irr: "+11.2" }, { y: 5, irr: "+14.8" }, { y: 10, irr: "+17.6" }].map(({ y, irr }) => (
                          <div key={y} className="px-4 py-5 text-center">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">{y}-YR EXIT</p>
                            <p className="text-xl font-black font-mono text-green-600">{irr}%</p>
                            <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1">IRR (EST.)</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Gradient unlock overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/70 to-white flex flex-col items-center justify-end pb-10 px-6">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl px-8 py-7 text-center max-w-sm w-full">
                      <div className="w-12 h-12 bg-[#EEF3FD] rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-[#1B4FE4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="text-base font-bold text-gray-900 mb-1">Prime Atlas Intelligence</p>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Every property is fully underwritten by Prime Atlas. Members unlock:
                      </p>
                      <ul className="text-xs text-left space-y-1.5 mb-5 text-gray-600">
                        {["Gross & net yield estimates", "3yr, 5yr & 10yr IRR projections", "Macro & micro market outlook", "Predictive exit architecture", "Comparable property analysis", "Full property address & agent contact"].map(item => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="text-[#1B4FE4] font-bold flex-shrink-0">→</span>{item}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/pricing"
                        className="block w-full bg-[#1B4FE4] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#1641C0] transition-colors text-center"
                      >
                        Become a Member
                      </Link>
                      <Link
                        href="/auth/signup"
                        className="mt-2.5 block text-xs text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        Create free account →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-[#1B4FE4] uppercase tracking-widest mb-0.5">
                    Prime Atlas Intelligence
                  </p>
                  <h2 className="text-xl font-bold text-gray-900">Investment Analysis</h2>
                </div>
                <span className={`text-[9px] font-bold px-3 py-1 rounded-full border ${e.macro.color}`}>
                  {e.macro.label}
                </span>
              </div>

              {/* Key metrics */}
              {isSale ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <MetricBox
                    label="Est. Gross Yield"
                    value={`${e.grossYield}%`}
                    sub="annual"
                    accent={e.grossYield >= 7 ? "green" : e.grossYield >= 5 ? "blue" : "amber"}
                  />
                  <MetricBox
                    label="Net Yield"
                    value={`${e.netYield}%`}
                    sub="after expenses"
                    accent={e.netYield >= 5 ? "green" : e.netYield >= 3 ? "blue" : "amber"}
                  />
                  <MetricBox
                    label="5-Yr IRR (Est.)"
                    value={`${e.irr5yr > 0 ? "+" : ""}${e.irr5yr}%`}
                    sub="70% LTV"
                    accent={e.irr5yr >= 12 ? "green" : e.irr5yr >= 8 ? "blue" : "amber"}
                  />
                  <MetricBox
                    label="Est. Monthly Rent"
                    value={`${SYM[property.currency_code] ?? ""}${e.monthlyRentDisplay.toLocaleString()}`}
                    sub="market rate"
                    accent="blue"
                  />
                  {property.size_sqm != null && property.price != null ? (
                    <MetricBox
                      label="Price / sqm"
                      value={`${SYM[property.currency_code] ?? ""}${Math.round((property.price / 100) / Number(property.size_sqm)).toLocaleString()}`}
                      sub={`${SYM[property.currency_code] ?? ""}${Math.round((property.price / 100) / (Number(property.size_sqm) * 10.764)).toLocaleString()} /sqft`}
                      accent="blue"
                    />
                  ) : (
                    <MetricBox label="Price / sqm" value="—" sub="size unavailable" />
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricBox
                    label="Monthly Rent"
                    value={fmtPrice(property.price ?? 0, property.currency_code)}
                    accent="blue"
                  />
                  <MetricBox
                    label="Annual Income"
                    value={fmtPrice((property.price ?? 0) * 12, property.currency_code)}
                    accent="green"
                  />
                  <MetricBox
                    label="Strategy"
                    value={e.strategy}
                    accent="blue"
                  />
                </div>
              )}

              {/* Macro + Micro */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ThesisBlock title="Macro Outlook">
                  {e.macro.text}
                </ThesisBlock>

                <ThesisBlock title="Micro Outlook">
                  {isSale ? (
                    <>
                      {property.property_type
                        ? <><span className="capitalize font-semibold text-gray-800">{property.property_type}</span> in </>
                        : "Residential asset in "
                      }
                      <span className="font-semibold text-gray-800">{locationLabel}</span>.{" "}
                      {e.grossYield >= 7
                        ? "Gross yield above 7% indicates strong day-one cashflow. BTL fundamentals are compelling at this price point."
                        : e.grossYield >= 5
                        ? "Mid-tier yield — value-add or above-market rent growth required to hit double-digit IRR targets."
                        : "Below-average initial yield. Thesis depends on capital appreciation and refinancing upside at exit."
                      }{" "}
                      {(property.bedrooms ?? 0) >= 3
                        ? "Multi-bed configuration supports family rental demand, which typically shows lower void rates."
                        : "Smaller unit — strong liquidity at exit but higher tenant turnover risk to model."
                      }
                    </>
                  ) : (
                    <>
                      Rental asset{property.bedrooms ? ` with ${property.bedrooms} bedrooms` : ""} in{" "}
                      <span className="font-semibold text-gray-800">{locationLabel}</span>.{" "}
                      {e.country === "UK"
                        ? "UK rental market operating near record tightness. Tenant demand significantly outpaces available stock in most regions."
                        : SUNBELT.has(e.stateCode)
                        ? "Sunbelt rental market supported by continued population inflow. Above-average rent growth expected over 3–5 year horizon."
                        : "Stable rental demand profile. Vacancy rates below historical averages in most mid-market US cities."
                      }
                    </>
                  )}
                </ThesisBlock>
              </div>

              {/* Exit Architecture — sale only */}
              {isSale && (
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-[#F8FAFF] border-b border-gray-100 flex items-center justify-between">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      Predictive Exit Architecture
                    </p>
                    <p className="text-[9px] text-gray-300 font-mono">
                      70% LTV · 5% IR · 3% p.a. appreciation
                    </p>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-gray-100">
                    {([
                      { yrs: 3,  irr: e.irr3yr,  coc: e.cashOnCash, exit: e.exit3yr,  gated: false },
                      { yrs: 5,  irr: e.irr5yr,  coc: e.cashOnCash, exit: e.exit5yr,  gated: !isMember },
                      { yrs: 10, irr: e.irr10yr, coc: e.cashOnCash, exit: e.exit10yr, gated: !isMember },
                    ] as const).map(({ yrs, irr, coc, exit, gated }) => (
                      <div key={yrs} className="px-4 py-5 text-center relative">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                          {yrs}-YR EXIT
                        </p>

                        {/* Overlay for gated columns */}
                        {gated && (
                          <div className="absolute inset-x-0 bottom-0 top-8 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[3px] z-10 rounded-b-xl gap-1.5">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <p className="text-[9px] font-bold text-gray-500">Members only</p>
                            <Link href="/pricing" className="text-[9px] font-bold text-[#1B4FE4] hover:underline">Unlock →</Link>
                          </div>
                        )}

                        <div className={`space-y-4 ${gated ? "blur-sm select-none pointer-events-none" : ""}`}>
                          <div>
                            <p className={`text-xl font-black font-mono leading-none ${
                              irr >= 12 ? "text-green-600" : irr >= 8 ? "text-[#1B4FE4]" : "text-amber-600"
                            }`}>
                              {irr > 0 ? `+${irr}%` : `${irr}%`}
                            </p>
                            <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1">IRR (EST.)</p>
                          </div>
                          <div>
                            <p className={`text-base font-bold font-mono leading-none ${
                              coc >= 8 ? "text-green-600" : coc >= 4 ? "text-[#1B4FE4]" : coc >= 0 ? "text-amber-600" : "text-red-500"
                            }`}>
                              {coc > 0 ? `+${coc}%` : `${coc}%`}
                            </p>
                            <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1">CASH-ON-CASH</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold font-mono text-gray-600 leading-none">
                              {fmtPrice(Math.round(exit * 100), property.currency_code)}
                            </p>
                            <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-1">EXIT VALUE</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
                    <p className="text-[8px] text-gray-300 font-mono">
                      DISCLAIMER: Projections are illustrative estimates only. Not financial advice.
                      Actual returns depend on market conditions, financing terms, and exit timing.
                    </p>
                  </div>
                </div>
              )}
            </div>
            )} {/* end member-only Intelligence Panel */}

            {/* ── Comparable Properties ── */}
            {(comps ?? []).length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      Comparable Properties · {locationLabel}
                    </p>
                    <p className="text-[9px] text-gray-300 mt-0.5">
                      {comps.length} properties within ±40% price band
                    </p>
                  </div>
                  {!isMember && (
                    <span className="text-[9px] font-bold text-[#1B4FE4] bg-[#EEF3FD] border border-[#1B4FE4]/20 px-2 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Members only
                    </span>
                  )}
                </div>

                {isMember ? (
                  /* ── Full comparables for members ── */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {comps.map((c) => {
                      const compEnriched = enrichProperty(c);
                      return (
                        <Link
                          key={c.id}
                          href={`/market-feed/${c.id}`}
                          className="border border-gray-200 rounded-xl p-4 hover:border-[#1B4FE4]/30 hover:shadow-sm transition-all group bg-white"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-base font-black font-mono text-gray-900">
                              {fmtPrice(c.price ?? 0, c.currency_code)}
                            </p>
                            {compEnriched.grossYield > 0 && (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                compEnriched.grossYield >= 8 ? "text-green-700 bg-green-50 border-green-200" :
                                compEnriched.grossYield >= 6 ? "text-[#1B4FE4] bg-[#EEF3FD] border-[#1B4FE4]/20" :
                                "text-amber-700 bg-amber-50 border-amber-200"
                              }`}>
                                ~{compEnriched.grossYield}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 line-clamp-1 mb-0.5">
                            {c.address ?? getLocationSummary(c.address, c.currency_code === "GBP" ? "UK" : "US")}
                          </p>
                          <p className="text-[9px] text-gray-400 uppercase tracking-widest mb-2">
                            {getLocationSummary(c.address, c.currency_code === "GBP" ? "UK" : "US")}
                          </p>
                          <div className="flex gap-3 text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                            {c.bedrooms  != null && <span><span className="text-gray-700 font-bold">{c.bedrooms}</span> bd</span>}
                            {c.bathrooms != null && <span><span className="text-gray-700 font-bold">{c.bathrooms}</span> ba</span>}
                            {c.size_sqm  != null && <span><span className="text-gray-700 font-bold">{Number(c.size_sqm).toLocaleString()}</span> sqm</span>}
                            <span className="text-[9px] text-gray-300 ml-auto">{timeAgo(c.scraped_at)}</span>
                            <span className="text-[#1B4FE4] opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-[10px]">
                              Analyse →
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  /* ── Gate for non-members: show 2 teaser cards + unlock wall ── */
                  <div className="relative">
                    {/* Teaser: first 2 cards blurred */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 select-none pointer-events-none">
                      {comps.slice(0, 4).map((c, i) => (
                        <div
                          key={c.id}
                          className={`border border-gray-200 rounded-xl p-4 bg-white ${i >= 2 ? "hidden sm:block" : ""}`}
                          style={{ filter: `blur(${i === 0 ? 2 : 4}px)`, opacity: i === 0 ? 0.85 : 0.6 }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-base font-black font-mono text-gray-900">
                              {fmtPrice(c.price ?? 0, c.currency_code)}
                            </p>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded border text-[#1B4FE4] bg-[#EEF3FD] border-[#1B4FE4]/20">
                              ~{enrichProperty(c).grossYield}%
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800 mb-0.5">
                            {getLocationSummary(c.address, c.currency_code === "GBP" ? "UK" : "US")}
                          </p>
                          <div className="flex gap-3 text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                            {c.bedrooms  != null && <span><span className="text-gray-700 font-bold">{c.bedrooms}</span> bd</span>}
                            {c.bathrooms != null && <span><span className="text-gray-700 font-bold">{c.bathrooms}</span> ba</span>}
                            {c.size_sqm  != null && <span><span className="text-gray-700 font-bold">{Number(c.size_sqm).toLocaleString()}</span> sqm</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Unlock overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-white via-white/90 to-transparent rounded-2xl z-10 px-6 pt-16 pb-8">
                      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg px-8 py-7 flex flex-col items-center text-center max-w-xs w-full">
                        <div className="w-10 h-10 rounded-full bg-[#EEF3FD] flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-[#1B4FE4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-bold text-gray-900 mb-1">
                          {comps.length} Comparable{comps.length !== 1 ? "s" : ""} Found
                        </p>
                        <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                          See full comparable analysis — prices, yields, specs, and direct links — available to Prime Atlas members.
                        </p>
                        <Link
                          href="/pricing"
                          className="w-full bg-[#1B4FE4] text-white text-sm font-bold py-2.5 rounded-xl hover:bg-[#1641C0] transition-colors text-center"
                        >
                          Become a Member
                        </Link>
                        <Link
                          href="/sign-up"
                          className="mt-2 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          Create free account →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

            {/* Conviction panel */}
            <div className="border border-gray-200 rounded-2xl p-6 bg-white sticky top-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-[#1B4FE4] animate-pulse flex-shrink-0" />
                <p className="text-[10px] font-bold text-[#1B4FE4] uppercase tracking-widest">
                  Prime Atlas Score
                </p>
              </div>

              <div className="flex flex-col items-center mb-5">
                <ConvictionRing score={e.conviction} />
              </div>

              {isMember ? (
                <div className="space-y-3 mb-5">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs text-gray-500">Strategy</span>
                    <span className="text-xs font-bold text-gray-900">{e.strategy}</span>
                  </div>
                  {isSale && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-xs text-gray-500">Est. Gross Yield</span>
                        <span className={`text-xs font-bold ${
                          e.grossYield >= 7 ? "text-green-600" : e.grossYield >= 5 ? "text-[#1B4FE4]" : "text-amber-600"
                        }`}>{e.grossYield}%</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-xs text-gray-500">5-Yr IRR (Est.)</span>
                        <span className={`text-xs font-bold ${
                          e.irr5yr >= 12 ? "text-green-600" : e.irr5yr >= 8 ? "text-[#1B4FE4]" : "text-amber-600"
                        }`}>{e.irr5yr > 0 ? "+" : ""}{e.irr5yr}%</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-gray-500">Macro</span>
                    <span className={`text-xs font-bold ${
                      e.macro.sentiment === "bullish" ? "text-green-600" :
                      e.macro.sentiment === "cautious" ? "text-amber-600" : "text-gray-500"
                    }`}>{e.macro.label}</span>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-[#1B4FE4]/20 rounded-xl p-4 mb-5 bg-[#EEF3FD]/30 text-center">
                  <p className="text-[10px] font-semibold text-gray-500 mb-2 leading-relaxed">
                    Yield, IRR, macro outlook & exit projections — members only
                  </p>
                  <Link href="/pricing" className="text-xs font-bold text-[#1B4FE4] hover:underline">
                    Unlock full intelligence →
                  </Link>
                </div>
              )}

              {/* Contact gate */}
              <div className="border border-dashed border-gray-200 rounded-xl p-4 relative overflow-hidden">
                {!isMember && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
                    <svg className="w-6 h-6 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-xs font-bold text-gray-700 mb-1">Members Only</p>
                    <p className="text-[10px] text-gray-400 text-center mb-3">
                      Unlock agent contact details
                    </p>
                    <Link
                      href="/pricing"
                      className="bg-[#1B4FE4] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#1641C0] transition-colors"
                    >
                      Become a Member
                    </Link>
                  </div>
                )}
                <div className={!isMember ? "blur-sm select-none pointer-events-none" : ""}>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Enquire via Prime Atlas
                  </p>
                  <p className="text-sm font-semibold text-gray-800">Prime Atlas Research Desk</p>
                  <p className="text-xs text-gray-500 mt-0.5">contact@prime-atlas.io</p>
                  <p className="text-xs text-gray-500">+44 20 3322 0000</p>
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                    Our team will connect you with the listing agent and handle due diligence coordination.
                  </p>
                  <a
                    href={`mailto:contact@prime-atlas.io?subject=Enquiry: ${encodeURIComponent(getLocationSummary(property.address, e.country))} ${fmtPrice(property.price ?? 0, property.currency_code)}&body=I am interested in this property. Please provide agent contact details and arrange a viewing.`}
                    className="inline-flex items-center gap-1 mt-3 bg-[#1B4FE4] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#1641C0] transition-colors"
                  >
                    Send Enquiry →
                  </a>
                </div>
              </div>

              <Link
                href="/market-feed"
                className="block text-center text-xs text-gray-400 hover:text-gray-700 transition-colors mt-4"
              >
                ← Back to Market Feed
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
