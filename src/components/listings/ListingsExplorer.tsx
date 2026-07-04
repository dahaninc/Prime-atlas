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
  "buy-to-rent":       "bg-blue-50 text-blue-600 border-blue-200",
  "development":       "bg-[#EEF3FD] text-[#1B4FE4] border-[#1B4FE4]/20",
  "commercial-income": "bg-purple-50 text-purple-600 border-purple-200",
  "pbsa":              "bg-orange-50 text-orange-600 border-orange-200",
  "industrial":        "bg-amber-50 text-amber-700 border-amber-200",
  "buy-to-sell":       "bg-pink-50 text-pink-600 border-pink-200",
  "land-banking":      "bg-teal-50 text-teal-600 border-teal-200",
};

const PLANNING_LABEL: Record<string, string> = {
  "with-permission":     "Full Consent",
  "outline":             "Outline",
  "unconsented":         "Pre-App",
  "freehold":            "Freehold",
  "permitted-development":"PD Rights",
};

const PLANNING_COLOR: Record<string, string> = {
  "with-permission":     "text-green-600",
  "outline":             "text-amber-600",
  "unconsented":         "text-gray-400",
  "freehold":            "text-blue-600",
  "permitted-development":"text-green-600",
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
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
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
          ? "bg-[#1B4FE4] text-white border-[#1B4FE4]"
          : "bg-white border-gray-200 text-gray-600 hover:border-[#1B4FE4]/40 hover:text-[#1B4FE4]"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── listing card ───────────────────────────────────────────────── */

function ListingCard({ listing, index, isMember }: { listing: FullListing; index: number; isMember: boolean }) {
  const muni = listing.municipalities;
  const cap  = capRate(listing);
  const returnFigure = cap
    ? { label: "Gross Yield", value: `${cap.toFixed(1)}%`, green: cap >= 5 }
    : listing.gdv_margin_pct
    ? { label: "GDV Margin", value: `${listing.gdv_margin_pct}%`, green: listing.gdv_margin_pct >= 20 }
    : null;

  const img = listing.images?.[0] ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
  const dealColor = DEAL_COLOR[listing.deal_type ?? ""] ?? "bg-gray-100 text-gray-600 border-gray-200";
  const dealLabel = DEAL_LABEL[listing.deal_type ?? ""] ?? listing.deal_type ?? "Other";
  const planLabel = PLANNING_LABEL[listing.planning_status ?? ""] ?? listing.planning_status ?? "";
  const planColor = PLANNING_COLOR[listing.planning_status ?? ""] ?? "text-gray-400";
  const flag = COUNTRY_FLAG[muni?.country ?? ""] ?? "🌍";

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col bg-white border border-gray-200 hover:border-[#1B4FE4]/40 rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white drop-shadow">
            {flag} {muni?.name ?? "Unknown"}
          </span>
          {listing.featured && (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-[#1B4FE4] text-white px-2 py-0.5 rounded-full">
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700">
              Under Offer
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-white">
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
          <p className="font-bold text-sm leading-snug line-clamp-2 text-gray-900 group-hover:text-[#1B4FE4] transition-colors">
            {listing.title}
          </p>
          {isMember ? (
            <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{listing.address}</p>
          ) : (
            <div>
              <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                {getLocationSummary(listing.address, listing.municipalities?.country)}
              </p>
              <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-1">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Full address · members only
              </p>
            </div>
          )}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <p className="text-xs font-bold font-mono text-gray-900">{fmtPrice(listing.asking_price, listing.currency_code)}</p>
            <p className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wide">Price</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <p className={`text-xs font-bold font-mono ${returnFigure ? (returnFigure.green ? "text-[#00C805]" : "text-amber-600") : "text-gray-400"}`}>
              {returnFigure ? returnFigure.value : "—"}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wide">
              {returnFigure ? returnFigure.label : "Return"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
            <p className="text-xs font-bold font-mono text-gray-900">
              {listing.size_sqm ? `${Number(listing.size_sqm).toLocaleString()}` : "—"}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wide">sqm</p>
          </div>
        </div>

        {/* Planning + ROI footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
          <span className={`text-[10px] font-semibold ${planColor}`}>
            {planLabel || "—"}
          </span>
          <div className="flex items-center gap-2">
            {muni && (
              <div className="text-right">
                <span className={`text-xs font-bold tabular-nums ${roiColor(muni.opportunity_score)}`}>
                  {muni.opportunity_score}
                </span>
                <span className="text-[9px] text-gray-400 ml-1">ROI</span>
              </div>
            )}
            <span className="text-[11px] text-[#1B4FE4] font-semibold group-hover:underline">
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

export function ListingsExplorer({ listings, isMember = false }: { listings: FullListing[]; isMember?: boolean }) {
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
      <div className="relative mb-8 rounded-2xl overflow-hidden bg-[#F8FAFF] border border-gray-200 p-8">
        <div className="max-w-3xl mx-auto text-center mb-6">
          <p className="text-[10px] font-mono font-bold text-[#1B4FE4] uppercase tracking-widest mb-2">
            🇺🇸 USA · 🇬🇧 UK · Live Deal Flow
          </p>
          <h2 className="text-2xl font-black tracking-tight mb-1 text-gray-900">Find Your Next Investment</h2>
          <p className="text-sm text-gray-500">
            Search and analyse off-market opportunities — each scored against the Prime Atlas conviction framework
          </p>
        </div>

        {/* Search input */}
        <div className="max-w-2xl mx-auto flex gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by city, postcode, or deal type..."
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 focus:border-[#1B4FE4]/60 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors shadow-sm"
            />
          </div>
          <button className="px-6 py-3.5 bg-[#1B4FE4] hover:bg-[#1641C0] text-white font-bold rounded-xl transition-colors whitespace-nowrap text-sm">
            Search
          </button>
        </div>

        {/* Stats inline */}
        <div className="max-w-2xl mx-auto mt-4 flex items-center justify-center gap-6 text-[11px] font-mono text-gray-500">
          <span>
            <span className="text-gray-900 font-bold">{filtered.length}</span> deals found
          </span>
          <span>🇺🇸 <span className="text-gray-900 font-bold">{listings.filter(l => l.municipalities?.country === "United States").length}</span> USA</span>
          <span>🇬🇧 <span className="text-gray-900 font-bold">{listings.filter(l => l.municipalities?.country === "United Kingdom").length}</span> UK</span>
          {avgYield && (
            <span>avg yield <span className="text-[#00C805] font-bold">{avgYield}%</span></span>
          )}
        </div>
      </div>

      {/* ── Filter + sort bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
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

        <div className="w-px h-6 bg-gray-200 hidden sm:block" />

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

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-gray-400 hidden sm:block">Sort:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 outline-none focus:border-[#1B4FE4]/50 cursor-pointer"
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
      <p className="text-[11px] text-gray-400 mb-4 font-mono">
        Showing <span className="text-gray-900 font-bold">{filtered.length}</span> of {listings.length} opportunities
      </p>

      {/* ── Card grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 border border-gray-200 rounded-2xl bg-gray-50">
          <p className="text-4xl">🔍</p>
          <p className="font-bold text-lg text-gray-900">No deals match your filters</p>
          <p className="text-sm text-gray-500">Try adjusting the market or deal type above</p>
          <button
            onClick={() => { setMarket("all"); setDealType("all"); setSearch(""); }}
            className="mt-2 px-4 py-2 rounded-lg border border-[#1B4FE4]/40 text-[#1B4FE4] text-sm font-semibold hover:bg-[#1B4FE4]/10 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} isMember={isMember} />
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-between">
        <p className="text-[10px] font-mono text-gray-400">
          PRIME ATLAS INTELLIGENCE · USA + UK · REFRESHED DAILY
        </p>
        <a
          href="mailto:deals@prime-atlas.com?subject=Submit a listing"
          className="text-[11px] font-mono text-[#1B4FE4]/60 hover:text-[#1B4FE4] transition-colors"
        >
          + Submit a listing
        </a>
      </div>
    </div>
  );
}
