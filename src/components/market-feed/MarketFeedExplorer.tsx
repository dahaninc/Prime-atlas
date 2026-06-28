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

interface Props {
  properties: ScrapedProperty[];
}

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

const PROVIDER_LABEL: Record<string, string> = {
  zillow:        "Zillow",
  realtor_ca:    "Realtor.ca",
  realestate_au: "REA",
  idealista:     "Idealista",
};

const US_STATES: Record<string, string> = {
  NY: "New York", CA: "California", TX: "Texas", FL: "Florida",
  IL: "Illinois", PA: "Pennsylvania", OH: "Ohio", GA: "Georgia",
  NC: "N. Carolina", IN: "Indiana", WA: "Washington", CO: "Colorado",
  TN: "Tennessee", OK: "Oklahoma", MD: "Maryland", KY: "Kentucky",
  OR: "Oregon", WI: "Wisconsin", NV: "Nevada", NM: "New Mexico",
  MN: "Minnesota", MA: "Massachusetts", MI: "Michigan", AZ: "Arizona",
};

/* ─── pill styles ────────────────────────────────────────────────── */

const pillBase = "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-[100ms] cursor-pointer whitespace-nowrap";
const pillActive = "bg-pa-green text-pa-navy border-pa-green";
const pillInactive = "text-muted-foreground border-border hover:border-pa-green/50 hover:text-foreground bg-transparent";

/* ─── component ─────────────────────────────────────────────────── */

export function MarketFeedExplorer({ properties }: Props) {
  const [typeFilter, setTypeFilter]   = useState<"all" | "sale" | "rent">("all");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [sortBy, setSortBy]           = useState<"recent" | "price_asc" | "price_desc">("recent");

  // Drawer state
  const [stateDrawerOpen, setStateDrawerOpen] = useState(false);
  const [sortDrawerOpen, setSortDrawerOpen]   = useState(false);

  const closeStateDrawer = useCallback(() => setStateDrawerOpen(false), []);
  const closeSortDrawer  = useCallback(() => setSortDrawerOpen(false),  []);

  // Derive available states from actual data
  const availableStates = useMemo(() => {
    const set = new Set(properties.map(p => getState(p.address)).filter(s => s !== "—"));
    return Array.from(set).sort();
  }, [properties]);

  const filtered = useMemo(() => {
    let list = properties;
    if (typeFilter !== "all") list = list.filter(p => p.listing_type === typeFilter);
    if (stateFilter !== "ALL") list = list.filter(p => getState(p.address) === stateFilter);

    return [...list].sort((a, b) => {
      if (sortBy === "price_asc")  return (a.price ?? 0) - (b.price ?? 0);
      if (sortBy === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime();
    });
  }, [properties, typeFilter, stateFilter, sortBy]);

  const stateLabel = stateFilter === "ALL" ? "All States" : (US_STATES[stateFilter] ?? stateFilter);
  const sortLabel  = sortBy === "recent" ? "Recent" : sortBy === "price_asc" ? "Price ↑" : "Price ↓";

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="mb-5">

        {/* Horizontal pill scroll row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">

          {/* Type pills — always visible */}
          {(["all", "sale", "rent"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`${pillBase} ${typeFilter === t ? pillActive : pillInactive}`}
            >
              {t === "all" ? "All" : t === "sale" ? "For Sale" : "For Rent"}
            </button>
          ))}

          {/* Divider */}
          <div className="shrink-0 w-px h-5 bg-border mx-0.5" />

          {/* State filter pill — opens drawer on mobile, inline on desktop */}
          <>
            {/* Mobile: tap to open drawer */}
            <button
              onClick={() => setStateDrawerOpen(true)}
              className={`md:hidden ${pillBase} ${stateFilter !== "ALL" ? pillActive : pillInactive} flex items-center gap-1`}
            >
              {stateLabel}
              <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Desktop: inline pills */}
            <div className="hidden md:flex flex-wrap gap-1.5">
              <button
                onClick={() => setStateFilter("ALL")}
                className={`${pillBase} ${stateFilter === "ALL" ? pillActive : pillInactive}`}
              >
                All States
              </button>
              {availableStates.map(s => (
                <button
                  key={s}
                  onClick={() => setStateFilter(s)}
                  className={`${pillBase} ${stateFilter === s ? pillActive : pillInactive}`}
                >
                  {US_STATES[s] ?? s}
                </button>
              ))}
            </div>
          </>

          {/* Sort pill — opens drawer on mobile */}
          <button
            onClick={() => setSortDrawerOpen(true)}
            className={`md:hidden ${pillBase} ${pillInactive} flex items-center gap-1 ml-auto shrink-0`}
          >
            {sortLabel}
            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-6.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </button>

          {/* Desktop: select */}
          <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none"
            >
              <option value="recent">Most recent</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Count ── */}
      <p className="text-xs text-muted-foreground mb-4">
        Showing <span className="text-foreground font-semibold">{filtered.length.toLocaleString()}</span> properties
        {stateFilter !== "ALL" && <> in <span className="text-foreground">{US_STATES[stateFilter] ?? stateFilter}</span></>}
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">No listings match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="border border-border rounded-xl bg-card p-4 flex flex-col gap-3 hover:border-pa-green/40 transition-colors">

              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    p.listing_type === "sale"
                      ? "text-pa-green border-pa-green/30 bg-pa-green/5"
                      : "text-blue-400 border-blue-400/30 bg-blue-400/5"
                  }`}>
                    {p.listing_type === "sale" ? "For Sale" : "For Rent"}
                  </span>
                  {p.property_type && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground capitalize">
                      {p.property_type}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(p.scraped_at)}</span>
              </div>

              {/* Address */}
              <div>
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                  {p.address ?? "Address unavailable"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {getState(p.address) !== "—" && US_STATES[getState(p.address)]
                    ? `${US_STATES[getState(p.address)]}, US`
                    : p.address?.split(",").slice(-2).join(",").trim()}
                </p>
              </div>

              {/* Price */}
              {p.price && (
                <p className="text-xl font-bold font-mono text-pa-green leading-none">
                  {formatPrice(p.price, p.currency_code)}
                </p>
              )}

              {/* Specs */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {p.bedrooms != null && (
                  <span><span className="text-foreground font-semibold">{p.bedrooms}</span> bd</span>
                )}
                {p.bathrooms != null && (
                  <span><span className="text-foreground font-semibold">{p.bathrooms}</span> ba</span>
                )}
                {p.size_sqm != null && (
                  <span><span className="text-foreground font-semibold">{Number(p.size_sqm).toLocaleString()}</span> sqm</span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                <span className="text-[9px] text-muted-foreground font-mono">
                  via {PROVIDER_LABEL[p.provider] ?? p.provider}
                </span>
                {p.listing_url && (
                  <a
                    href={p.listing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-pa-green hover:underline font-semibold"
                  >
                    View listing →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── State filter drawer (mobile) ── */}
      <FilterDrawer open={stateDrawerOpen} onClose={closeStateDrawer} title="Filter by State">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => { setStateFilter("ALL"); closeStateDrawer(); }}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              stateFilter === "ALL"
                ? "bg-pa-green text-pa-navy"
                : "text-foreground hover:bg-secondary"
            }`}
          >
            All States
          </button>
          {availableStates.map(s => (
            <button
              key={s}
              onClick={() => { setStateFilter(s); closeStateDrawer(); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                stateFilter === s
                  ? "bg-pa-green text-pa-navy"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              {US_STATES[s] ?? s}
              <span className="ml-2 text-xs opacity-60">{s}</span>
            </button>
          ))}
        </div>
      </FilterDrawer>

      {/* ── Sort drawer (mobile) ── */}
      <FilterDrawer open={sortDrawerOpen} onClose={closeSortDrawer} title="Sort by">
        <div className="flex flex-col gap-1">
          {(["recent", "price_asc", "price_desc"] as const).map(opt => (
            <button
              key={opt}
              onClick={() => { setSortBy(opt); closeSortDrawer(); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                sortBy === opt
                  ? "bg-pa-green text-pa-navy"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              {opt === "recent" ? "Most Recent" : opt === "price_asc" ? "Price: Low to High" : "Price: High to Low"}
            </button>
          ))}
        </div>
      </FilterDrawer>
    </div>
  );
}
