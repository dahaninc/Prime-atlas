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
  images?: string[] | null;
}

interface Props { properties: ScrapedProperty[]; initialQuery?: string }

/* ─── helpers ────────────────────────────────────────────────────── */

const SYM: Record<string, string> = { USD: "$", GBP: "£" };

function getCountry(currency: string): "UK" | "US" {
  return currency === "GBP" ? "UK" : "US";
}

function getUKRegion(address: string | null): string {
  if (!address) return "UK";
  const parts = address.split(",").map(p => p.trim());
  if (parts.length >= 2) {
    const c = parts[parts.length - 2];
    if (!c.match(/^[A-Z]{1,2}\d/)) return c;
  }
  return "UK";
}

/** Returns city/state or region only — never exposes street-level address */
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
    const state = getState(address);
    return state !== "—" ? state : "United States";
  } else {
    const parts = address.split(",").map(p => p.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p.match(/^[A-Z]{1,2}\d/) && p.length > 2) return p;
    }
    return "United Kingdom";
  }
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

const STATE_NAMES: Record<string, string> = {
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
  let baseUSD = country === "UK"
    ? ((p.address ?? "").toLowerCase().includes("london") ? 2500 : 1150) * 1.27
    : (STATE_RENTS[state] ?? 1600);
  const annualUSD = baseUSD * mult * 12;
  const priceUSD  = country === "UK" ? (p.price / 100) * 1.27 : p.price / 100;
  return priceUSD > 0 ? Math.round((annualUSD / priceUSD) * 100 * 10) / 10 : null;
}

/* ─── property type normalisation ──────────────────────────────── */

type PropBucket = "house" | "apartment" | "condo" | "townhouse" | "other";

function normType(t: string | null): PropBucket {
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
  propBucket: PropBucket;
  stateCode: string;
  country: "UK" | "US";
}

function enrich(p: ScrapedProperty): Enriched {
  return {
    ...p,
    estYield:   estimateYield(p),
    sqft:       p.size_sqm != null ? Math.round(Number(p.size_sqm) * 10.764) : null,
    propBucket: normType(p.property_type),
    stateCode:  getState(p.address),
    country:    getCountry(p.currency_code),
  };
}

/* ─── filter types ──────────────────────────────────────────────── */

type MarketF    = "ALL" | "USA" | "UK";
type ListingF   = "all" | "sale" | "rent";
type PropTypeF  = "all" | PropBucket;
type YieldF     = "all" | "4" | "6" | "8" | "10";
type PriceRangeF = "all" | "u300" | "300-600" | "600-1000" | "1000p";
type SizeRangeF  = "all" | "u100" | "100-200" | "200-400" | "400p";
type SortKey    = "recent" | "price_asc" | "price_desc" | "yield_desc" | "yield_asc" | "size_desc" | "size_asc";

const SORT_LABELS: Record<SortKey, string> = {
  recent:     "Most recent",
  yield_desc: "Yield ↓ (highest)",
  yield_asc:  "Yield ↑ (lowest)",
  price_asc:  "Price ↑",
  price_desc: "Price ↓",
  size_desc:  "Size ↓ (largest)",
  size_asc:   "Size ↑ (smallest)",
};

/* ─── off-white palette ─────────────────────────────────────────── */
// All colors using warm off-white tones (stone/cream palette)
const C = {
  pageBg:      "bg-background",
  sidebarBg:   "bg-card",
  cardBg:      "bg-card",
  topbarBg:    "bg-background",
  border:      "border-border",
  borderLight: "border-border",
  textPrimary: "text-zinc-200",
  textMuted:   "text-zinc-500",
  textSecond:  "text-zinc-500",
  pillActive:  "bg-primary text-white border-primary",
  pillInactive:"bg-card border-border text-zinc-400 hover:border-primary/40 hover:text-primary",
};

/* ─── component ─────────────────────────────────────────────────── */

export function MarketFeedExplorer({ properties, initialQuery }: Props) {
  const [market,    setMarket]    = useState<MarketF>("ALL");
  const [query,     setQuery]     = useState(initialQuery ?? "");
  const [listing,   setListing]   = useState<ListingF>("all");
  const [propType,  setPropType]  = useState<PropTypeF>("all");
  const [state,     setState]     = useState("ALL");
  const [yieldF,    setYieldF]    = useState<YieldF>("all");
  const [priceF,    setPriceF]    = useState<PriceRangeF>("all");
  const [sizeF,     setSizeF]     = useState<SizeRangeF>("all");
  const [minBeds,   setMinBeds]   = useState(0);
  const [sortBy,    setSortBy]    = useState<SortKey>("yield_desc");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileFiltersOpen(false), []);

  const enriched = useMemo(() => properties.map(enrich), [properties]);

  const states = useMemo(() => {
    const s = new Set(enriched.filter(p => p.country === "US").map(p => p.stateCode).filter(x => x !== "—"));
    return Array.from(s).sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(p => (p.address ?? "").toLowerCase().includes(q));
    }
    if (market === "USA")     list = list.filter(p => p.country === "US");
    if (market === "UK")      list = list.filter(p => p.country === "UK");
    if (listing !== "all")    list = list.filter(p => p.listing_type === listing);
    if (propType !== "all")   list = list.filter(p => p.propBucket === propType);
    if (state !== "ALL" && market !== "UK") list = list.filter(p => p.stateCode === state);
    if (minBeds > 0)          list = list.filter(p => (p.bedrooms ?? 0) >= minBeds);
    if (yieldF !== "all")     list = list.filter(p => p.estYield != null && p.estYield >= Number(yieldF));

    if (priceF !== "all") {
      list = list.filter(p => {
        const priceUSD = p.country === "UK" ? ((p.price ?? 0) / 100) * 1.27 : (p.price ?? 0) / 100;
        if (priceF === "u300")    return priceUSD < 300_000;
        if (priceF === "300-600") return priceUSD >= 300_000 && priceUSD < 600_000;
        if (priceF === "600-1000")return priceUSD >= 600_000 && priceUSD < 1_000_000;
        if (priceF === "1000p")   return priceUSD >= 1_000_000;
        return true;
      });
    }
    if (sizeF !== "all") {
      list = list.filter(p => {
        const sqm = Number(p.size_sqm ?? 0);
        if (sizeF === "u100")    return sqm > 0 && sqm < 100;
        if (sizeF === "100-200") return sqm >= 100 && sqm < 200;
        if (sizeF === "200-400") return sqm >= 200 && sqm < 400;
        if (sizeF === "400p")    return sqm >= 400;
        return true;
      });
    }

    return [...list].sort((a, b) => {
      if (sortBy === "price_asc")  return (a.price ?? 0) - (b.price ?? 0);
      if (sortBy === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
      if (sortBy === "yield_desc") return (b.estYield ?? 0) - (a.estYield ?? 0);
      if (sortBy === "yield_asc")  return (a.estYield ?? 0) - (b.estYield ?? 0);
      if (sortBy === "size_desc")  return Number(b.size_sqm ?? 0) - Number(a.size_sqm ?? 0);
      if (sortBy === "size_asc")   return Number(a.size_sqm ?? 0) - Number(b.size_sqm ?? 0);
      return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime();
    });
  }, [enriched, query, market, listing, propType, state, yieldF, priceF, sizeF, minBeds, sortBy]);

  /* stats */
  const saleItems  = filtered.filter(p => p.listing_type === "sale");
  const avgYield   = saleItems.length > 0
    ? Math.round((saleItems.reduce((s, p) => s + (p.estYield ?? 0), 0) / saleItems.filter(p => p.estYield != null).length) * 10) / 10
    : null;
  const avgPrice   = saleItems.length > 0
    ? Math.round(saleItems.reduce((s, p) => s + (p.price ?? 0), 0) / saleItems.length)
    : null;

  const activeFilterCount = [
    listing !== "all", propType !== "all", state !== "ALL",
    yieldF !== "all", priceF !== "all", sizeF !== "all", minBeds > 0
  ].filter(Boolean).length;

  function clearAll() {
    setListing("all"); setPropType("all"); setState("ALL");
    setYieldF("all"); setPriceF("all"); setSizeF("all"); setMinBeds(0);
    setMarket("ALL");
  }

  /* ── pill ── */
  const pill = (active: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
        active ? C.pillActive : C.pillInactive
      }`}
    >
      {label}
    </button>
  );

  /* ── sidebar section ── */
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className={`px-4 py-4 border-b ${C.border}`}>
      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );

  /* ── sidebar content (shared between desktop sidebar and mobile drawer) ── */
  const SidebarContent = () => (
    <>
      <Section title="Market">
        <div className="flex flex-wrap gap-1.5">
          {pill(market === "ALL", () => { setMarket("ALL"); setState("ALL"); }, "All markets")}
          {pill(market === "USA", () => { setMarket("USA"); setState("ALL"); }, "🇺🇸 USA")}
          {pill(market === "UK",  () => { setMarket("UK");  setState("ALL"); }, "🇬🇧 UK")}
        </div>
      </Section>

      <Section title="Listing type">
        <div className="flex flex-wrap gap-1.5">
          {pill(listing === "all",  () => setListing("all"),  "All")}
          {pill(listing === "sale", () => setListing("sale"), "For sale")}
          {pill(listing === "rent", () => setListing("rent"), "For rent")}
        </div>
      </Section>

      <Section title="Property type">
        <div className="flex flex-wrap gap-1.5">
          {pill(propType === "all",       () => setPropType("all"),       "All types")}
          {pill(propType === "house",     () => setPropType("house"),     "House")}
          {pill(propType === "apartment", () => setPropType("apartment"), "Apartment / Flat")}
          {pill(propType === "condo",     () => setPropType("condo"),     "Condo")}
          {pill(propType === "townhouse", () => setPropType("townhouse"), "Townhouse")}
        </div>
      </Section>

      <Section title="Est. yield (for sale)">
        <div className="grid grid-cols-3 gap-1.5">
          {(["all", "4", "6", "8", "10"] as YieldF[]).map(y => (
            <button
              key={y}
              onClick={() => setYieldF(y)}
              className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                yieldF === y
                  ? "bg-green-600 text-white border-green-600"
                  : `${C.cardBg} ${C.border} text-zinc-400 hover:border-green-400 hover:text-emerald-300`
              }`}
            >
              {y === "all" ? "Any" : `${y}%+`}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Price range">
        <div className="flex flex-col gap-1.5">
          {([
            ["all",     "Any price"],
            ["u300",    "Under $300K / £200K"],
            ["300-600", "$300K – $600K"],
            ["600-1000","$600K – $1M"],
            ["1000p",   "$1M+"],
          ] as [PriceRangeF, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPriceF(val)}
              className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                priceF === val
                  ? "bg-primary text-white border-primary"
                  : `${C.cardBg} ${C.border} text-zinc-400 hover:border-primary/40 hover:text-primary`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Bedrooms">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setMinBeds(n)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                minBeds === n
                  ? C.pillActive
                  : `${C.cardBg} ${C.border} text-zinc-400 hover:border-primary/40`
              }`}
            >
              {n === 0 ? "Any" : `${n}+`}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Size">
        <div className="flex flex-col gap-1.5">
          {([
            ["all",    "Any size"],
            ["u100",   "Under 100 sqm  /  1,076 sqft"],
            ["100-200","100 – 200 sqm  /  1k – 2.2k sqft"],
            ["200-400","200 – 400 sqm  /  2.2k – 4.3k sqft"],
            ["400p",   "400 sqm+  /  4,300+ sqft"],
          ] as [SizeRangeF, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSizeF(val)}
              className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                sizeF === val
                  ? "bg-primary text-white border-primary"
                  : `${C.cardBg} ${C.border} text-zinc-400 hover:border-primary/40 hover:text-primary`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {market !== "UK" && states.length > 0 && (
        <Section title="State (US)">
          <div className="flex flex-wrap gap-1.5">
            {pill(state === "ALL", () => setState("ALL"), "All states")}
            {states.map(s => pill(state === s, () => setState(s), STATE_NAMES[s] ?? s))}
          </div>
        </Section>
      )}

      {activeFilterCount > 0 && (
        <div className="px-4 py-4">
          <button
            onClick={clearAll}
            className={`w-full text-center text-xs font-semibold text-primary py-2 rounded-lg border border-primary/30 hover:bg-primary/5 transition-colors`}
          >
            Clear all filters ({activeFilterCount})
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className={`flex rounded-2xl border ${C.border} overflow-hidden ${C.pageBg} min-h-[780px]`}>

      {/* ── Desktop sidebar ── */}
      <aside className={`hidden md:flex flex-col w-56 shrink-0 ${C.sidebarBg} border-r ${C.border} overflow-y-auto`}>
        <SidebarContent />
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Stats bar */}
        <div className={`${C.topbarBg} border-b ${C.border} px-5 py-3 flex flex-wrap items-center gap-0`}>
          <div className={`flex flex-col pr-5 mr-5 border-r ${C.border}`}>
            <span className="text-lg font-bold font-mono text-primary tabular-nums leading-none">{filtered.length.toLocaleString()}</span>
            <span className={`text-[9px] ${C.textMuted} uppercase tracking-wider mt-0.5`}>Listings</span>
          </div>
          <div className={`flex flex-col pr-5 mr-5 border-r ${C.border}`}>
            <span className={`text-lg font-bold font-mono ${C.textPrimary} tabular-nums leading-none`}>
              {filtered.filter(p => p.listing_type === "sale").length.toLocaleString()}
            </span>
            <span className={`text-[9px] ${C.textMuted} uppercase tracking-wider mt-0.5`}>For sale</span>
          </div>
          {avgYield != null && (
            <div className={`flex flex-col pr-5 mr-5 border-r ${C.border}`}>
              <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums leading-none">~{avgYield}%</span>
              <span className={`text-[9px] ${C.textMuted} uppercase tracking-wider mt-0.5`}>Avg est. yield</span>
            </div>
          )}
          {avgPrice != null && saleItems.length > 0 && (
            <div className={`flex flex-col pr-5 mr-5 border-r ${C.border}`}>
              <span className={`text-lg font-bold font-mono ${C.textPrimary} tabular-nums leading-none`}>
                {fmtPrice(avgPrice, saleItems[0].currency_code === "GBP" ? "GBP" : "USD")}
              </span>
              <span className={`text-[9px] ${C.textMuted} uppercase tracking-wider mt-0.5`}>Avg price</span>
            </div>
          )}
          {/* Sort + mobile filter */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className={`md:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${C.border} ${C.cardBg} ${C.textSecond}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
              </svg>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <span className={`text-[10px] ${C.textMuted} hidden md:block`}>Sort</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className={`text-xs rounded-lg px-3 py-1.5 border ${C.border} ${C.cardBg} ${C.textSecond} focus:outline-none focus:border-primary/50`}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Result summary */}
        <div className={`px-5 py-2 border-b ${C.borderLight} text-[10px] font-semibold ${C.textMuted} uppercase tracking-widest flex items-center gap-2`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {filtered.length.toLocaleString()} listings
          {query.trim() && (
            <button
              onClick={() => setQuery("")}
              className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[10px] font-bold text-primary bg-primary/10 border border-primary/25 rounded-full px-2.5 py-0.5 hover:bg-primary/10 transition-colors"
              title="Clear market filter"
            >
              {query.trim()} <span className="text-primary/60">✕</span>
            </button>
          )}
          {market !== "ALL" && ` · ${market === "USA" ? "United States" : "United Kingdom"}`}
          {state !== "ALL" && ` · ${STATE_NAMES[state] ?? state}`}
          {propType !== "all" && ` · ${propType}`}
          {yieldF !== "all" && ` · ${yieldF}%+ yield`}
          {priceF !== "all" && ` · price filtered`}
          {sizeF !== "all" && ` · size filtered`}
          {minBeds > 0 && ` · ${minBeds}+ beds`}
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className={`flex-1 flex flex-col items-center justify-center py-24 ${C.textMuted} text-sm gap-3`}>
            <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>No listings match these filters</span>
            <button onClick={clearAll} className="text-primary text-xs font-semibold hover:underline">Clear all filters</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(p => {
                const sym = SYM[p.currency_code] ?? "";
                const locationLabel = p.country === "UK"
                  ? getUKRegion(p.address)
                  : p.stateCode !== "—" ? `${STATE_NAMES[p.stateCode] ?? p.stateCode}, USA` : null;

                return (
                  <Link
                    key={p.id}
                    href={`/market-feed/${p.id}`}
                    className={`group ${C.cardBg} border ${C.border} rounded-xl overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-sm transition-all`}
                  >
                    {/* Property photo */}
                    {(() => {
                      const photo = (Array.isArray(p.images) ? p.images : []).find(
                        (img) => typeof img === "string" && img.startsWith("http")
                      );
                      return photo ? (
                        <div className="relative h-36 w-full bg-secondary overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo}
                            alt={getLocationSummary(p.address, p.country)}
                            loading="lazy"
                            className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                          <span className="absolute bottom-2 left-2 text-[8px] font-bold uppercase tracking-widest text-white/90 bg-black/45 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            Prime Atlas
                          </span>
                        </div>
                      ) : null;
                    })()}

                    <div className="p-4 flex flex-col gap-3">
                    {/* Top row: badges + time */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        p.listing_type === "sale" ? "text-emerald-400 bg-emerald-500/15" : "text-primary bg-primary/15"
                      }`}>
                        {p.listing_type === "sale" ? "For sale" : "For rent"}
                      </span>
                      <span className="text-[9px] font-semibold text-zinc-500 bg-secondary px-2 py-0.5 rounded">
                        {p.country === "UK" ? "🇬🇧 UK" : "🇺🇸 USA"}
                      </span>
                      {p.propBucket !== "other" && (
                        <span className="text-[9px] capitalize text-zinc-500 border border-border rounded px-1.5 py-0.5 bg-secondary">
                          {p.propBucket}
                        </span>
                      )}
                      <span className={`text-[9px] ${C.textMuted} ml-auto`}>{timeAgo(p.scraped_at)}</span>
                    </div>

                    {/* Price + yield */}
                    <div className="flex items-end justify-between gap-2">
                      <p className={`text-[26px] font-bold ${C.textPrimary} leading-none tabular-nums tracking-tight`}>
                        {fmtPrice(p.price ?? 0, p.currency_code)}
                        {p.listing_type === "rent" && (
                          <span className="text-sm font-normal text-zinc-500 ml-1">/mo</span>
                        )}
                      </p>
                      {p.estYield != null && (
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border mb-0.5 ${
                          p.estYield >= 8 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" :
                          p.estYield >= 6 ? "text-primary bg-primary/10 border-primary/20" :
                          "text-amber-400 bg-amber-500/10 border-amber-500/25"
                        }`}>
                          ~{p.estYield}%
                        </span>
                      )}
                    </div>

                    {/* Location — city/state only, no street address */}
                    <div>
                      <p className={`text-sm font-semibold ${C.textPrimary} leading-snug`}>
                        {getLocationSummary(p.address, p.country)}
                      </p>
                      <p className={`text-[9px] ${C.textMuted} mt-0.5 uppercase tracking-widest flex items-center gap-1`}>
                        <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                            d="M12 11c0 3-5 8-5 8s-5-5-5-8a5 5 0 0110 0z M12 11a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                        Full address · members only
                      </p>
                    </div>

                    {/* Specs */}
                    <div className={`flex flex-wrap gap-3 text-xs ${C.textMuted} items-center pt-2.5 border-t ${C.borderLight}`}>
                      {p.bedrooms  != null && <span><span className={`font-semibold ${C.textPrimary}`}>{p.bedrooms}</span> bd</span>}
                      {p.bathrooms != null && <span><span className={`font-semibold ${C.textPrimary}`}>{p.bathrooms}</span> ba</span>}
                      {p.size_sqm  != null && (
                        <span>
                          <span className={`font-semibold ${C.textPrimary}`}>{Number(p.size_sqm).toLocaleString()}</span> sqm
                          <span className="text-zinc-600 mx-1">·</span>
                          <span className={`font-semibold ${C.textPrimary}`}>{p.sqft?.toLocaleString()}</span> sqft
                        </span>
                      )}
                      {p.price != null && p.size_sqm != null && p.listing_type === "sale" && (
                        <span className="text-primary font-semibold">
                          {sym}{Math.round((p.price / 100) / Number(p.size_sqm)).toLocaleString()}/sqm
                        </span>
                      )}
                      <span className="ml-auto text-primary font-semibold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        Analyse →
                      </span>
                    </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      <FilterDrawer open={mobileFiltersOpen} onClose={closeMobile} title="Filters">
        <SidebarContent />
      </FilterDrawer>
    </div>
  );
}
