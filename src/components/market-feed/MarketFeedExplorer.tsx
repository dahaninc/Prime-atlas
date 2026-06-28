"use client";

import { useState, useMemo, useCallback } from "react";
import { FilterDrawer } from "@/components/ui/FilterDrawer";

/* ─── types ──────────────────────────────────────────────────────── */

export interface ScrapedProperty {
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
  listing_url: string | null;
  scraped_at: string;
}

interface Props { properties: ScrapedProperty[] }

/* ─── helpers ────────────────────────────────────────────────────── */

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", AUD: "A$", CAD: "C$",
};

function formatPrice(cents: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const n = cents / 100;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${sym}${Math.round(n / 1_000)}K`;
  return `${sym}${n.toLocaleString()}`;
}

function getState(address: string | null): string {
  if (!address) return "—";
  const m = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
  return m?.[1] ?? "—";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const US_STATES: Record<string, string> = {
  NY: "New York", CA: "California", TX: "Texas", FL: "Florida",
  IL: "Illinois", PA: "Pennsylvania", OH: "Ohio", GA: "Georgia",
  NC: "N. Carolina", IN: "Indiana", WA: "Washington", CO: "Colorado",
  TN: "Tennessee", OK: "Oklahoma", MD: "Maryland", KY: "Kentucky",
  OR: "Oregon", WI: "Wisconsin", NV: "Nevada", NM: "New Mexico",
  MN: "Minnesota", MA: "Massachusetts", MI: "Michigan", AZ: "Arizona",
};

/* ─── component ─────────────────────────────────────────────────── */

export function MarketFeedExplorer({ properties }: Props) {
  const [typeFilter, setTypeFilter]   = useState<"all" | "sale" | "rent">("all");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [sortBy, setSortBy]           = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [stateDrawerOpen, setStateDrawerOpen] = useState(false);
  const [sortDrawerOpen,  setSortDrawerOpen]  = useState(false);

  const closeStateDrawer = useCallback(() => setStateDrawerOpen(false), []);
  const closeSortDrawer  = useCallback(() => setSortDrawerOpen(false),  []);

  const availableStates = useMemo(() => {
    const set = new Set(properties.map(p => getState(p.address)).filter(s => s !== "—"));
    return Array.from(set).sort();
  }, [properties]);

  const filtered = useMemo(() => {
    let list = properties;
    if (typeFilter !== "all")   list = list.filter(p => p.listing_type === typeFilter);
    if (stateFilter !== "ALL")  list = list.filter(p => getState(p.address) === stateFilter);
    return [...list].sort((a, b) => {
      if (sortBy === "price_asc")  return (a.price ?? 0) - (b.price ?? 0);
      if (sortBy === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime();
    });
  }, [properties, typeFilter, stateFilter, sortBy]);

  const stateLabel = stateFilter === "ALL" ? "Location" : (US_STATES[stateFilter] ?? stateFilter);
  const sortLabel  = sortBy === "recent" ? "Recent" : sortBy === "price_asc" ? "Price ↑" : "Price ↓";

  /* pill styles */
  const pill = (active: boolean) =>
    `shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-100 ${
      active
        ? "bg-[#00c805] text-black"
        : "bg-zinc-800 text-zinc-400 hover:text-white"
    }`;

  const drawerOption = (active: boolean) =>
    `w-full text-left px-5 py-4 rounded-2xl text-sm font-semibold transition-colors ${
      active
        ? "bg-[#00c805]/10 text-[#00c805]"
        : "text-white hover:bg-zinc-800"
    }`;

  return (
    <div>
      {/* ── Filter pills row ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap mb-6">

        {/* Type */}
        {(["all", "sale", "rent"] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={pill(typeFilter === t)}>
            {t === "all" ? "All" : t === "sale" ? "For Sale" : "For Rent"}
          </button>
        ))}

        <div className="shrink-0 w-px h-4 bg-zinc-700 mx-1" />

        {/* State — mobile: drawer, desktop: pills */}
        <button
          onClick={() => setStateDrawerOpen(true)}
          className={`md:hidden ${pill(stateFilter !== "ALL")} flex items-center gap-1`}
        >
          {stateLabel}
          <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="hidden md:flex flex-wrap gap-1.5">
          <button onClick={() => setStateFilter("ALL")} className={pill(stateFilter === "ALL")}>All States</button>
          {availableStates.map(s => (
            <button key={s} onClick={() => setStateFilter(s)} className={pill(stateFilter === s)}>
              {US_STATES[s] ?? s}
            </button>
          ))}
        </div>

        {/* Sort */}
        <button
          onClick={() => setSortDrawerOpen(true)}
          className={`md:hidden ${pill(false)} flex items-center gap-1 ml-auto`}
        >
          {sortLabel}
          <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" />
          </svg>
        </button>

        <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs text-zinc-500">Sort</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-zinc-900 rounded-full px-3 py-1.5 text-white focus:outline-none"
          >
            <option value="recent">Most recent</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </div>
      </div>

      {/* ── Count ── */}
      <p className="text-xs text-zinc-500 mb-5 uppercase tracking-wider font-semibold">
        {filtered.length.toLocaleString()} properties
        {stateFilter !== "ALL" && ` · ${US_STATES[stateFilter] ?? stateFilter}`}
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-zinc-500 text-sm">No listings match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-zinc-900 rounded-2xl p-5 flex flex-col gap-4 hover:bg-zinc-800/80 transition-colors">

              {/* Type + time */}
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  p.listing_type === "sale"
                    ? "text-[#00c805] bg-[#00c805]/10"
                    : "text-blue-400 bg-blue-400/10"
                }`}>
                  {p.listing_type === "sale" ? "For Sale" : "For Rent"}
                </span>
                <span className="text-[9px] text-zinc-600">{timeAgo(p.scraped_at)}</span>
              </div>

              {/* Price — hero number */}
              {p.price && (
                <p className="text-2xl font-black text-[#00c805] leading-none tabular-nums">
                  {formatPrice(p.price, p.currency_code)}
                </p>
              )}

              {/* Address */}
              <div>
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                  {p.address ?? "Address unavailable"}
                </p>
                {getState(p.address) !== "—" && (
                  <p className="text-xs text-zinc-500 mt-0.5 uppercase tracking-wide">
                    {US_STATES[getState(p.address)] ?? getState(p.address)}, US
                  </p>
                )}
              </div>

              {/* Specs */}
              <div className="flex gap-4 text-xs text-zinc-400">
                {p.bedrooms   != null && <span><span className="text-white font-bold">{p.bedrooms}</span> bd</span>}
                {p.bathrooms  != null && <span><span className="text-white font-bold">{p.bathrooms}</span> ba</span>}
                {p.size_sqm   != null && <span><span className="text-white font-bold">{Number(p.size_sqm).toLocaleString()}</span> sqm</span>}
                {p.property_type && (
                  <span className="ml-auto text-zinc-600 capitalize text-[10px] uppercase tracking-wide">{p.property_type}</span>
                )}
              </div>

              {/* CTA */}
              {p.listing_url && (
                <a
                  href={p.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto text-xs font-bold text-[#00c805] hover:underline"
                >
                  View listing →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── State drawer ── */}
      <FilterDrawer open={stateDrawerOpen} onClose={closeStateDrawer} title="Filter by Location">
        <div className="flex flex-col gap-1">
          <button onClick={() => { setStateFilter("ALL"); closeStateDrawer(); }} className={drawerOption(stateFilter === "ALL")}>
            All States
          </button>
          {availableStates.map(s => (
            <button key={s} onClick={() => { setStateFilter(s); closeStateDrawer(); }} className={drawerOption(stateFilter === s)}>
              {US_STATES[s] ?? s}
              <span className="ml-2 text-xs text-zinc-600 font-mono">{s}</span>
            </button>
          ))}
        </div>
      </FilterDrawer>

      {/* ── Sort drawer ── */}
      <FilterDrawer open={sortDrawerOpen} onClose={closeSortDrawer} title="Sort by">
        <div className="flex flex-col gap-1">
          {(["recent", "price_asc", "price_desc"] as const).map(opt => (
            <button key={opt} onClick={() => { setSortBy(opt); closeSortDrawer(); }} className={drawerOption(sortBy === opt)}>
              {opt === "recent" ? "Most Recent" : opt === "price_asc" ? "Price: Low to High" : "Price: High to Low"}
            </button>
          ))}
        </div>
      </FilterDrawer>
    </div>
  );
}
