"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { scoreColor } from "@/lib/utils";

/* ─── types ──────────────────────────────────────────────────────── */

export interface FullListing {
  id: string;
  title: string;
  address: string;
  listing_type: string;
  deal_type: string | null;
  investor_profile: string[] | null;
  asking_price: number;
  currency_code: string;
  size_sqm: number | null;
  planning_status: string | null;
  gross_yield_pct: number | null;
  gdv_margin_pct: number | null;
  annual_income: number | null;
  description: string | null;
  date_listed: string | null;
  status: string;
  featured: boolean;
  postcode: string | null;
  municipalities?: {
    name: string; slug: string; country: string;
    opportunity_score: number; growth_score: number; risk_score: number;
  } | null;
}

/* ─── config ─────────────────────────────────────────────────────── */

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", AUD: "A$", CAD: "C$",
};

const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧", "United States": "🇺🇸",
  "Australia": "🇦🇺", "Canada": "🇨🇦", "Spain": "🇪🇸",
};

function formatPrice(pence: number, currency: string) {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const n = pence / 100;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${sym}${(n / 1_000).toFixed(0)}K`;
  return `${sym}${n.toLocaleString()}`;
}

const INVESTOR_PROFILES = [
  {
    id: "retail",
    label: "Retail Investor",
    icon: "👤",
    tagline: "Accessible entry points · Residential · Buy-to-rent",
    description: "Residential, BTR and buy-to-sell opportunities suited to individual investors seeking yield or capital growth.",
    strategies: ["all", "buy-to-sell", "buy-to-rent"],
    strategyLabels: { all: "All", "buy-to-sell": "Buy to Sell", "buy-to-rent": "Buy to Rent" },
    color: "blue",
  },
  {
    id: "developer",
    label: "Developer",
    icon: "🏗️",
    tagline: "Land · Development sites · Value-add · Planning plays",
    description: "Development sites, land assemblies and value-add assets where margin is generated through planning, construction or conversion.",
    strategies: ["all", "development", "buy-to-rent", "industrial"],
    strategyLabels: { all: "All", "development": "Development Sites", "buy-to-rent": "BTR Forward Fund", "industrial": "Industrial / Logistics" },
    color: "amber",
  },
  {
    id: "institutional",
    label: "Institutional",
    icon: "🏛️",
    tagline: "Income · PBSA · Commercial · BTR at scale",
    description: "Institutional-grade income assets: standing commercial, PBSA, large BTR portfolios and industrial portfolios with proven income.",
    strategies: ["all", "buy-to-rent", "commercial-income", "pbsa", "industrial"],
    strategyLabels: { all: "All", "buy-to-rent": "BTR / PRS", "commercial-income": "Commercial Income", "pbsa": "PBSA", "industrial": "Industrial" },
    color: "green",
  },
] as const;

type ProfileId = "retail" | "developer" | "institutional";

const PLANNING_CONFIG: Record<string, { label: string; cls: string }> = {
  "with-permission":       { label: "Planning Granted",  cls: "text-pa-green bg-pa-green/10 border-pa-green/30" },
  "outline":               { label: "Outline Consent",   cls: "text-pa-amber bg-pa-amber/10 border-pa-amber/30" },
  "unconsented":           { label: "No Consent",        cls: "text-muted-foreground bg-secondary/30 border-border" },
  "freehold":              { label: "Freehold",          cls: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  "permitted-development": { label: "PD Rights",         cls: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
};

/* ─── KPI helpers ────────────────────────────────────────────────── */

function KpiPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 border text-center min-w-[72px] ${
      highlight ? "border-pa-green/30 bg-pa-green/5" : "border-border bg-secondary/20"
    }`}>
      <span className={`text-sm font-bold font-mono leading-none ${highlight ? "text-pa-green" : ""}`}>{value}</span>
      <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{label}</span>
    </div>
  );
}

function ListingCard({ listing, strategy }: { listing: FullListing; strategy: string }) {
  const muni = listing.municipalities;
  const planCfg = listing.planning_status ? PLANNING_CONFIG[listing.planning_status] : null;

  const kpis = useMemo(() => {
    const out: { label: string; value: string; highlight?: boolean }[] = [];
    out.push({ label: "asking", value: formatPrice(listing.asking_price, listing.currency_code), highlight: true });

    if (listing.gross_yield_pct) {
      out.push({ label: "gross yield", value: `${listing.gross_yield_pct}%`, highlight: true });
    }
    if (listing.gdv_margin_pct) {
      out.push({ label: "dev margin", value: `${listing.gdv_margin_pct}%`, highlight: true });
    }
    if (listing.size_sqm) {
      out.push({ label: "sqm", value: listing.size_sqm.toLocaleString() });
    }
    if (muni) {
      out.push({ label: "ROI index", value: String(muni.opportunity_score) });
    }
    return out.slice(0, 4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing, strategy]);

  return (
    <div className={`group border rounded-xl bg-card flex flex-col overflow-hidden transition-all hover:border-pa-green/40 hover:shadow-lg hover:shadow-pa-green/5 ${
      listing.featured ? "border-pa-green/30" : "border-border"
    }`}>
      {/* Header strip */}
      <div className="px-4 pt-3.5 pb-0 flex items-center gap-2 flex-wrap">
        {planCfg && (
          <span className={`text-[10px] font-semibold border rounded px-2 py-0.5 ${planCfg.cls}`}>
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
        {muni && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {COUNTRY_FLAG[muni.country] ?? ""} {muni.name}
          </span>
        )}
      </div>

      <div className="px-4 py-3 flex-1 flex flex-col gap-3">
        {/* Title */}
        <div>
          <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-1">{listing.title}</h3>
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <span className="flex-shrink-0 mt-0.5">📍</span>
            <span className="line-clamp-1">{listing.address}</span>
          </p>
        </div>

        {/* KPI row */}
        <div className="flex gap-2 flex-wrap">
          {kpis.map((k, i) => (
            <KpiPill key={i} label={k.label} value={k.value} highlight={k.highlight} />
          ))}
        </div>

        {/* Description */}
        {listing.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {listing.description}
          </p>
        )}

        {/* Market conviction mini-bar */}
        {muni && (
          <div className="border border-pa-green/15 rounded-lg bg-pa-green/[0.02] px-3 py-2">
            <p className="text-[9px] text-pa-green font-bold uppercase tracking-widest mb-1.5">
              Prime Atlas Market Score
            </p>
            <div className="flex gap-4">
              <div className="text-center">
                <p className={`text-base font-bold font-mono ${scoreColor(muni.opportunity_score)}`}>
                  {muni.opportunity_score}
                </p>
                <p className="text-[8px] text-muted-foreground">ROI</p>
              </div>
              <div className="text-center">
                <p className={`text-base font-bold font-mono ${scoreColor(muni.growth_score)}`}>
                  {muni.growth_score}
                </p>
                <p className="text-[8px] text-muted-foreground">Growth</p>
              </div>
              <div className="text-center">
                <p className={`text-base font-bold font-mono ${
                  muni.risk_score <= 40 ? "text-pa-green" : muni.risk_score <= 55 ? "text-pa-amber" : "text-red-400"
                }`}>
                  {muni.risk_score}
                </p>
                <p className="text-[8px] text-muted-foreground">Risk</p>
              </div>
              <div className="ml-auto self-center">
                <Link
                  href={`/opportunities/${muni.slug}`}
                  className="text-[9px] text-pa-green hover:underline"
                >
                  Full analysis →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/listings/${listing.id}`}
          className="w-full text-center text-xs font-semibold bg-pa-green text-pa-navy py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors mt-auto"
        >
          View deal details →
        </Link>
      </div>
    </div>
  );
}

/* ─── stats bar ─────────────────────────────────────────────────── */

function StatsBar({ listings }: { listings: FullListing[] }) {
  const featured = listings.filter(l => l.featured).length;
  const avgYield = listings.filter(l => l.gross_yield_pct).length
    ? (listings.filter(l => l.gross_yield_pct).reduce((s, l) => s + Number(l.gross_yield_pct), 0) /
       listings.filter(l => l.gross_yield_pct).length).toFixed(1)
    : null;
  const avgMargin = listings.filter(l => l.gdv_margin_pct).length
    ? (listings.filter(l => l.gdv_margin_pct).reduce((s, l) => s + Number(l.gdv_margin_pct), 0) /
       listings.filter(l => l.gdv_margin_pct).length).toFixed(1)
    : null;

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2">
      <div>
        <p className="text-lg font-bold font-mono text-pa-green">{listings.length}</p>
        <p className="text-[10px] text-muted-foreground">Matching deals</p>
      </div>
      {featured > 0 && (
        <div>
          <p className="text-lg font-bold font-mono text-pa-green">{featured}</p>
          <p className="text-[10px] text-muted-foreground">Featured</p>
        </div>
      )}
      {avgYield && (
        <div>
          <p className="text-lg font-bold font-mono text-pa-green">{avgYield}%</p>
          <p className="text-[10px] text-muted-foreground">Avg gross yield</p>
        </div>
      )}
      {avgMargin && (
        <div>
          <p className="text-lg font-bold font-mono text-pa-green">{avgMargin}%</p>
          <p className="text-[10px] text-muted-foreground">Avg dev margin</p>
        </div>
      )}
    </div>
  );
}

/* ─── main explorer ──────────────────────────────────────────────── */

export function ListingsExplorer({ listings }: { listings: FullListing[] }) {
  const [activeProfile, setActiveProfile] = useState<ProfileId>("institutional");
  const [activeStrategy, setActiveStrategy] = useState<string>("all");

  const profile = INVESTOR_PROFILES.find(p => p.id === activeProfile)!;

  const filtered = useMemo(() => {
    return listings.filter(l => {
      const profileMatch = l.investor_profile?.includes(activeProfile);
      const strategyMatch = activeStrategy === "all" || l.deal_type === activeStrategy;
      return profileMatch && strategyMatch;
    });
  }, [listings, activeProfile, activeStrategy]);

  const profileColor = {
    retail: "border-blue-400/40 bg-blue-400/5 text-blue-400",
    developer: "border-pa-amber/40 bg-pa-amber/5 text-pa-amber",
    institutional: "border-pa-green/40 bg-pa-green/5 text-pa-green",
  };

  return (
    <div>
      {/* ── Investor Profile Selector ── */}
      <div className="mb-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Select your investor profile
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {INVESTOR_PROFILES.map(p => (
            <button
              key={p.id}
              onClick={() => { setActiveProfile(p.id); setActiveStrategy("all"); }}
              className={`text-left p-4 rounded-xl border transition-all ${
                activeProfile === p.id
                  ? profileColor[p.id]
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{p.icon}</span>
                <span className="font-bold text-sm">{p.label}</span>
                {activeProfile === p.id && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">Active</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{p.tagline}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile description + strategy tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-sm text-muted-foreground max-w-xl">{profile.description}</p>

        <div className="flex gap-1.5 flex-wrap shrink-0">
          {profile.strategies.map(s => (
            <button
              key={s}
              onClick={() => setActiveStrategy(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                activeStrategy === s
                  ? "bg-pa-green text-pa-navy border-pa-green"
                  : "border-border text-muted-foreground hover:border-pa-green/40 hover:text-foreground"
              }`}
            >
              {(profile.strategyLabels as Record<string, string>)[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="mb-6 p-4 border border-border rounded-xl bg-card">
        <StatsBar listings={filtered} />
      </div>

      {/* ── Listings grid ── */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-sm mb-2">
            No {activeStrategy === "all" ? "" : (profile.strategyLabels as Record<string, string>)[activeStrategy] + " "} deals
            for {profile.label}s right now.
          </p>
          <a
            href="mailto:deals@prime-atlas.com?subject=Submit a listing"
            className="text-xs text-pa-green hover:underline"
          >
            Submit a listing →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(l => (
            <ListingCard key={l.id} listing={l} strategy={activeStrategy} />
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-8 border border-dashed border-border rounded-xl p-5 text-center">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Agent or developer?</strong>{" "}
          List your deal here and reach{" "}
          {activeProfile === "retail" ? "retail investors" : activeProfile === "developer" ? "developers" : "institutional capital"}{" "}
          who already have market conviction.{" "}
          <a href="mailto:deals@prime-atlas.com?subject=List my deal on Prime Atlas" className="text-pa-green hover:underline">
            Get in touch →
          </a>
        </p>
      </div>
    </div>
  );
}
