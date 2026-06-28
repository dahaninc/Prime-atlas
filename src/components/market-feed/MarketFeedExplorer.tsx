"use client";

import { useState, useMemo, useCallback } from "react";
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
  listing_url: string | null;
  scraped_at: string;
}

interface Props { properties: ScrapedProperty[] }

/* ─── helpers ────────────────────────────────────────────────────── */

const SYM: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", AUD: "A$", CAD: "C$" };

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
};

/* ─── component ─────────────────────────────────────────────────── */

export function MarketFeedExplorer({ properties }: Props) {
  const [typeFilter, setTypeFilter]   = useState<"all" | "sale" | "rent">("all");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [sortBy, setSortBy]           = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [stateOpen, setStateOpen]     = useState(false);
  const [sortOpen,  setSortOpen]      = useState(false);

  const closeState = useCallback(() => setStateOpen(false), []);
  const closeSort  = useCallback(() => setSortOpen(false),  []);

  const states = useMemo(() => {
    const s = new Set(properties.map(p => getState(p.address)).filter(x => x !== "—"));
    return Array.from(s).sort();
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

  /* ── pill factories ── */
  const typePill = (val: "all" | "sale" | "rent", label: string) => (
    <button
      key={val}
      onClick={() => setTypeFilter(val)}
      className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-100 ${
        typeFilter === val
          ? "bg-[#00C805] text-black"
          : "bg-[#18181B] text-[#A1A1AA] hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  const drawerRow = (active: boolean, onClick: () => void, label: string, sub?: string) => (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center justify-between px-5 py-4 rounded-2xl text-sm font-semibold transition-colors ${
        active ? "bg-[#00C805]/10 text-[#00C805]" : "text-white hover:bg-[#18181B]"
      }`}
    >
      <span>{label}</span>
      {sub && <span className="text-xs text-[#A1A1AA] font-mono ml-2">{sub}</span>}
    </button>
  );

  return (
    <div>
      {/* ── Filter row ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap mb-6">

        {typePill("all",  "All")}
        {typePill("sale", "For Sale")}
        {typePill("rent", "For Rent")}

        <div className="shrink-0 w-px h-4 bg-[#27272A] mx-1" />

        {/* Mobile state pill → drawer */}
        <button
          onClick={() => setStateOpen(true)}
          className={`md:hidden shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-100 ${
            stateFilter !== "ALL"
              ? "bg-[#00C805] text-black"
              : "bg-[#18181B] text-[#A1A1AA] hover:text-white"
          }`}
        >
          {stateFilter === "ALL" ? "Location" : (STATES[stateFilter] ?? stateFilter)}
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Desktop state pills */}
        <div className="hidden md:flex flex-wrap gap-1.5">
          {["ALL", ...states].map(s => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-100 ${
                stateFilter === s
                  ? "bg-[#00C805] text-black"
                  : "bg-[#18181B] text-[#A1A1AA] hover:text-white"
              }`}
            >
              {s === "ALL" ? "All States" : (STATES[s] ?? s)}
            </button>
          ))}
        </div>

        {/* Mobile sort pill → drawer */}
        <button
          onClick={() => setSortOpen(true)}
          className="md:hidden shrink-0 flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-semibold bg-[#18181B] text-[#A1A1AA] hover:text-white whitespace-nowrap ml-auto transition-all"
        >
          {sortBy === "recent" ? "Recent" : sortBy === "price_asc" ? "Price ↑" : "Price ↓"}
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M10 12h4" />
          </svg>
        </button>

        {/* Desktop sort */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <span className="text-xs text-[#A1A1AA]">Sort</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-[#18181B] text-white rounded-full px-3 py-1.5 focus:outline-none"
          >
            <option value="recent">Most recent</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </div>
      </div>

      {/* ── Count line ── */}
      <p className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-widest mb-5 tabular-nums">
        {filtered.length.toLocaleString()} listings
        {stateFilter !== "ALL" && ` · ${STATES[stateFilter] ?? stateFilter}`}
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-[#A1A1AA] text-sm">No listings match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-[#18181B] rounded-2xl p-5 flex flex-col gap-4 hover:bg-[#27272A] transition-colors">

              {/* Row 1: badge + time */}
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  p.listing_type === "sale"
                    ? "text-[#00C805] bg-[#00C805]/10"
                    : "text-blue-400 bg-blue-400/10"
                }`}>
                  {p.listing_type === "sale" ? "For Sale" : "For Rent"}
                </span>
                <span className="text-[9px] text-[#A1A1AA]">{timeAgo(p.scraped_at)} ago</span>
              </div>

              {/* Row 2: Price — hero number */}
              {p.price && (
                <p className="text-[28px] font-black text-white leading-none tabular-nums tracking-tight">
                  {fmtPrice(p.price, p.currency_code)}
                </p>
              )}

              {/* Row 3: Address */}
              <div>
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                  {p.address ?? "Address unavailable"}
                </p>
                {getState(p.address) !== "—" && (
                  <p className="text-[10px] text-[#A1A1AA] mt-0.5 uppercase tracking-widest">
                    {STATES[getState(p.address)] ?? getState(p.address)}, US
                  </p>
                )}
              </div>

              {/* Row 4: Specs */}
              <div className="flex gap-4 text-xs text-[#A1A1AA]">
                {p.bedrooms  != null && <span><span className="text-white font-bold">{p.bedrooms}</span> bd</span>}
                {p.bathrooms != null && <span><span className="text-white font-bold">{p.bathrooms}</span> ba</span>}
                {p.size_sqm  != null && <span><span className="text-white font-bold">{Number(p.size_sqm).toLocaleString()}</span> sqm</span>}
              </div>

              {/* Row 5: CTA — Robinhood signature yellow-green */}
              {p.listing_url && (
                <a
                  href={p.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-[#CCFF00] hover:opacity-80 transition-opacity"
                >
                  View listing
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              )}
            </div>
          ))}
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
