"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { FilterDrawer } from "@/components/ui/FilterDrawer";

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
  scraped_at: string;
}

interface Props { properties: ScrapedProperty[] }

/* ─── helpers ────────────────────────────────────────────────────── */

const SYM: Record<string, string> = { USD: "$", GBP: "£" };

function getCountry(currency: string): "UK" | "US" {
  return currency === "GBP" ? "UK" : "US";
}

function getUKRegion(address: string | null): string {
  if (!address) return "UK";
  const parts = address.split(",").map(p => p.trim());
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    if (!candidate.match(/^[A-Z]{1,2}\d/)) return candidate;
  }
  return "UK";
}

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

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "< 1h" : h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

const STATES: Record<string, string> = {
  NY: "New York", CA: "California", TX: "Texas", FL: "Florida",
  IL: "Illinois", PA: "Pennsylvania", OH: "Ohio", GA: "Georgia",
  NC: "N. Carolina", WA: "Washington", CO: "Colorado", TN: "Tennessee",
  OR: "Oregon", NV: "Nevada", MN: "Minnesota", MA: "Massachusetts",
  MI: "Michigan", AZ: "Arizona", WI: "Wisconsin", MD: "Maryland",
  KY: "Kentucky",
};

/* ─── component ─────────────────────────────────────────────────── */

export function MarketFeedExplorer({ properties }: Props) {
  const [typeFilter,   setTypeFilter]   = useState<"all" | "sale" | "rent">("all");
  const [marketFilter, setMarketFilter] = useState<"ALL" | "USA" | "UK">("ALL");
  const [stateFilter,  setStateFilter]  = useState("ALL");
  const [sortBy,       setSortBy]       = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [stateOpen,    setStateOpen]    = useState(false);
  const [sortOpen,     setSortOpen]     = useState(false);

  const closeState = useCallback(() => setStateOpen(false), []);
  const closeSort  = useCallback(() => setSortOpen(false),  []);

  const states = useMemo(() => {
    const s = new Set(
      properties
        .filter(p => getCountry(p.currency_code) === "US")
        .map(p => getState(p.address))
        .filter(x => x !== "—")
    );
    return Array.from(s).sort();
  }, [properties]);

  const filtered = useMemo(() => {
    let list = properties;
    if (marketFilter === "USA") list = list.filter(p => getCountry(p.currency_code) === "US");
    if (marketFilter === "UK")  list = list.filter(p => getCountry(p.currency_code) === "UK");
    if (typeFilter !== "all")   list = list.filter(p => p.listing_type === typeFilter);
    if (stateFilter !== "ALL" && marketFilter !== "UK") {
      list = list.filter(p => getState(p.address) === stateFilter);
    }
    return [...list].sort((a, b) => {
      if (sortBy === "price_asc")  return (a.price ?? 0) - (b.price ?? 0);
      if (sortBy === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime();
    });
  }, [properties, typeFilter, marketFilter, stateFilter, sortBy]);

  /* ── pill factory ── */
  const pill = (active: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
        active
          ? "bg-[#1B4FE4] text-white border-[#1B4FE4]"
          : "bg-white border-gray-200 text-gray-600 hover:border-[#1B4FE4]/40 hover:text-[#1B4FE4]"
      }`}
    >
      {label}
    </button>
  );

  const drawerRow = (active: boolean, onClick: () => void, label: string, sub?: string) => (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center justify-between px-5 py-4 rounded-2xl text-sm font-semibold transition-colors ${
        active ? "bg-[#EEF3FD] text-[#1B4FE4]" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span>{label}</span>
      {sub && <span className="text-xs text-gray-400 font-mono ml-2">{sub}</span>}
    </button>
  );

  return (
    <div>
      {/* ── Market + Type filter row ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap mb-3">
        {pill(marketFilter === "ALL", () => { setMarketFilter("ALL"); setStateFilter("ALL"); }, "All Markets")}
        {pill(marketFilter === "USA", () => { setMarketFilter("USA"); setStateFilter("ALL"); }, "🇺🇸 USA")}
        {pill(marketFilter === "UK",  () => { setMarketFilter("UK");  setStateFilter("ALL"); }, "🇬🇧 UK")}
        <div className="shrink-0 w-px h-4 bg-gray-200 mx-1" />
        {pill(typeFilter === "all",  () => setTypeFilter("all"),  "All")}
        {pill(typeFilter === "sale", () => setTypeFilter("sale"), "For Sale")}
        {pill(typeFilter === "rent", () => setTypeFilter("rent"), "For Rent")}
      </div>

      {/* ── US State + Sort row ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap mb-6">

        {/* Mobile state pill → drawer */}
        {marketFilter !== "UK" && (
          <button
            onClick={() => setStateOpen(true)}
            className={`md:hidden shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              stateFilter !== "ALL"
                ? "bg-[#1B4FE4] text-white border-[#1B4FE4]"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            {stateFilter === "ALL" ? "All States" : (STATES[stateFilter] ?? stateFilter)}
            <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Desktop state pills */}
        {marketFilter !== "UK" && (
          <div className="hidden md:flex flex-wrap gap-1.5">
            {["ALL", ...states].map(s => (
              pill(stateFilter === s, () => setStateFilter(s), s === "ALL" ? "All States" : (STATES[s] ?? s))
            ))}
          </div>
        )}

        {/* Mobile sort pill → drawer */}
        <button
          onClick={() => setSortOpen(true)}
          className="md:hidden shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600 whitespace-nowrap ml-auto"
        >
          {sortBy === "recent" ? "Recent" : sortBy === "price_asc" ? "Price ↑" : "Price ↓"}
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M10 12h4" />
          </svg>
        </button>

        {/* Desktop sort */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-400">Sort</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1B4FE4]/50"
          >
            <option value="recent">Most recent</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </div>
      </div>

      {/* ── Count line ── */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-5 tabular-nums">
        {filtered.length.toLocaleString()} listings
        {marketFilter !== "ALL" && ` · ${marketFilter === "USA" ? "United States" : "United Kingdom"}`}
        {stateFilter !== "ALL" && ` · ${STATES[stateFilter] ?? stateFilter}`}
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-400 text-sm">No listings match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const country = getCountry(p.currency_code);
            const stateCode = getState(p.address);
            const locationLabel = country === "UK"
              ? getUKRegion(p.address)
              : stateCode !== "—" ? `${STATES[stateCode] ?? stateCode}, USA` : null;
            return (
              <Link key={p.id} href={`/market-feed/${p.id}`} className="group bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-[#1B4FE4]/30 hover:shadow-md transition-all cursor-pointer">
                {/* Row 1: badges + time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      p.listing_type === "sale"
                        ? "text-green-600 bg-green-50"
                        : "text-blue-600 bg-blue-50"
                    }`}>
                      {p.listing_type === "sale" ? "For Sale" : "For Rent"}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-gray-500 bg-gray-100">
                      {country === "UK" ? "🇬🇧 UK" : "🇺🇸 USA"}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-400">{timeAgo(p.scraped_at)} ago</span>
                </div>

                {/* Row 2: Price */}
                {p.price && (
                  <p className="text-[28px] font-black text-gray-900 leading-none tabular-nums tracking-tight">
                    {fmtPrice(p.price, p.currency_code)}
                  </p>
                )}

                {/* Row 3: Address */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {p.address ?? "Address unavailable"}
                  </p>
                  {locationLabel && (
                    <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">
                      {locationLabel}
                    </p>
                  )}
                </div>

                {/* Row 4: Specs + CTA */}
                <div className="flex gap-4 text-xs text-gray-400 items-center">
                  {p.bedrooms  != null && <span><span className="text-gray-900 font-bold">{p.bedrooms}</span> bd</span>}
                  {p.bathrooms != null && <span><span className="text-gray-900 font-bold">{p.bathrooms}</span> ba</span>}
                  {p.size_sqm  != null && <span><span className="text-gray-900 font-bold">{Number(p.size_sqm).toLocaleString()}</span> sqm</span>}
                  {p.property_type && (
                    <span className="capitalize text-gray-300">{p.property_type}</span>
                  )}
                  <span className="ml-auto text-[#1B4FE4] font-semibold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                    View analysis →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── State drawer ── */}
      <FilterDrawer open={stateOpen} onClose={closeState} title="Filter by Location">
        <div className="flex flex-col gap-1">
          {drawerRow(stateFilter === "ALL", () => { setStateFilter("ALL"); closeState(); }, "All States")}
          {states.map(s =>
            drawerRow(stateFilter === s, () => { setStateFilter(s); closeState(); }, STATES[s] ?? s, s)
          )}
        </div>
      </FilterDrawer>

      {/* ── Sort drawer ── */}
      <FilterDrawer open={sortOpen} onClose={closeSort} title="Sort by">
        <div className="flex flex-col gap-1">
          {(["recent", "price_asc", "price_desc"] as const).map(opt =>
            drawerRow(
              sortBy === opt,
              () => { setSortBy(opt); closeSort(); },
              opt === "recent" ? "Most Recent" : opt === "price_asc" ? "Price: Low to High" : "Price: High to Low"
            )
          )}
        </div>
      </FilterDrawer>
    </div>
  );
}
