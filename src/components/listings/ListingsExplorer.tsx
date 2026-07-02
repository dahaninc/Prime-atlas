"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

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
  bedrooms?: number | null;
  images?: string[] | null;
  highlights?: string[] | null;
  municipalities?: {
    name: string; slug: string; country: string;
    opportunity_score: number; growth_score: number; risk_score: number;
  } | null;
}

/* ─── helpers ────────────────────────────────────────────────────── */

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$" };
const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States":  "🇺🇸",
};

const DEAL_LABEL: Record<string, string> = {
  "buy-to-rent":      "BTR",
  "development":      "Development",
  "commercial-income":"Commercial",
  "buy-to-sell":      "Flip",
  "pbsa":             "PBSA",
  "industrial":       "Industrial",
  "land-banking":     "Land",
};

const DEAL_COLOR: Record<string, string> = {
  "buy-to-rent":       "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "development":       "bg-[#00C805]/10 text-[#00C805] border-[#00C805]/25",
  "commercial-income": "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "pbsa":              "bg-orange-500/15 text-orange-400 border-orange-500/25",
  "industrial":        "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "buy-to-sell":       "bg-pink-500/15 text-pink-400 border-pink-500/25",
  "land-banking":      "bg-teal-500/15 text-teal-400 border-teal-500/25",
};

const PLANNING_LABEL: Record<string, string> = {
  "with-permission":     "Full Consent",
  "outline":             "Outline",
  "unconsented":         "Pre-App",
  "freehold":            "Freehold",
  "permitted-development":"PD Rights",
};

const PLANNING_COLOR: Record<string, string> = {
  "with-permission":     "text-[#00C805]",
  "outline":             "text-yellow-400",
  "unconsented":         "text-[#A1A1AA]",
  "freehold":            "text-blue-400",
  "permitted-development":"text-[#00C805]",
};

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80",
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?w=600&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
];

function fmtPrice(pence: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const n = pence / 100;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${sym}${(n / 1_000).toFixed(0)}K`;
  return `${sym}${n.toLocaleString()}`;
}

function capRate(l: FullListing): number | null {
  if (l.gross_yield_pct) return Number(l.gross_yield_pct);
  if (l.annual_income && l.asking_price)
    return Math.round(((l.annual_income / (l.asking_price / 100)) * 100) * 10) / 10;
  return null;
}

function roiColor(score: number): string {
  if (score >= 70) return "text-[#00C805]";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

/* ─── filter pill ────────────────────────────────────────────────── */

function Pill({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border whitespace-nowrap ${
        active
          ? "bg-[#00C805] text-[#0A0B10] border-[#00C805]"
          : "bg-transparent border-[#27272A] text-[#A1A1AA] hover:border-[#00C805]/50 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── listing card ───────────────────────────────────────────────── */

function ListingCard({ listing, index }: { listing: FullListing; index: number }) {
  const muni = listing.municipalities;
  const cap  = capRate(listing);
  const returnFigure = cap
    ? { label: "Gross Yield", value: `${cap.toFixed(1)}%`, green: cap >= 5 }
    : listing.gdv_margin_pct
    ? { label: "GDV Margin", value: `${listing.gdv_margin_pct}%`, green: listing.gdv_margin_pct >= 20 }
    : null;

  const img = listing.images?.[0] ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
  const dealColor = DEAL_COLOR[listing.deal_type ?? ""] ?? "bg-[#27272A] text-[#A1A1AA] border-[#27272A]";
  const dealLabel = DEAL_LABEL[listing.deal_type ?? ""] ?? listing.deal_type ?? "Other";
  const planLabel = PLANNING_LABEL[listing.planning_status ?? ""] ?? listing.planning_status ?? "";
  const planColor = PLANNING_COLOR[listing.planning_status ?? ""] ?? "text-[#A1A1AA]";
  const flag = COUNTRY_FLAG[muni?.country ?? ""] ?? "🌍";

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col bg-[#0C0D14] border border-[#1E1E2E] hover:border-[#00C805]/40 rounded-2xl overflow-hidden transition-all hover:shadow-[0_0_24px_rgba(0,200,5,0.08)]"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-[#0C0D14]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={listing.title}
          className="w-full h-full object-cover opacity-70 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D14] via-transparent to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="text-xs font-semibold">
            {flag} {muni?.name ?? "Unknown"}
          </span>
          {listing.featured && (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-[#00C805] text-[#0A0B10] px-2 py-0.5 rounded-full">
              Featured
            </span>
          )}
        </div>

        {/* Bottom: deal type + status */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dealColor}`}>
            {dealLabel}
          </span>
          {listing.status === "under_offer" ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400">
              Under Offer
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#00C805]/70">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C805] animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title */}
        <div>
          <p className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-[#00C805] transition-colors">
            {listing.title}
          </p>
          <p className="text-[11px] text-[#A1A1AA] mt-1 line-clamp-1">{listing.address}</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#13141F] rounded-lg p-2 text-center">
            <p className="text-xs font-bold font-mono text-white">{fmtPrice(listing.asking_price, listing.currency_code)}</p>
            <p className="text-[9px] text-[#A1A1AA] mt-0.5 uppercase tracking-wide">Price</p>
          </div>
          <div className="bg-[#13141F] rounded-lg p-2 text-center">
            <p className={`text-xs font-bold font-mono ${returnFigure ? (returnFigure.green ? "text-[#00C805]" : "text-yellow-400") : "text-[#A1A1AA]"}`}>
              {returnFigure ? returnFigure.value : "—"}
            </p>
            <p className="text-[9px] text-[#A1A1AA] mt-0.5 uppercase tracking-wide">
              {returnFigure ? returnFigure.label : "Return"}
            </p>
          </div>
          <div className="bg-[#13141F] rounded-lg p-2 text-center">
            <p className="text-xs font-bold font-mono text-white">
              {listing.size_sqm ? `${Number(listing.size_sqm).toLocaleString()}` : "—"}
            </p>
            <p className="text-[9px] text-[#A1A1AA] mt-0.5 uppercase tracking-wide">sqm</p>
          </div>
        </div>

        {/* Planning + ROI footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1E1E2E] mt-auto">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-semibold ${planColor}`}>
              {planLabel || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {muni && (
              <div className="text-right">
                <span className={`text-xs font-bold tabular-nums ${roiColor(muni.opportunity_score)}`}>
                  {muni.opportunity_score}
                </span>
                <span className="text-[9px] text-[#A1A1AA] ml-1">ROI</span>
              </div>
            )}
            <span className="text-[11px] text-[#00C805] font-semibold group-hover:underline">
              Analyse →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── main explorer ──────────────────────────────────────────────── */

type Market   = "all" | "US" | "UK";
type DealType = "all" | "buy-to-rent" | "development" | "commercial-income" | "pbsa" | "industrial";
type SortKey  = "date_desc" | "price_asc" | "price_desc" | "yield_desc" | "roi_desc";

export function ListingsExplorer({ listings }: { listings: FullListing[] }) {
  const [market,   setMarket]   = useState<Market>("all");
  const [dealType, setDealType] = useState<DealType>("all");
  const [sortKey,  setSortKey]  = useState<SortKey>("date_desc");
  const [search,   setSearch]   = useState("");

  const filtered = useMemo(() => {
    let out = [...listings];

    if (market === "US") out = out.filter(l => l.municipalities?.country === "United States");
    if (market === "UK") out = out.filter(l => l.municipalities?.country === "United Kingdom");
    if (dealType !== "all") out = out.filter(l => l.deal_type === dealType);

    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) ||
        (l.municipalities?.name ?? "").toLowerCase().includes(q) ||
        (l.postcode ?? "").toLowerCase().includes(q)
      );
    }

    out.sort((a, b) => {
      switch (sortKey) {
        case "price_asc":  return a.asking_price - b.asking_price;
        case "price_desc": return b.asking_price - a.asking_price;
        case "yield_desc": return (capRate(b) ?? -1) - (capRate(a) ?? -1);
        case "roi_desc":   return (b.municipalities?.opportunity_score ?? -1) - (a.municipalities?.opportunity_score ?? -1);
        default: {
          const da = a.date_listed ? new Date(a.date_listed).getTime() : 0;
          const db = b.date_listed ? new Date(b.date_listed).getTime() : 0;
          return db - da;
        }
      }
    });

    // Featured float
    out.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return out;
  }, [listings, market, dealType, sortKey, search]);

  const withYield = filtered.filter(l => l.gross_yield_pct);
  const avgYield  = withYield.length
    ? (withYield.reduce((s, l) => s + Number(l.gross_yield_pct), 0) / withYield.length).toFixed(1)
    : null;

  return (
    <div>
      {/* ── Search bar hero ── */}
      <div className="relative mb-8 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0C0D14] via-[#0F1020] to-[#0A0B10] border border-[#1E1E2E] p-8">
        <div className="max-w-3xl mx-auto text-center mb-6">
          <p className="text-[10px] font-mono font-bold text-[#00C805] uppercase tracking-widest mb-2">
            🇺🇸 USA · 🇬🇧 UK · Live Deal Flow
          </p>
          <h2 className="text-2xl font-black tracking-tight mb-1">Find Your Next Investment</h2>
          <p className="text-sm text-[#A1A1AA]">
            Search and analyse off-market opportunities — each scored against the Prime Atlas conviction framework
          </p>
        </div>

        {/* Search input */}
        <div className="max-w-2xl mx-auto flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by city, postcode, or deal type..."
              className="w-full pl-11 pr-4 py-3.5 bg-[#13141F] border border-[#27272A] focus:border-[#00C805]/60 rounded-xl text-sm text-white placeholder:text-[#A1A1AA]/60 outline-none transition-colors"
            />
          </div>
          <button className="px-6 py-3.5 bg-[#00C805] hover:bg-[#00C805]/90 text-[#0A0B10] font-bold rounded-xl transition-colors whitespace-nowrap text-sm">
            Analyse
          </button>
        </div>

        {/* Stats inline */}
        <div className="max-w-2xl mx-auto mt-4 flex items-center justify-center gap-6 text-[11px] font-mono text-[#A1A1AA]">
          <span>
            <span className="text-white font-bold">{filtered.length}</span> deals found
          </span>
          <span>🇺🇸 <span className="text-white font-bold">{listings.filter(l => l.municipalities?.country === "United States").length}</span> USA</span>
          <span>🇬🇧 <span className="text-white font-bold">{listings.filter(l => l.municipalities?.country === "United Kingdom").length}</span> UK</span>
          {avgYield && (
            <span>avg yield <span className="text-[#00C805] font-bold">{avgYield}%</span></span>
          )}
        </div>
      </div>

      {/* ── Filter + sort bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Market */}
        <div className="flex gap-2">
          {(["all", "US", "UK"] as Market[]).map(m => (
            <Pill
              key={m}
              active={market === m}
              label={m === "all" ? "All Markets" : m === "US" ? "🇺🇸 USA" : "🇬🇧 UK"}
              onClick={() => setMarket(m)}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-[#27272A] hidden sm:block" />

        {/* Deal type */}
        <div className="flex gap-2 flex-wrap">
          {([
            ["all", "All Types"],
            ["buy-to-rent", "BTR"],
            ["development", "Development"],
            ["commercial-income", "Commercial"],
            ["pbsa", "PBSA"],
            ["industrial", "Industrial"],
          ] as [DealType, string][]).map(([key, label]) => (
            <Pill key={key} active={dealType === key} label={label} onClick={() => setDealType(key)} />
          ))}
        </div>

        {/* Sort — pushed right */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-[#A1A1AA] hidden sm:block">Sort:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs bg-[#0C0D14] border border-[#27272A] rounded-lg px-3 py-2 text-white outline-none focus:border-[#00C805]/50 cursor-pointer"
          >
            <option value="date_desc">Newest first</option>
            <option value="roi_desc">Highest ROI</option>
            <option value="yield_desc">Highest yield</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
          </select>
        </div>
      </div>

      {/* ── Results count ── */}
      <p className="text-[11px] text-[#A1A1AA] mb-4 font-mono">
        Showing <span className="text-white font-bold">{filtered.length}</span> of {listings.length} opportunities
      </p>

      {/* ── Card grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 border border-[#1E1E2E] rounded-2xl bg-[#0C0D14]">
          <p className="text-4xl">🔍</p>
          <p className="font-bold text-lg">No deals match your filters</p>
          <p className="text-sm text-[#A1A1AA]">Try adjusting the market or deal type above</p>
          <button
            onClick={() => { setMarket("all"); setDealType("all"); setSearch(""); }}
            className="mt-2 px-4 py-2 rounded-lg border border-[#00C805]/40 text-[#00C805] text-sm font-semibold hover:bg-[#00C805]/10 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-10 pt-6 border-t border-[#1E1E2E] flex items-center justify-between">
        <p className="text-[10px] font-mono text-[#A1A1AA]/40">
          PRIME ATLAS INTELLIGENCE · USA + UK · REFRESHED DAILY
        </p>
        <a
          href="mailto:deals@prime-atlas.com?subject=Submit a listing"
          className="text-[11px] font-mono text-[#00C805]/60 hover:text-[#00C805] transition-colors"
        >
          + Submit a listing
        </a>
      </div>
    </div>
  );
}
