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
  KY: "Kentucky", VA: "Virginia", SC: "S. Carolina", IN: "Indiana", MO: "Missouri",
};

/* ─── yield estimation ─────────────────────────────────────────── */

const STATE_RENTS: Record<string, number> = {
  NY: 2800, CA: 2600, WA: 2200, MA: 2800, CO: 2000,
  FL: 2000, MD: 2000, OR: 1800, TX: 1800, AZ: 1600,
  GA: 1600, TN: 1600, NC: 1500, MN: 1500, PA: 1500,
  NV: 1700, IL: 1700, OH: 1200, MI: 1200, WI: 1200,
  KY: 1100, VA: 2000, SC: 1400, IN: 1100, MO: 1200,
};
const BED_MULT: Record<number, number> = { 0: 0.60, 1: 0.75, 2: 1.00, 3: 1.30, 4: 1.55 };

function estimateYield(p: ScrapedProperty): number | null {
  if (!p.price || p.listing_type !== "sale") return null;
  const country = getCountry(p.currency_code);
  const state = getState(p.address);
  const beds = p.bedrooms ?? 2;
  const mult = BED_MULT[Math.min(beds, 4)] ?? 1.80;

  let baseUSD: number;
  if (country === "UK") {
    const addr = (p.address ?? "").toLowerCase();
    baseUSD = addr.includes("london") ? 2500 * 1.27
            : (addr.includes("manchester") || addr.includes("birmingham")) ? 1200 * 1.27
            : 1100 * 1.27;
  } else {
    baseUSD = STATE_RENTS[state] ?? 1600;
  }

  const annualUSD = baseUSD * mult * 12;
  const priceUSD  = country === "UK" ? (p.price / 100) * 1.27 : p.price / 100;
  return priceUSD > 0 ? Math.round((annualUSD / priceUSD) * 100 * 10) / 10 : null;
}

/* ─── property type normalisation ──────────────────────────────── */

type PropTypeBucket = "house" | "apartment" | "condo" | "townhouse" | "other";

function normPropType(t: string | null): PropTypeBucket {
  if (!t) return "other";
  const l = t.toLowerCase().replace(/[-_]/g, " ");
  if (l.includes("apartment") || l.includes("flat") || l.includes("studio")) return "apartment";
  if (l.includes("condo") || l.includes("condominium"))                        return "condo";
  if (l.includes("townhouse") || l.includes("town house"))                     return "townhouse";
  if (l.includes("house") || l.includes("detached") || l.includes("semi") ||
      l.includes("single family") || l.includes("bungalow") || l.includes("villa")) return "house";
  return "other";
}

/* ─── enriched item ─────────────────────────────────────────────── */

interface Enriched extends ScrapedProperty {
  estYield: number | null;
  sqft: number | null;
  propBucket: PropTypeBucket;
}

function enrich(p: ScrapedProperty): Enriched {
  return {
    ...p,
    estYield:   estimateYield(p),
    sqft:       p.size_sqm != null ? Math.round(Number(p.size_sqm) * 10.764) : null,
    propBucket: normPropType(p.property_type),
  };
}

/* ─── component ─────────────────────────────────────────────────── */

type SortKey = "recent" | "price_asc" | "price_desc" | "yield_desc" | "yield_asc" | "size_asc" | "size_desc";
type YieldFilter = "all" | "4" | "6" | "8" | "10";
type PropTypeFilter = "all" | PropTypeBucket;

const SORT_LABELS: Record<SortKey, string> = {
  recent:     "Most Recent",
  price_asc:  "Price ↑",
  price_desc: "Price ↓",
  yield_desc: "Yield ↓ (highest)",
  yield_asc:  "Yield ↑ (lowest)",
  size_asc:   "Size ↑",
  size_desc:  "Size ↓",
};

const YIELD_LABELS: Record<YieldFilter, string> = {
  all: "Any Yield", "4": "4%+", "6": "6%+", "8": "8%+", "10": "10%+",
};

const PROP_TYPE_LABELS: Record<PropTypeFilter, string> = {
  all: "All Types", house: "House", apartment: "Apartment / Flat",
  condo: "Condo", townhouse: "Townhouse", other: "Other",
};

export function MarketFeedExplorer({ properties }: Props) {
  const [marketFilter,   setMarketFilter]   = useState<"ALL" | "USA" | "UK">("ALL");
  const [listingFilter,  setListingFilter]  = useState<"all" | "sale" | "rent">("all");
  const [propTypeFilter, setPropTypeFilter] = useState<PropTypeFilter>("all");
  const [stateFilter,    setStateFilter]    = useState("ALL");
  const [yieldFilter,    setYieldFilter]    = useState<YieldFilter>("all");
  const [sortBy,         setSortBy]         = useState<SortKey>("recent");

  // Drawers (mobile)
  const [stateOpen,    setStateOpen]    = useState(false);
  const [sortOpen,     setSortOpen]     = useState(false);
  const [yieldOpen,    setYieldOpen]    = useState(false);
  const [propTypeOpen, setPropTypeOpen] = useState(false);

  const closeState    = useCallback(() => setStateOpen(false),    []);
  const closeSort     = useCallback(() => setSortOpen(false),     []);
  const closeYield    = useCallback(() => setYieldOpen(false),    []);
  const closePropType = useCallback(() => setPropTypeOpen(false), []);

  // Enrich all properties once
  const enriched = useMemo(() => properties.map(enrich), [properties]);

  // Available states
  const states = useMemo(() => {
    const s = new Set(
      enriched.filter(p => getCountry(p.currency_code) === "US").map(p => getState(p.address)).filter(x => x !== "—")
    );
    return Array.from(s).sort();
  }, [enriched]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = enriched;
    if (marketFilter === "USA")   list = list.filter(p => getCountry(p.currency_code) === "US");
    if (marketFilter === "UK")    list = list.filter(p => getCountry(p.currency_code) === "UK");
    if (listingFilter !== "all")  list = list.filter(p => p.listing_type === listingFilter);
    if (propTypeFilter !== "all") list = list.filter(p => p.propBucket === propTypeFilter);
    if (stateFilter !== "ALL" && marketFilter !== "UK") {
      list = list.filter(p => getState(p.address) === stateFilter);
    }
    if (yieldFilter !== "all") {
      const min = Number(yieldFilter);
      list = list.filter(p => p.estYield != null && p.estYield >= min);
    }
    return [...list].sort((a, b) => {
      if (sortBy === "price_asc")  return (a.price ?? 0) - (b.price ?? 0);
      if (sortBy === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      if (sortBy === "yield_desc") return (b.estYield ?? 0) - (a.estYield ?? 0);
      if (sortBy === "yield_asc")  return (a.estYield ?? 0) - (b.estYield ?? 0);
      if (sortBy === "size_asc")   return (a.size_sqm != null ? Number(a.size_sqm) : 0) - (b.size_sqm != null ? Number(b.size_sqm) : 0);
      if (sortBy === "size_desc")  return (b.size_sqm != null ? Number(b.size_sqm) : 0) - (a.size_sqm != null ? Number(a.size_sqm) : 0);
      return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime();
    });
  }, [enriched, marketFilter, listingFilter, propTypeFilter, stateFilter, yieldFilter, sortBy]);

  /* ── pill ── */
  const pill = (active: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
        active
          ? "bg-[#1B4FE4] text-white border-[#1B4FE4]"
          : "bg-white border-gray-200 text-gray-600 hover:border-[#1B4FE4]/40 hover:text-[#1B4FE4]"
      }`}
    >
      {label}
    </button>
  );

  /* ── mobile filter pill (opens drawer) ── */
  const mobilePill = (active: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      className={`md:hidden shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
        active ? "bg-[#1B4FE4] text-white border-[#1B4FE4]" : "bg-white border-gray-200 text-gray-600"
      }`}
    >
      {label}
      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  /* ── drawer row ── */
  const drawerRow = (active: boolean, onClick: () => void, label: string, sub?: string) => (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-semibold transition-colors ${
        active ? "bg-[#EEF3FD] text-[#1B4FE4]" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span>{label}</span>
      {sub && <span className="text-xs text-gray-400 font-mono ml-2">{sub}</span>}
    </button>
  );

  const activeFilters = [
    listingFilter !== "all",
    propTypeFilter !== "all",
    stateFilter !== "ALL",
    yieldFilter !== "all",
  ].filter(Boolean).length;

  return (
    <div>

      {/* ── Row 1: Market + Listing type ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap mb-3">
        {pill(marketFilter === "ALL", () => { setMarketFilter("ALL"); setStateFilter("ALL"); }, "All Markets")}
        {pill(marketFilter === "USA", () => { setMarketFilter("USA"); setStateFilter("ALL"); }, "🇺🇸 USA")}
        {pill(marketFilter === "UK",  () => { setMarketFilter("UK");  setStateFilter("ALL"); }, "🇬🇧 UK")}
        <div className="shrink-0 w-px h-4 bg-gray-200 mx-1 hidden md:block" />
        {pill(listingFilter === "all",  () => setListingFilter("all"),  "All")}
        {pill(listingFilter === "sale", () => setListingFilter("sale"), "For Sale")}
        {pill(listingFilter === "rent", () => setListingFilter("rent"), "For Rent")}
      </div>

      {/* ── Row 2: Property type (desktop) + mobile drawer pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap mb-3">

        {/* Desktop prop type pills */}
        <div className="hidden md:flex flex-wrap gap-1.5">
          {(["all", "house", "apartment", "condo", "townhouse"] as PropTypeFilter[]).map(t =>
            pill(propTypeFilter === t, () => setPropTypeFilter(t), PROP_TYPE_LABELS[t])
          )}
        </div>

        {/* Mobile drawer pills */}
        {mobilePill(propTypeFilter !== "all", () => setPropTypeOpen(true), propTypeFilter === "all" ? "Property Type" : PROP_TYPE_LABELS[propTypeFilter])}
        {mobilePill(stateFilter !== "ALL" && marketFilter !== "UK", () => setStateOpen(true), stateFilter === "ALL" ? "State" : (STATES[stateFilter] ?? stateFilter))}
        {mobilePill(yieldFilter !== "all", () => setYieldOpen(true), yieldFilter === "all" ? "Yield" : `${yieldFilter}%+`)}
        {mobilePill(false, () => setSortOpen(true), sortBy === "recent" ? "Sort" : SORT_LABELS[sortBy])}
      </div>

      {/* ── Row 3: Yield + State (desktop) + Sort ── */}
      <div className="hidden md:flex items-start gap-3 mb-6">

        {/* Yield pills */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider self-center mr-1">Yield</span>
          {(["all", "4", "6", "8", "10"] as YieldFilter[]).map(y =>
            pill(yieldFilter === y, () => setYieldFilter(y), YIELD_LABELS[y])
          )}
          {marketFilter !== "UK" && states.length > 0 && (
            <>
              <div className="w-px h-5 bg-gray-200 mx-2 self-center" />
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider self-center mr-1">State</span>
              {["ALL", ...states].map(s =>
                pill(stateFilter === s, () => setStateFilter(s), s === "ALL" ? "All States" : (STATES[s] ?? s))
              )}
            </>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">Sort</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="text-xs bg-white border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1B4FE4]/50"
          >
            <option value="recent">Most recent</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="yield_desc">Yield ↓ (highest first)</option>
            <option value="yield_asc">Yield ↑ (lowest first)</option>
            <option value="size_desc">Size ↓ (largest first)</option>
            <option value="size_asc">Size ↑ (smallest first)</option>
          </select>
        </div>
      </div>

      {/* ── Count + active filter summary ── */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-5 tabular-nums">
        {filtered.length.toLocaleString()} listings
        {marketFilter !== "ALL" && ` · ${marketFilter === "USA" ? "United States" : "United Kingdom"}`}
        {stateFilter !== "ALL" && ` · ${STATES[stateFilter] ?? stateFilter}`}
        {propTypeFilter !== "all" && ` · ${PROP_TYPE_LABELS[propTypeFilter]}`}
        {yieldFilter !== "all" && ` · ${yieldFilter}%+ yield`}
        {activeFilters > 0 && (
          <button
            onClick={() => { setListingFilter("all"); setPropTypeFilter("all"); setStateFilter("ALL"); setYieldFilter("all"); }}
            className="ml-3 text-[#1B4FE4] hover:underline normal-case tracking-normal"
          >
            Clear filters
          </button>
        )}
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
            const sym = SYM[p.currency_code] ?? "";

            return (
              <Link
                key={p.id}
                href={`/market-feed/${p.id}`}
                className="group bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:border-[#1B4FE4]/30 hover:shadow-md transition-all"
              >
                {/* Row 1: badges + time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      p.listing_type === "sale" ? "text-green-600 bg-green-50" : "text-blue-600 bg-blue-50"
                    }`}>
                      {p.listing_type === "sale" ? "For Sale" : "For Rent"}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded text-gray-500 bg-gray-100">
                      {country === "UK" ? "🇬🇧 UK" : "🇺🇸 USA"}
                    </span>
                    {p.propBucket !== "other" && (
                      <span className="text-[9px] capitalize text-gray-400 border border-gray-100 rounded px-1.5 py-0.5">
                        {PROP_TYPE_LABELS[p.propBucket]}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400">{timeAgo(p.scraped_at)}</span>
                </div>

                {/* Row 2: Price + yield badge */}
                <div className="flex items-end justify-between gap-2">
                  {p.price && (
                    <p className="text-[28px] font-black text-gray-900 leading-none tabular-nums tracking-tight">
                      {fmtPrice(p.price, p.currency_code)}
                    </p>
                  )}
                  {p.estYield != null && (
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg mb-0.5 ${
                      p.estYield >= 8 ? "text-green-700 bg-green-50 border border-green-200" :
                      p.estYield >= 6 ? "text-[#1B4FE4] bg-[#EEF3FD] border border-[#1B4FE4]/20" :
                      "text-amber-700 bg-amber-50 border border-amber-200"
                    }`}>
                      ~{p.estYield}% yield
                    </span>
                  )}
                </div>

                {/* Row 3: Address */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {p.address ?? "Address unavailable"}
                  </p>
                  {locationLabel && (
                    <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">{locationLabel}</p>
                  )}
                </div>

                {/* Row 4: Specs */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-400 items-center pt-1 border-t border-gray-50">
                  {p.bedrooms  != null && <span><span className="text-gray-800 font-bold">{p.bedrooms}</span> bd</span>}
                  {p.bathrooms != null && <span><span className="text-gray-800 font-bold">{p.bathrooms}</span> ba</span>}
                  {p.size_sqm  != null && (
                    <span>
                      <span className="text-gray-800 font-bold">{Number(p.size_sqm).toLocaleString()}</span> sqm
                      <span className="text-gray-300 mx-1">·</span>
                      <span className="text-gray-800 font-bold">{p.sqft?.toLocaleString()}</span> sqft
                    </span>
                  )}
                  {p.price != null && p.size_sqm != null && (
                    <span className="text-gray-400">
                      {sym}{Math.round((p.price / 100) / Number(p.size_sqm)).toLocaleString()}/sqm
                    </span>
                  )}
                  <span className="ml-auto text-[#1B4FE4] font-semibold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                    Analyse →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Mobile: Property Type drawer ── */}
      <FilterDrawer open={propTypeOpen} onClose={closePropType} title="Property Type">
        <div className="flex flex-col gap-1">
          {(["all", "house", "apartment", "condo", "townhouse", "other"] as PropTypeFilter[]).map(t =>
            drawerRow(propTypeFilter === t, () => { setPropTypeFilter(t); closePropType(); }, PROP_TYPE_LABELS[t])
          )}
        </div>
      </FilterDrawer>

      {/* ── Mobile: State drawer ── */}
      <FilterDrawer open={stateOpen} onClose={closeState} title="Filter by State">
        <div className="flex flex-col gap-1">
          {drawerRow(stateFilter === "ALL", () => { setStateFilter("ALL"); closeState(); }, "All States")}
          {states.map(s =>
            drawerRow(stateFilter === s, () => { setStateFilter(s); closeState(); }, STATES[s] ?? s, s)
          )}
        </div>
      </FilterDrawer>

      {/* ── Mobile: Yield drawer ── */}
      <FilterDrawer open={yieldOpen} onClose={closeYield} title="Filter by Est. Yield">
        <div className="flex flex-col gap-1">
          {(["all", "4", "6", "8", "10"] as YieldFilter[]).map(y =>
            drawerRow(yieldFilter === y, () => { setYieldFilter(y); closeYield(); }, YIELD_LABELS[y],
              y !== "all" ? "est. gross yield" : undefined)
          )}
        </div>
      </FilterDrawer>

      {/* ── Mobile: Sort drawer ── */}
      <FilterDrawer open={sortOpen} onClose={closeSort} title="Sort by">
        <div className="flex flex-col gap-1">
          {(Object.keys(SORT_LABELS) as SortKey[]).map(opt =>
            drawerRow(sortBy === opt, () => { setSortBy(opt); closeSort(); }, SORT_LABELS[opt])
          )}
        </div>
      </FilterDrawer>
    </div>
  );
}
