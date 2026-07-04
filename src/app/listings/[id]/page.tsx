import React from "react";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ImageGallery } from "@/components/listings/ImageGallery";
import { InquireForm } from "@/components/listings/InquireForm";
import { ComparablesPanel } from "@/components/listings/ComparablesPanel";
import { scoreColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* ─── helpers ─────────────────────────────────────────────────── */

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£", USD: "$",
};

function formatPrice(pence: number, currency: string): string {
  const sym    = CURRENCY_SYMBOL[currency] ?? currency;
  const amount = pence / 100;
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `${sym}${(amount / 1_000).toFixed(0)}K`;
  return `${sym}${amount.toLocaleString()}`;
}

/** Returns city/county only — no street, no postcode */
function getLocationSummary(address: string, country?: string | null): string {
  const parts = address.split(",").map(s => s.trim()).filter(Boolean);
  if (country === "United States" || /,\s*[A-Z]{2}\s+\d{5}/.test(address)) {
    const stateZip = parts.findIndex(p => /^[A-Z]{2}\s+\d{5}/.test(p));
    if (stateZip > 0) return `${parts[stateZip - 1]}, ${parts[stateZip].split(/\s+/)[0]}`;
    if (parts.length >= 2) return parts.slice(-2).join(", ");
  }
  const filtered = parts.filter(p => !/^[A-Z]{1,2}\d/.test(p));
  if (filtered.length >= 2) return filtered.slice(-2).join(", ");
  return parts.at(-1) ?? address;
}

const LISTING_TYPE_LABEL: Record<string, string> = {
  "land":              "Land",
  "residential":       "Residential",
  "commercial":        "Commercial",
  "mixed-use":         "Mixed-use",
  "development-site":  "Development Site",
  "industrial":        "Industrial",
  "pbsa":              "PBSA",
};

const PLANNING_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  "with-permission":       { label: "Planning Granted",  classes: "text-pa-green border-pa-green/30 bg-pa-green/5" },
  "outline":               { label: "Outline Consent",   classes: "text-pa-amber border-pa-amber/30 bg-pa-amber/5" },
  "unconsented":           { label: "No Consent",        classes: "text-muted-foreground border-border bg-secondary/30" },
  "freehold":              { label: "Freehold",          classes: "text-blue-400 border-blue-400/30 bg-blue-400/5" },
  "permitted-development": { label: "PD Rights",         classes: "text-purple-400 border-purple-400/30 bg-purple-400/5" },
};

const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States":  "🇺🇸",
};

/* ─── investment thesis helpers ────────────────────────────────── */

type ListingForThesis = {
  asking_price: number;
  currency_code: string;
  gross_yield_pct?: number | null;
  annual_income?: number | null;
  listing_type?: string;
};

type MuniForThesis = {
  name: string;
  country: string;
  opportunity_score: number;
  growth_score: number;
  risk_score: number;
  population?: number;
} | null;

function deriveCapRate(l: ListingForThesis): number | null {
  if (l.gross_yield_pct) return Number(l.gross_yield_pct);
  if (l.annual_income && l.asking_price)
    return Math.round(((l.annual_income / (l.asking_price / 100)) * 100) * 10) / 10;
  return null;
}

/** Rough IRR estimate: simplified Gordon Growth Model proxy */
function calcIRR(capRate: number, holdYears: number, annualAppreciation = 0.03): number {
  // IRR ≈ cap rate + (exit premium from appreciation) / hold years
  const exitPremium = (Math.pow(1 + annualAppreciation, holdYears) - 1);
  return Math.round((capRate + (exitPremium * 100) / holdYears) * 10) / 10;
}

/** Cash-on-cash at 70% LTV, 5% interest rate */
function calcCashOnCash(capRate: number, ltv = 0.70, interestRate = 0.05): number {
  const equityFraction = 1 - ltv;
  const debtServicePct = ltv * interestRate * 100; // as % of total value
  const netCashFlow = capRate - debtServicePct;
  return Math.round((netCashFlow / (equityFraction * 100)) * 1000) / 10;
}

function MetricCell({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean | null;
}) {
  const colorClass =
    positive === true ? "text-pa-green" :
    positive === false ? "text-red-400" :
    "text-foreground";

  return (
    <div className="text-center px-3 py-3 border-r border-border/40 last:border-r-0">
      <p className={`text-base font-bold font-mono leading-none ${colorClass}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>}
      <p className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function ThesisBlock({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-secondary/10">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[9px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest">
          {title}
        </span>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function InvestmentThesis({
  listing,
  muni,
}: {
  listing: ListingForThesis;
  muni: MuniForThesis;
}) {
  const capRate = deriveCapRate(listing);
  const price   = listing.asking_price / 100;
  const sym     = { GBP: "£", USD: "$" }[listing.currency_code as "GBP" | "USD"] ?? "$";

  // Exit projections — uses 3% annual appreciation baseline
  const exits = [3, 5, 10].map(yrs => {
    const irr = capRate ? calcIRR(capRate, yrs) : null;
    const coc = capRate ? calcCashOnCash(capRate) : null;
    const exitVal = price * Math.pow(1.03, yrs);
    const exitFmt =
      exitVal >= 1_000_000 ? `${sym}${(exitVal / 1_000_000).toFixed(2)}M` :
      `${sym}${(exitVal / 1_000).toFixed(0)}K`;
    return { yrs, irr, coc, exitFmt };
  });

  // Macro signals from muni scores
  const macroSentiment =
    !muni ? "neutral" :
    muni.opportunity_score >= 70 && muni.growth_score >= 65 ? "bullish" :
    muni.risk_score >= 65 ? "bearish" :
    "cautious";

  const macroLabel = { bullish: "BULLISH", bearish: "BEARISH", cautious: "CAUTIOUS", neutral: "NEUTRAL" }[macroSentiment];
  const macroColor = { bullish: "text-pa-green border-pa-green/30 bg-pa-green/5",
                        bearish: "text-red-400 border-red-400/30 bg-red-400/5",
                        cautious: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
                        neutral: "text-muted-foreground border-border bg-secondary/20" }[macroSentiment];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest">
          Investment Thesis
        </h2>
        {muni && (
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${macroColor}`}>
            {macroLabel}
          </span>
        )}
      </div>

      {/* Macro + Micro outlook */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ThesisBlock icon="🌍" title="Macro Outlook">
          {muni ? (
            <>
              <strong className="text-foreground">{muni.name}, {muni.country}</strong> scores{" "}
              <span className={muni.opportunity_score >= 70 ? "text-pa-green font-semibold" : "text-yellow-400 font-semibold"}>
                {muni.opportunity_score}/100
              </span>{" "}
              on Prime Atlas ROI index with a growth score of{" "}
              <span className={muni.growth_score >= 65 ? "text-pa-green font-semibold" : "font-semibold"}>
                {muni.growth_score}
              </span>.{" "}
              {muni.risk_score <= 40
                ? "Risk profile is low — macro tailwinds support long-term capital preservation."
                : muni.risk_score <= 60
                ? "Moderate market risk. Defensible position with selective asset selection."
                : "Elevated macro risk. Stress-test exit assumptions before commitment."}
            </>
          ) : (
            "Macro data not yet indexed for this market. Full conviction scoring available for UK and US markets."
          )}
        </ThesisBlock>

        <ThesisBlock icon="🏘️" title="Micro Outlook">
          {listing.listing_type === "residential" || !listing.listing_type ? (
            <>
              Residential asset{capRate ? ` yielding ${capRate}% gross` : ""}. Rental demand fundamentals
              and local supply constraints drive micro-level conviction.{" "}
              {capRate && capRate >= 6
                ? "Yield above 6% indicates strong cashflow from day one."
                : capRate && capRate >= 4
                ? "Mid-tier yield — value-add or rent growth required for IRR targets."
                : "Below-average yield. Thesis depends primarily on capital appreciation."}
            </>
          ) : listing.listing_type === "commercial" ? (
            <>
              Commercial asset with institutional-grade income potential.{" "}
              {capRate ? `Cap rate of ${capRate}% ` : ""}
              Vacancy risk and lease length are the primary micro variables.
              Stress-test against a 12-month void period before underwriting.
            </>
          ) : listing.listing_type === "development-site" || listing.listing_type === "land" ? (
            <>
              Development play — returns are GDV-driven rather than income-based.
              Key micro variables: planning consent risk, build cost inflation, and absorption rate.
              {listing.listing_type === "land"
                ? " Unconsented land requires a planning buffer of 18–36 months in underwriting."
                : " Site with planning exposure — model three planning scenarios before committing."}
            </>
          ) : (
            <>
              {listing.listing_type.replace(/-/g, " ")} asset class.{" "}
              {capRate ? `Current gross yield: ${capRate}%.` : ""}
              Micro performance driven by location quality, covenant strength, and lease terms.
            </>
          )}
        </ThesisBlock>
      </div>

      {/* Predictive Exit Architecture */}
      <div className="border border-border/60 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-secondary/30 border-b border-border/60 flex items-center justify-between">
          <span className="text-[9px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest">
            Predictive Exit Architecture
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/40">
            70% LTV · 5% IR · 3% p.a. appreciation
          </span>
        </div>

        {capRate ? (
          <div className="grid grid-cols-3 divide-x divide-border/40">
            {exits.map(({ yrs, irr, coc, exitFmt }) => (
              <div key={yrs} className="px-3 py-4 text-center">
                <p className="text-[9px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">
                  {yrs}-YEAR EXIT
                </p>
                <div className="space-y-3">
                  <div>
                    <p className={`text-base font-bold font-mono leading-none ${irr && irr >= 12 ? "text-pa-green" : irr && irr >= 8 ? "text-yellow-400" : "text-red-400"}`}>
                      {irr ? `+${irr}%` : "—"}
                    </p>
                    <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider mt-0.5">
                      IRR (EST.)
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm font-bold font-mono leading-none ${coc && coc >= 8 ? "text-pa-green" : coc && coc >= 4 ? "text-yellow-400" : "text-red-400"}`}>
                      {coc != null ? `${coc > 0 ? "+" : ""}${coc}%` : "—"}
                    </p>
                    <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider mt-0.5">
                      CASH-ON-CASH
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold font-mono text-foreground/70 leading-none">
                      {exitFmt}
                    </p>
                    <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider mt-0.5">
                      EXIT VALUE
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-[11px] font-mono text-muted-foreground/50">
              YIELD DATA UNAVAILABLE — EXIT PROJECTIONS REQUIRE CAP RATE INPUT
            </p>
            <p className="text-[10px] text-muted-foreground/30 mt-1">
              Contact agent for rental income details to unlock projections
            </p>
          </div>
        )}

        <div className="px-4 py-2 bg-secondary/10 border-t border-border/40">
          <p className="text-[8px] font-mono text-muted-foreground/30">
            DISCLAIMER: Projections are illustrative estimates only. Not financial advice.
            Actual returns depend on market conditions, financing terms, and exit timing.
          </p>
        </div>
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
    .from("listings")
    .select("title, description, asking_price, currency_code")
    .eq("id", id)
    .single();

  if (!data) return { title: "Listing Not Found | prime-atlas" };

  return {
    title: `${data.title} | prime-atlas`,
    description:
      data.description?.slice(0, 160) ??
      `${formatPrice(data.asking_price, data.currency_code)} — curated listing on Prime Atlas with full market conviction scores.`,
  };
}

/* ─── page ─────────────────────────────────────────────────────── */

export default async function ListingDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch listing and subscription tier in parallel
  const [{ data: listing }, { data: profile }] = await Promise.all([
    supabase
      .from("listings")
      .select(`
        *,
        municipalities(
          name, slug, country,
          opportunity_score, growth_score, risk_score,
          population
        )
      `)
      .eq("id", id)
      .in("status", ["active", "under_offer"])
      .single(),
    user
      ? supabase.from("profiles").select("subscription_tier").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!listing) notFound();

  // Member = any paid subscription tier
  const subscriptionTier = (profile as { subscription_tier?: string } | null)?.subscription_tier ?? "free";
  const isMember = ["explorer", "professional", "institutional"].includes(subscriptionTier);

  type ComparableItem = {
    address: string; price: number; date: string; type?: string;
    sqm?: number; source: string; source_label?: string; distance_m?: number; currency?: string;
  };

  const muni       = listing.municipalities as {
    name: string; slug: string; country: string;
    opportunity_score: number; growth_score: number; risk_score: number;
    population?: number;
  } | null;
  const planCfg    = listing.planning_status
    ? PLANNING_STATUS_CONFIG[listing.planning_status] ?? { label: listing.planning_status, classes: "text-muted-foreground border-border" }
    : null;
  const images      = (listing.images as string[] | null) ?? [];
  const features    = (listing.features as string[] | null) ?? [];
  const highlights  = (listing.highlights as string[] | null) ?? [];
  const seededComps = (listing.comparables as ComparableItem[] | null) ?? [];

  return (
    <>
      <Navbar user={user} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <Link href="/listings" className="hover:text-foreground transition-colors">Live Listings</Link>
          {muni && (
            <>
              <span>/</span>
              <Link href={`/opportunities/${muni.slug}`} className="hover:text-foreground transition-colors">
                {muni.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground line-clamp-1">{listing.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left / Main column (2/3) ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Image gallery */}
            <ImageGallery images={images} title={listing.title} />

            {/* Title + badge row */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground border border-border rounded px-2 py-0.5">
                  {LISTING_TYPE_LABEL[listing.listing_type] ?? listing.listing_type}
                </span>
                {planCfg && (
                  <span className={`text-[10px] font-semibold rounded px-2 py-0.5 border ${planCfg.classes}`}>
                    {planCfg.label}
                  </span>
                )}
                {listing.featured && (
                  <span className="text-[10px] font-bold text-pa-green">★ Featured</span>
                )}
                {listing.status === "under_offer" && (
                  <span className="text-[10px] font-bold text-pa-amber border border-pa-amber/30 rounded px-2 py-0.5 bg-pa-amber/5">
                    Under Offer
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">
                {listing.title}
              </h1>
              {isMember ? (
                <p className="text-sm text-muted-foreground flex items-start gap-1">
                  <span className="mt-0.5 flex-shrink-0">📍</span>
                  {listing.address}
                  {muni && <span className="ml-1">· {COUNTRY_FLAG[muni.country] ?? ""} {muni.country}</span>}
                </p>
              ) : (
                <div className="flex items-start gap-1">
                  <span className="mt-0.5 flex-shrink-0 text-sm">📍</span>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {getLocationSummary(listing.address, muni?.country)}
                      {muni && <span className="ml-1">· {COUNTRY_FLAG[muni.country] ?? ""} {muni.country}</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Full address available to members · <a href="/pricing" className="underline hover:text-foreground">Upgrade</a>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Specs bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-border rounded-xl p-3 bg-card text-center">
                <p className="text-xl font-bold font-mono text-pa-green leading-none">
                  {formatPrice(listing.asking_price, listing.currency_code)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">asking price</p>
              </div>

              {listing.size_sqm && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-xl font-bold font-mono leading-none">
                    {Number(listing.size_sqm).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">sqm</p>
                </div>
              )}

              {listing.bedrooms && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-xl font-bold font-mono leading-none">{listing.bedrooms}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">bedrooms</p>
                </div>
              )}

              {listing.bathrooms && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-xl font-bold font-mono leading-none">{listing.bathrooms}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">bathrooms</p>
                </div>
              )}

              {listing.date_listed && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-sm font-semibold leading-none">
                    {new Date(listing.date_listed).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">listed</p>
                </div>
              )}

              {listing.tenure && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-sm font-semibold leading-none capitalize">{listing.tenure}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">tenure</p>
                </div>
              )}
            </div>

            {/* Full description — truncated for non-members */}
            {listing.description && (
              <div>
                <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-widest text-[10px]">
                  About this listing
                </h2>
                {isMember ? (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {listing.description}
                  </p>
                ) : (
                  <div className="relative">
                    <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                      {listing.description}
                    </p>
                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
                  </div>
                )}
              </div>
            )}

            {/* Key features — first 3 for free, all for members */}
            {features.length > 0 && (
              <div>
                <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Key features
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(isMember ? features : features.slice(0, 3)).map((feat, i) => (
                    <span
                      key={i}
                      className="text-xs border border-border rounded-full px-3 py-1.5 bg-secondary/30 text-foreground"
                    >
                      {feat}
                    </span>
                  ))}
                  {!isMember && features.length > 3 && (
                    <span className="text-xs border border-dashed border-border rounded-full px-3 py-1.5 text-muted-foreground">
                      +{features.length - 3} more · <a href="/pricing" className="text-pa-green font-semibold hover:underline">members</a>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Highlights + Investment Thesis + Comparables — members only */}
            {isMember ? (
              <>
                {highlights.length > 0 && (
                  <div className="border border-pa-green/20 rounded-xl p-5 bg-pa-green/[0.03]">
                    <h2 className="text-[10px] font-bold text-pa-green uppercase tracking-widest mb-4">
                      Investment highlights
                    </h2>
                    <ul className="space-y-2.5">
                      {highlights.map((hl, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="text-pa-green flex-shrink-0 mt-0.5">✓</span>
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <InvestmentThesis listing={listing} muni={muni} />
                <ComparablesPanel
                  postcode={listing.postcode ?? null}
                  seeded={seededComps}
                  askingPrice={listing.asking_price}
                  currency={listing.currency_code}
                />
              </>
            ) : (
              /* ── Upgrade CTA: intelligence locked ── */
              <div className="relative border border-border rounded-2xl overflow-hidden">
                {/* Blurred teaser content */}
                <div className="blur-sm select-none pointer-events-none p-6 space-y-4">
                  <div className="border border-pa-green/20 rounded-xl p-5 bg-pa-green/[0.03]">
                    <p className="text-[10px] font-bold text-pa-green uppercase tracking-widest mb-3">Investment highlights</p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex gap-2"><span className="text-pa-green">✓</span>Planning permission granted for 68 units</li>
                      <li className="flex gap-2"><span className="text-pa-green">✓</span>Gross yield estimated at 7.4% · BTL fundamentals</li>
                      <li className="flex gap-2"><span className="text-pa-green">✓</span>3× comparable transactions above asking price</li>
                    </ul>
                  </div>
                  <div className="border border-border rounded-xl p-5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Investment thesis</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">Strong demand fundamentals with constrained supply pipeline. Cap rate spread of 220bps above Treasury provides defensive income floor. Exit via institutional block sale or fractionalised residential disposal...</p>
                  </div>
                  <div className="border border-border rounded-xl p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Comparable Evidence</p>
                    <div className="space-y-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="flex justify-between text-xs py-2 border-b border-border">
                          <span>Comparable property {i}</span>
                          <span className="font-bold">£{(320 + i * 45).toLocaleString()}K</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Gradient unlock overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/70 to-background flex flex-col items-center justify-end pb-10 px-6">
                  <div className="bg-card border border-border rounded-2xl shadow-xl px-8 py-7 text-center max-w-sm w-full">
                    <div className="w-12 h-12 bg-pa-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-pa-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-base font-bold mb-1">Prime Atlas Intelligence</p>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                      This listing has been fully underwritten. Members unlock:
                    </p>
                    <ul className="text-xs text-left space-y-1.5 mb-5 text-muted-foreground">
                      {[
                        "Investment highlights & conviction thesis",
                        "Gross/net yield & IRR projections",
                        "Comparable transaction evidence",
                        "Full market conviction scores",
                        "Agent contact details",
                        "Full property address",
                      ].map(item => (
                        <li key={item} className="flex items-center gap-2">
                          <span className="text-pa-green font-bold flex-shrink-0">→</span>{item}
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
                      className="mt-2.5 block text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Create free account →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right / Sidebar (1/3) ── */}
          <div className="space-y-6">

            {/* Market conviction panel */}
            {muni && (
              <div className="border border-pa-green/20 rounded-xl p-5 bg-card sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-pa-green uppercase tracking-widest">
                      Prime Atlas Market Conviction
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {COUNTRY_FLAG[muni.country] ?? ""} {muni.name}
                    </p>
                  </div>
                </div>

                {isMember ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center">
                        <p className={`text-2xl font-bold font-mono ${scoreColor(muni.opportunity_score)}`}>
                          {muni.opportunity_score}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">ROI index</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-2xl font-bold font-mono ${scoreColor(muni.growth_score)}`}>
                          {muni.growth_score}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">growth</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-2xl font-bold font-mono ${
                          muni.risk_score <= 40 ? "text-pa-green" :
                          muni.risk_score <= 55 ? "text-pa-amber" : "text-red-400"
                        }`}>
                          {muni.risk_score}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">risk</p>
                      </div>
                    </div>
                    <Link
                      href={`/opportunities/${muni.slug}`}
                      className="block text-center text-xs text-pa-green hover:underline mt-1"
                    >
                      Full market analysis →
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="grid grid-cols-3 gap-3 mb-4 blur-sm select-none">
                      {["ROI", "Growth", "Risk"].map(l => (
                        <div key={l} className="text-center">
                          <p className="text-2xl font-bold font-mono text-pa-green">—</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{l}</p>
                        </div>
                      ))}
                    </div>
                    <Link href="/pricing" className="text-xs font-bold text-pa-green hover:underline">
                      Unlock market scores →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Contact — gated behind membership */}
            <InquireForm
              listingTitle={listing.title}
              listingId={listing.id}
              contactEmail={listing.contact_email}
              isMember={isMember}
              isLoggedIn={!!user}
            />

            {/* Back to listings */}
            <Link
              href="/listings"
              className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              ← Back to all listings
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
