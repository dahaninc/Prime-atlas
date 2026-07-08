import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { redactStreet } from "@/lib/access";
import { sanitizeListingFields, sanitizeListingRows } from "@/lib/listingSanity";
import { fetchZipCompScreens, type MarketCompScreen } from "@/lib/server/compScreens";
import { computeRealGrossYieldPct, isYieldEligible, type RentBasis } from "@/lib/realYield";
import { computeScreener } from "@/lib/screener";
import { buildMarketReport, type DemandSignal } from "@/lib/marketReport";
import { fmt, symFor } from "@/lib/money";
import { localizedPpsm } from "@/lib/proforma";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContactRequestButton } from "@/components/property/ContactRequestButton";

export const dynamic = "force-dynamic";

/* ─── types ──────────────────────────────────────────────────── */

interface Property {
  id:              string;
  provider:        string;
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

interface Municipality {
  id: string; name: string; region: string; country: string; currency_code: string | null;
  population: number;
  growth_score: number; development_score: number; infrastructure_score: number;
  liquidity_score: number; risk_score: number; opportunity_score: number;
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

/* ─── real financing scenarios (computeScreener — same engine as the
       Deal Board pro-forma and the Deal Brochure export) ─────────── */

const FIN_ASSUMPTIONS = { ltvPct: 75, amortYears: 30, vacancyPct: 5, expenseRatioPct: 40, closingCostPct: 2, exitCapPct: 5.5, holdYears: 5 };
const FIN_RATES = [5.5, 6.5, 7.5];

interface FinancingRow {
  ratePct: number;
  monthlyPI: string;         // always real — depends only on price, never on rent
  dscr: number | null;       // null unless the market clears the real rent-comp gate
  capRatePct: number | null; // "net yield" — NOI/price, null unless real rent basis
  cashOnCashPct: number | null;
  exitValue: string | null;  // NOI/exit-cap at labeled assumptions, null unless real rent basis
  cashToClose: string;
}

function buildFinancing(priceMinor: number, sym: string, yieldEligible: boolean, medianRentMinor: number | null): FinancingRow[] {
  const priceMajor = priceMinor / 100;
  return FIN_RATES.map((ratePct) => {
    const out = computeScreener({
      purchasePrice: priceMajor, units: 1,
      avgRentMo: yieldEligible && medianRentMinor != null ? medianRentMinor / 100 : 0,
      otherIncomeYr: 0, vacancyPct: FIN_ASSUMPTIONS.vacancyPct, expenseRatioPct: FIN_ASSUMPTIONS.expenseRatioPct,
      ltvPct: FIN_ASSUMPTIONS.ltvPct, interestPct: ratePct, amortYears: FIN_ASSUMPTIONS.amortYears,
      closingCostPct: FIN_ASSUMPTIONS.closingCostPct, exitCapPct: FIN_ASSUMPTIONS.exitCapPct,
      holdYears: FIN_ASSUMPTIONS.holdYears, rentGrowthPct: 0,
    });
    return {
      ratePct,
      monthlyPI: fmt(out.annualDebtService / 12, sym),
      dscr: yieldEligible ? Math.round(out.dscr * 100) / 100 : null,
      capRatePct: yieldEligible ? Math.round(out.capRate * 10) / 10 : null,
      cashOnCashPct: yieldEligible ? Math.round(out.cashOnCash * 10) / 10 : null,
      exitValue: yieldEligible ? fmt(out.exitValue, sym) : null,
      cashToClose: fmt(out.equity, sym),
    };
  });
}

/* ─── sub-components ─────────────────────────────────────────── */

function ScoreRing({ score, label, caption }: { score: number; label: string; caption: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? "#16a34a" : score >= 55 ? "#2563eb" : "#d97706";

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
          <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider -mt-0.5">/ 100</span>
        </div>
      </div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 text-center">{label}</p>
      <p className="text-[9px] text-zinc-600 mt-0.5 text-center leading-relaxed max-w-[160px]">{caption}</p>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-primary" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[10px] text-zinc-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-400 w-6 text-right">{score}</span>
    </div>
  );
}

function MetricBox({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: "green" | "blue" | "amber" | "red" | "muted";
}) {
  const valueColor =
    accent === "green" ? "text-emerald-400" :
    accent === "blue"  ? "text-primary" :
    accent === "amber" ? "text-amber-400" :
    accent === "red"   ? "text-red-500"   :
    accent === "muted" ? "text-zinc-500"  :
    "text-foreground";

  return (
    <div className="border border-border rounded-xl p-4 bg-background text-center">
      <p className={`text-xl font-black font-mono leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-[9px] text-zinc-500 mt-0.5">{sub}</p>}
      <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mt-2">{label}</p>
    </div>
  );
}

function SignalCard({ signal }: { signal: DemandSignal }) {
  const color = signal.reading === "strong" ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5"
    : signal.reading === "soft" ? "text-amber-400 border-amber-500/25 bg-amber-500/5"
    : "text-zinc-400 border-border bg-background";
  return (
    <div className={`border rounded-xl p-4 ${color}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest">{signal.label}</p>
        <p className="text-xs font-mono font-bold">{signal.value}</p>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{signal.note}</p>
    </div>
  );
}

function CompEvidenceTable({ comps, sym, country }: { comps: { address: string | null; price: number; ppsqm: number }[]; sym: string; country: string }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-card border-b border-border">
        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Comparable evidence — {comps.length} listings</p>
      </div>
      <div className="divide-y divide-border">
        {comps.map((c, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2 text-[11px]">
            <span className="text-zinc-400 truncate mr-3">{c.address ?? "Address on file"}</span>
            <span className="font-mono text-zinc-300 shrink-0">{fmt(c.price / 100, sym)} · {localizedPpsm(c.ppsqm, country, sym)}</span>
          </div>
        ))}
      </div>
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
    description: `Investment analysis for ${locationTitle} — real market rent comps, ZIP-level comparable pricing, and financing scenarios from Prime Atlas.`,
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
      .select("id, provider, address, price, currency_code, bedrooms, bathrooms, size_sqm, property_type, listing_type, scraped_at, images, agent_name, agent_company, agent_phone, agent_email, municipality_id")
      .eq("id", id)
      .eq("status", "active")
      .single(),
  ]);

  if (!p) notFound();

  // Stopgap against confirmed scraper corruption (onthemarket/zillow) — see
  // src/lib/listingSanity.ts. Nulls (never fabricates) an implausible
  // price/size_sqm/bedrooms.
  const property = sanitizeListingFields(p as unknown as Property);
  const country: "UK" | "US" = property.currency_code === "GBP" ? "UK" : "US";
  const isSale = property.listing_type === "sale";

  // Membership gate
  const { data: profile } = user
    ? await supabase.from("profiles").select("subscription_tier").eq("id", user.id).single()
    : { data: null };
  const tier = (profile as { subscription_tier?: string } | null)?.subscription_tier ?? "free";
  const isMember = ["explorer", "professional", "institutional"].includes(tier);

  // Check if this member already requested agent details for this property
  let alreadySent = false;
  if (user && isMember) {
    const admin = adminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: existing } = await admin
      .from("contact_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("property_id", id)
      .maybeSingle();
    alreadySent = !!existing;
  }

  /*
   * ── Real market intelligence ─────────────────────────────────────
   * Replaces the old enrichProperty() heuristic (hardcoded state-rent
   * lookup table + fixed appreciation/conviction formulas, zero real data
   * input — see the 2026-07-09 market-feed audit). Every figure below
   * comes from the same engines the Deal Board, Investment Analysis
   * Report, and Deal Brochure already use: real market-rent comps
   * (market_rent_stats, >=10 comps), the ZIP-level comp screen
   * (src/lib/comps.ts, >=5 same-ZIP/type/bedroom comps), and the real
   * screener/pro-forma engine for financing math. Below any real-data
   * threshold: an explicit "insufficient data" state, never a fallback
   * estimate.
   */
  const [{ data: muniRaw }, { data: rentStats }] = property.municipality_id
    ? await Promise.all([
        supabase.from("municipalities")
          .select("id, name, region, country, currency_code, population, growth_score, development_score, infrastructure_score, liquidity_score, risk_score, opportunity_score")
          .eq("id", property.municipality_id).maybeSingle(),
        supabase.from("market_rent_stats")
          .select("rent_comp_count, median_rent_price")
          .eq("municipality_id", property.municipality_id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const muni = muniRaw as unknown as Municipality | null;

  const rentBasis: RentBasis | null = rentStats
    ? { rentCompCount: rentStats.rent_comp_count ?? 0, medianRentPriceMinor: rentStats.median_rent_price != null ? Number(rentStats.median_rent_price) : null }
    : null;
  const yieldEligible = isYieldEligible(rentBasis);
  const grossYieldPct = computeRealGrossYieldPct(property.price, rentBasis);

  // ZIP-comp discount screen — US only (UK has ~0% usable size_sqm/postcode
  // data, structurally uncovered; see src/lib/server/compScreens.ts).
  let marketScreen: MarketCompScreen | null = null;
  if (muni && muni.country === "United States") {
    const screens = await fetchZipCompScreens(supabase, [muni.id]);
    marketScreen = screens.get(muni.id) ?? null;
  }
  const compEntry = marketScreen?.screen.byId.get(property.id);
  const discountPct = compEntry?.status === "mispriced" ? compEntry.discountPct : null;
  const discountComps = compEntry?.status === "mispriced" ? compEntry.comps : [];
  const discountBasisLabel = compEntry?.status === "mispriced" ? compEntry.basisLabel : null;
  const discountUnavailableReason: "not_covered" | "insufficient" | "implausible" | null =
    !muni ? "not_covered"
    : muni.country !== "United States" ? "not_covered"
    : compEntry?.status === "implausible" ? "implausible"
    : compEntry?.status !== "mispriced" ? "insufficient"
    : null;

  const sym = SYM[property.currency_code] ?? "";
  const financing = isSale && property.price ? buildFinancing(property.price, sym, yieldEligible, rentBasis?.medianRentPriceMinor ?? null) : [];

  // Real demand-signal narrative (src/lib/marketReport.ts) — the same
  // deterministic engine the Deal Board memo uses. No canned per-geography
  // paragraphs. No momentum/trend framing: market_score_history only has 2
  // snapshot days on record today, so history is deliberately NOT passed —
  // buildMarketReport requires >=2 points to emit a momentum signal, and
  // passing none means it never fabricates a trend from a single delta.
  const demandSignals: DemandSignal[] = muni ? buildMarketReport({
    muni: {
      id: muni.id, name: muni.name, region: muni.region, country: muni.country,
      currency_code: muni.currency_code, population: muni.population,
      opportunity_score: muni.opportunity_score, growth_score: muni.growth_score,
      risk_score: muni.risk_score, development_score: muni.development_score,
      infrastructure_score: muni.infrastructure_score, liquidity_score: muni.liquidity_score,
    },
    stats: {
      sale_count: marketScreen?.screen.totalCount ?? null,
      rent_count: rentBasis?.rentCompCount ?? null,
      median_price: null, median_ppsqm: null, // not fetched on this page — see module docstring
      underpriced_count: marketScreen?.screen.mispricingCount ?? 0,
    },
    history: [],
    countryMedianPpsqm: null,
    mispricingBasis: "zip_comps",
  }).demandSignals : [];

  // Comparable properties — SAME MARKET, similar price (±40%). Previously
  // unfiltered by municipality (a $400K comp could be any market sharing a
  // price band with no geographic basis) — fixed alongside removing the
  // fabricated per-comp yield badge that depended on it.
  const priceMin = Math.round((property.price ?? 0) * 0.60);
  const priceMax = Math.round((property.price ?? 0) * 1.40);
  const { data: rawComps } = property.municipality_id ? await supabase
    .from("properties")
    .select("id, address, price, currency_code, bedrooms, bathrooms, size_sqm, property_type, listing_type, scraped_at")
    .eq("status", "active")
    .eq("municipality_id", property.municipality_id)
    .eq("listing_type", property.listing_type)
    .neq("id", property.id)
    .gte("price", priceMin)
    .lte("price", priceMax)
    .order("scraped_at", { ascending: false })
    .limit(6) : { data: [] };

  const comps = sanitizeListingRows((rawComps ?? []) as unknown as Property[]);

  // Server-side redaction for non-members: locality-only address, zero
  // photos. (Blur-only gating leaks the address into the DOM — never rely
  // on CSS for this.)
  const photoCount = (Array.isArray(property.images) ? (property.images as string[]) : [])
    .filter((img) => typeof img === "string" && img.startsWith("http")).length;
  if (!isMember) {
    property.images = [];
    property.address = redactStreet(property.address);
    for (const c of comps) c.address = redactStreet(c.address);
  }

  const locationLabel = country === "UK"
    ? getUKRegion(property.address)
    : STATE_NAMES[getState(property.address)] ?? getState(property.address);

  return (
    <>
      <Navbar user={user} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <nav className="text-xs text-zinc-500 mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-zinc-200 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/market-feed" className="hover:text-zinc-200 transition-colors">Market Feed</Link>
          <span>/</span>
          <span className="text-zinc-300 line-clamp-1">{getLocationSummary(property.address, country)}</span>
        </nav>

        {/* Photos gate — non-members see the count, never the images */}
        {!isMember && photoCount > 0 && (
          <div className="w-full rounded-2xl border border-primary/25 bg-primary/5 mb-8 px-6 py-8 text-center">
            <p className="text-sm font-bold mb-1">{photoCount} photo{photoCount > 1 ? "s" : ""} of this property — members only</p>
            <p className="text-xs text-muted-foreground mb-4">
              Full photo gallery, street address and agent contact unlock with membership.
            </p>
            <Link href="/pricing" className="bg-primary text-white font-semibold text-xs px-5 py-2 rounded-lg hover:bg-primary/85 transition-colors inline-block">
              Unlock from $29.99/mo →
            </Link>
          </div>
        )}

        {/* Property image hero */}
        {(() => {
          const images = Array.isArray(property.images) ? (property.images as string[]) : [];
          const heroImg = images.find(img => img && img.startsWith("http"));
          return heroImg ? (
            <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden mb-8 bg-secondary">
              <Image
                src={heroImg}
                alt={`Property in ${locationLabel}`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 75vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-4 left-5">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  isSale ? "text-emerald-400 bg-emerald-500/10" : "text-primary bg-primary/10"
                }`}>
                  {isSale ? "For Sale" : "For Rent"}
                </span>
              </div>
            </div>
          ) : null;
        })()}

        {/* Full photo gallery — every image captured from the source listing */}
        {(() => {
          const images = (Array.isArray(property.images) ? (property.images as string[]) : [])
            .filter((img) => img && img.startsWith("http"));
          if (images.length < 2) return null;
          return (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Photo gallery
                </p>
                <span className="text-[10px] text-zinc-500">{images.length} photos</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {images.slice(1).map((img, i) => (
                  <a key={img} href={img} target="_blank" rel="noopener noreferrer"
                     className="relative aspect-[4/3] rounded-lg overflow-hidden bg-secondary group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Property photo ${i + 2}`}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Main column ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Hero */}
            <div className="border border-border rounded-2xl p-6 bg-card">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  isSale ? "text-emerald-400 bg-emerald-500/10" : "text-primary bg-primary/10"
                }`}>
                  {isSale ? "For Sale" : "For Rent"}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-zinc-500 bg-secondary">
                  {country === "UK" ? "🇬🇧 UK" : "🇺🇸 USA"}
                </span>
                {property.property_type && (
                  <span className="text-[9px] text-zinc-500 capitalize border border-border rounded px-2 py-0.5">
                    {property.property_type}
                  </span>
                )}
                <span className="text-[9px] text-zinc-500 ml-auto">{timeAgo(property.scraped_at)}</span>
              </div>

              <p className="text-4xl sm:text-5xl font-black text-foreground leading-none tabular-nums mb-3">
                {fmtPrice(property.price ?? 0, property.currency_code)}
                {!isSale && <span className="text-base font-semibold text-zinc-500 ml-2">/mo</span>}
              </p>

              {/* Address — full street address gated behind membership */}
              {isMember ? (
                <p className="text-base font-semibold text-zinc-200 mb-1">
                  {property.address ?? "Address unavailable"}
                </p>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-base font-semibold text-zinc-200 blur-sm select-none">
                    {property.address ?? "123 Example Street"}
                  </p>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Members only
                  </span>
                </div>
              )}
              <p className="text-xs text-zinc-500 uppercase tracking-widest">{locationLabel}</p>

              {/* Specs */}
              <div className="flex flex-wrap gap-5 mt-5 pt-5 border-t border-border">
                {property.bedrooms  != null && (
                  <div className="text-center">
                    <p className="text-2xl font-black font-mono text-foreground">{property.bedrooms}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Bedrooms</p>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="text-center">
                    <p className="text-2xl font-black font-mono text-foreground">{property.bathrooms}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Bathrooms</p>
                  </div>
                )}
                {property.size_sqm  != null && (
                  <div className="text-center">
                    <p className="text-2xl font-black font-mono text-foreground">
                      {Number(property.size_sqm).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">sqm</p>
                  </div>
                )}
                {property.size_sqm != null && property.price != null && isSale && (() => {
                  const s = SYM[property.currency_code] ?? "";
                  const priceRaw = property.price / 100;
                  const sqm = Number(property.size_sqm);
                  const perSqm  = Math.round(priceRaw / sqm);
                  const perSqft = Math.round(priceRaw / (sqm * 10.764));
                  return (
                    <>
                      <div className="text-center">
                        <p className="text-2xl font-black font-mono text-primary">
                          {s}{perSqm.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest">per sqm</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-black font-mono text-primary">
                          {s}{perSqft.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest">per sq ft</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── Intelligence Panel ── */}
            {!isMember ? (
              /* ── Non-member: blurred teaser + unlock CTA — structure-only
                   placeholders ("—.—%"), never a specific fabricated number,
                   even decoratively. ── */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-primary uppercase tracking-widest mb-0.5">
                      Prime Atlas Intelligence
                    </p>
                    <h2 className="text-xl font-bold text-foreground">Investment Analysis</h2>
                  </div>
                  <span className="text-[9px] font-bold px-3 py-1 rounded-full border text-zinc-500 border-border bg-background">
                    MEMBERS ONLY
                  </span>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-border">
                  {/* Blurred preview */}
                  <div className="blur-sm select-none pointer-events-none p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {["Gross Yield", "Discount vs Comps", "Monthly P&I"].map(l => (
                        <div key={l} className="border border-border rounded-xl p-4 bg-background text-center">
                          <p className="text-xl font-black font-mono text-emerald-400">—.—</p>
                          <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mt-2">{l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="border border-border rounded-xl p-4 bg-card">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Demand Signals</p>
                        <p className="text-sm text-zinc-400 leading-relaxed">Real, market-derived demand-signal narrative for this listing&apos;s market.</p>
                      </div>
                      <div className="border border-border rounded-xl p-4 bg-card">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Comparable Evidence</p>
                        <p className="text-sm text-zinc-400 leading-relaxed">The real ZIP-level comparables behind this listing&apos;s pricing view.</p>
                      </div>
                    </div>
                    <div className="border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-card border-b border-border">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Financing Scenarios</p>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-border">
                        {FIN_RATES.map((r) => (
                          <div key={r} className="px-4 py-5 text-center">
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{r}% RATE</p>
                            <p className="text-xl font-black font-mono text-emerald-400">—.—</p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1">MONTHLY P&amp;I</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Gradient unlock overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/70 to-white flex flex-col items-center justify-end pb-10 px-6">
                    <div className="bg-card border border-border rounded-2xl shadow-xl px-8 py-7 text-center max-w-sm w-full">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="text-base font-bold text-foreground mb-1">Prime Atlas Intelligence</p>
                      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                        Every property is analyzed against real market data. Members unlock:
                      </p>
                      <ul className="text-xs text-left space-y-1.5 mb-5 text-zinc-400">
                        {["Real gross yield from live rent comps", "ZIP-level discount with comparable evidence", "Illustrative financing scenarios", "Real market demand signals", "Comparable property analysis", "Full property address & agent contact"].map(item => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="text-primary font-bold flex-shrink-0">→</span>{item}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/pricing"
                        className="block w-full bg-primary text-white text-sm font-bold py-2.5 rounded-xl hover:bg-primary/85 transition-colors text-center"
                      >
                        Become a Member
                      </Link>
                      <Link
                        href="/auth/signup"
                        className="mt-2.5 block text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
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
                  <p className="text-[9px] font-bold text-primary uppercase tracking-widest mb-0.5">
                    Prime Atlas Intelligence
                  </p>
                  <h2 className="text-xl font-bold text-foreground">Investment Analysis</h2>
                </div>
                <span className="text-[9px] font-bold px-3 py-1 rounded-full border text-zinc-400 border-border bg-background">
                  {muni ? muni.name.toUpperCase() : "MARKET DATA"}
                </span>
              </div>

              {/* Key metrics */}
              {isSale ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <MetricBox
                    label="Gross Yield"
                    value={grossYieldPct != null ? `${grossYieldPct.toFixed(1)}%` : "—"}
                    sub={grossYieldPct != null ? `${rentBasis!.rentCompCount} rent comps` : "insufficient rent-comp data"}
                    accent={grossYieldPct == null ? "muted" : grossYieldPct >= 7 ? "green" : grossYieldPct >= 5 ? "blue" : "amber"}
                  />
                  <MetricBox
                    label="Net Yield"
                    value={financing[1]?.capRatePct != null ? `${financing[1].capRatePct}%` : "—"}
                    sub={financing[1]?.capRatePct != null ? "after vacancy & opex" : "insufficient rent-comp data"}
                    accent={financing[1]?.capRatePct == null ? "muted" : financing[1].capRatePct >= 5 ? "green" : financing[1].capRatePct >= 3 ? "blue" : "amber"}
                  />
                  <MetricBox
                    label="Discount vs Comps"
                    value={discountPct != null ? `−${Math.abs(discountPct).toFixed(1)}%` : "—"}
                    sub={discountPct != null ? `${discountComps.length} ZIP comps` : discountUnavailableReason === "not_covered" ? "not covered" : "insufficient comp data"}
                    accent={discountPct == null ? "muted" : "green"}
                  />
                  <MetricBox
                    label="Monthly P&I"
                    value={financing[1]?.monthlyPI ?? "—"}
                    sub="at 6.5%, illustrative"
                    accent="blue"
                  />
                  {property.size_sqm != null && property.price != null ? (
                    <MetricBox
                      label="Price / sqm"
                      value={`${sym}${Math.round((property.price / 100) / Number(property.size_sqm)).toLocaleString()}`}
                      sub={`${sym}${Math.round((property.price / 100) / (Number(property.size_sqm) * 10.764)).toLocaleString()} /sqft`}
                      accent="blue"
                    />
                  ) : (
                    <MetricBox label="Price / sqm" value="—" sub="size unavailable" />
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                </div>
              )}

              {/* Real demand signals + this listing's comp evidence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-border rounded-xl p-4 bg-card">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5">
                    Demand Signals — {muni?.name ?? "Market"}
                  </p>
                  {demandSignals.length > 0 ? (
                    <div className="space-y-2">
                      {demandSignals.slice(0, 2).map((s) => (
                        <div key={s.label}>
                          <p className="text-[11px] text-zinc-300 font-semibold">{s.label}: <span className="font-mono">{s.value}</span></p>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">{s.note}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500 leading-relaxed">Insufficient market data for a demand-signal read in this market.</p>
                  )}
                </div>

                <div className="border border-border rounded-xl p-4 bg-card">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5">This Listing — Pricing Basis</p>
                  {discountPct != null ? (
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      <span className="text-emerald-400 font-bold">{Math.abs(discountPct).toFixed(1)}% below</span> the median of {discountComps.length} live comparables
                      ({discountBasisLabel}). See the full comparable table below.
                    </p>
                  ) : discountUnavailableReason === "not_covered" ? (
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      {country === "UK"
                        ? "UK markets lack the size/postcode data this comparison requires today — no discount is computed or implied."
                        : "No market context available for this listing — no discount is computed or implied."}
                    </p>
                  ) : discountUnavailableReason === "implausible" ? (
                    <p className="text-[11px] text-amber-400 leading-relaxed">
                      Flagged as a likely data error (beyond ±60% of its comparable basis) — not shown as a discount.
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Insufficient comparable data — fewer than 5 live same-ZIP/type/bedroom comps exist for this listing today.
                    </p>
                  )}
                </div>
              </div>

              {discountPct != null && discountComps.length > 0 && (
                <CompEvidenceTable comps={discountComps} sym={sym} country={country === "UK" ? "United Kingdom" : "United States"} />
              )}

              {demandSignals.length > 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {demandSignals.slice(2, 4).map((s) => <SignalCard key={s.label} signal={s} />)}
                </div>
              )}

              {/* Financing Scenarios — sale only */}
              {isSale && financing.length > 0 && (
                <div className="border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-card border-b border-border flex items-center justify-between flex-wrap gap-1">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      Financing Scenarios
                    </p>
                    <p className="text-[9px] text-zinc-600 font-mono">
                      {FIN_ASSUMPTIONS.ltvPct}% LTV · {FIN_ASSUMPTIONS.amortYears}yr amort · {FIN_ASSUMPTIONS.vacancyPct}% vacancy · {FIN_ASSUMPTIONS.expenseRatioPct}% opex · {FIN_ASSUMPTIONS.exitCapPct}% exit cap, {FIN_ASSUMPTIONS.holdYears}yr hold
                    </p>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border">
                    {financing.map((f) => (
                      <div key={f.ratePct} className="px-4 py-5 text-center">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
                          {f.ratePct}% RATE
                        </p>
                        <div className="space-y-4">
                          <div>
                            <p className="text-base font-bold font-mono text-foreground leading-none">{f.monthlyPI}</p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1">MONTHLY P&amp;I</p>
                          </div>
                          <div>
                            <p className="text-base font-bold font-mono leading-none text-zinc-300">
                              {f.dscr != null ? f.dscr.toFixed(2) : "n/a — no real rent basis"}
                            </p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1">DSCR</p>
                          </div>
                          <div>
                            <p className={`text-base font-bold font-mono leading-none ${
                              f.cashOnCashPct == null ? "text-zinc-500" : f.cashOnCashPct >= 8 ? "text-emerald-400" : f.cashOnCashPct >= 4 ? "text-primary" : f.cashOnCashPct >= 0 ? "text-amber-400" : "text-red-500"
                            }`}>
                              {f.cashOnCashPct != null ? `${f.cashOnCashPct > 0 ? "+" : ""}${f.cashOnCashPct}%` : "n/a"}
                            </p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1">CASH-ON-CASH</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold font-mono text-zinc-400 leading-none">
                              {f.exitValue ?? "n/a"}
                            </p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-1">EXIT VALUE ({FIN_ASSUMPTIONS.holdYears}YR)</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-5 py-2.5 bg-background border-t border-border">
                    <p className="text-[8px] text-zinc-600 font-mono">
                      DISCLAIMER: Illustrative financing scenarios at stated assumptions — not a quote, not an offer of
                      credit. DSCR/cash-on-cash/exit value require a real market rent basis and read &quot;n/a&quot; without one.
                      Not financial advice. Actual returns depend on market conditions, financing terms, and exit timing.
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
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      Comparable Properties · {locationLabel}
                    </p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">
                      {comps.length} properties in the same market within ±40% price band
                    </p>
                  </div>
                  {!isMember && (
                    <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-full flex items-center gap-1">
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
                      const compDiscount = marketScreen?.screen.byId.get(c.id);
                      const badgeDiscount = compDiscount?.status === "mispriced" ? compDiscount.discountPct : null;
                      const badgeYield = computeRealGrossYieldPct(c.price, rentBasis);
                      return (
                        <Link
                          key={c.id}
                          href={`/market-feed/${c.id}`}
                          className="border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all group bg-card"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-base font-black font-mono text-foreground">
                              {fmtPrice(c.price ?? 0, c.currency_code)}
                            </p>
                            {badgeDiscount != null ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/25">
                                −{Math.abs(badgeDiscount).toFixed(1)}%
                              </span>
                            ) : badgeYield != null && (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                badgeYield >= 8 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" :
                                badgeYield >= 6 ? "text-primary bg-primary/10 border-primary/20" :
                                "text-amber-400 bg-amber-500/10 border-amber-500/25"
                              }`}>
                                ~{badgeYield.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-zinc-200 line-clamp-1 mb-0.5">
                            {c.address ?? getLocationSummary(c.address, c.currency_code === "GBP" ? "UK" : "US")}
                          </p>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">
                            {getLocationSummary(c.address, c.currency_code === "GBP" ? "UK" : "US")}
                          </p>
                          <div className="flex gap-3 text-[10px] text-zinc-500 pt-2 border-t border-border">
                            {c.bedrooms  != null && <span><span className="text-zinc-300 font-bold">{c.bedrooms}</span> bd</span>}
                            {c.bathrooms != null && <span><span className="text-zinc-300 font-bold">{c.bathrooms}</span> ba</span>}
                            {c.size_sqm  != null && <span><span className="text-zinc-300 font-bold">{Number(c.size_sqm).toLocaleString()}</span> sqm</span>}
                            <span className="text-[9px] text-zinc-600 ml-auto">{timeAgo(c.scraped_at)}</span>
                            <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-[10px]">
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
                          className={`border border-border rounded-xl p-4 bg-card ${i >= 2 ? "hidden sm:block" : ""}`}
                          style={{ filter: `blur(${i === 0 ? 2 : 4}px)`, opacity: i === 0 ? 0.85 : 0.6 }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-base font-black font-mono text-foreground">
                              {fmtPrice(c.price ?? 0, c.currency_code)}
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-zinc-200 mb-0.5">
                            {getLocationSummary(c.address, c.currency_code === "GBP" ? "UK" : "US")}
                          </p>
                          <div className="flex gap-3 text-[10px] text-zinc-500 pt-2 border-t border-border">
                            {c.bedrooms  != null && <span><span className="text-zinc-300 font-bold">{c.bedrooms}</span> bd</span>}
                            {c.bathrooms != null && <span><span className="text-zinc-300 font-bold">{c.bathrooms}</span> ba</span>}
                            {c.size_sqm  != null && <span><span className="text-zinc-300 font-bold">{Number(c.size_sqm).toLocaleString()}</span> sqm</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Unlock overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-white via-white/90 to-transparent rounded-2xl z-10 px-6 pt-16 pb-8">
                      <div className="bg-card border border-border rounded-2xl shadow-lg px-8 py-7 flex flex-col items-center text-center max-w-xs w-full">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-bold text-foreground mb-1">
                          {comps.length} Comparable{comps.length !== 1 ? "s" : ""} Found
                        </p>
                        <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
                          See full comparable analysis — prices, yields, specs, and direct links — available to Prime Atlas members.
                        </p>
                        <Link
                          href="/pricing"
                          className="w-full bg-primary text-white text-sm font-bold py-2.5 rounded-xl hover:bg-primary/85 transition-colors text-center"
                        >
                          Become a Member
                        </Link>
                        <Link
                          href="/sign-up"
                          className="mt-2 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
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

            {/* Market index panel */}
            <div className="border border-border rounded-2xl p-6 bg-card sticky top-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  Prime Atlas Market Index
                </p>
              </div>

              {muni ? (
                <>
                  <div className="flex flex-col items-center mb-4">
                    <ScoreRing score={muni.opportunity_score} label="Opportunity Score" caption={`${muni.name} market index — not a property-specific score`} />
                  </div>
                  <div className="mb-5">
                    <ScoreBar label="Growth" score={muni.growth_score} />
                    <ScoreBar label="Development" score={muni.development_score} />
                    <ScoreBar label="Infrastructure" score={muni.infrastructure_score} />
                    <ScoreBar label="Liquidity" score={muni.liquidity_score} />
                    <ScoreBar label="Risk" score={muni.risk_score} />
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-zinc-500 mb-5">No market context available for this listing.</p>
              )}

              {isMember ? (
                <div className="space-y-3 mb-5">
                  {isSale && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-xs text-zinc-500">Gross Yield</span>
                        <span className={`text-xs font-bold ${
                          grossYieldPct == null ? "text-zinc-500" : grossYieldPct >= 7 ? "text-emerald-400" : grossYieldPct >= 5 ? "text-primary" : "text-amber-400"
                        }`}>{grossYieldPct != null ? `${grossYieldPct.toFixed(1)}%` : "insufficient data"}</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-xs text-zinc-500">Discount vs Comps</span>
                        <span className={`text-xs font-bold ${discountPct != null ? "text-emerald-400" : "text-zinc-500"}`}>
                          {discountPct != null ? `−${Math.abs(discountPct).toFixed(1)}%` : "insufficient data"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-primary/20 rounded-xl p-4 mb-5 bg-primary/10/30 text-center">
                  <p className="text-[10px] font-semibold text-zinc-500 mb-2 leading-relaxed">
                    Real yield, discount, and financing scenarios — members only
                  </p>
                  <Link href="/pricing" className="text-xs font-bold text-primary hover:underline">
                    Unlock full intelligence →
                  </Link>
                </div>
              )}

              {/* Agent details / contact request */}
              <div className="border border-dashed border-border rounded-xl p-4 relative overflow-hidden">
                {!isMember ? (
                  /* Non-member gate */
                  <div className="flex flex-col items-center text-center py-2">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold text-zinc-300 mb-1">Members Only</p>
                    <p className="text-[10px] text-zinc-500 text-center mb-3 leading-relaxed">
                      Members receive the full property research report including agent contact details, real yield and comparable analysis, and financing scenarios — delivered to your inbox.
                    </p>
                    <Link
                      href="/pricing"
                      className="bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors"
                    >
                      Become a Member
                    </Link>
                  </div>
                ) : (
                  /* Member: button + description */
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                      Agent Details & Research Report
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed mb-4">
                      Receive a full research report delivered to your email, including agent contact, real yield/discount analysis, and financing scenarios.
                    </p>
                    <ContactRequestButton
                      propertyId={property.id}
                      userEmail={user?.email ?? ""}
                      alreadySent={alreadySent}
                    />
                  </div>
                )}
              </div>

              <Link
                href="/market-feed"
                className="block text-center text-xs text-zinc-500 hover:text-zinc-200 transition-colors mt-4"
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
