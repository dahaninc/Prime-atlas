"use client";

import { useState, useMemo } from "react";

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

/* ─── state pills ────────────────────────────────────────────────── */

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

  const pillBase = "px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer";
  const pillActive = "bg-pa-green text-pa-navy border-pa-green";
  const pillInactive = "text-muted-foreground border-border hover:border-pa-green/50 hover:text-foreground";

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">

        {/* Type */}
        <div className="flex gap-1.5">
          {(["all", "sale", "rent"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`${pillBase} ${typeFilter === t ? pillActive : pillInactive}`}>
              {t === "all" ? "All" : t === "sale" ? "For Sale" : "For Rent"}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* State */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStateFilter("ALL")}
            className={`${pillBase} ${stateFilter === "ALL" ? pillActive : pillInactive}`}>
            All States
          </button>
          {availableStates.map(s => (
            <button key={s} onClick={() => setStateFilter(s)}
              className={`${pillBase} ${stateFilter === s ? pillActive : pillInactive}`}>
              {US_STATES[s] ?? s}
            </button>
          ))}
        </div>

        {/* Sort — pushed right */}
        <div className="ml-auto flex items-center gap-2">
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
    </div>
  );
}
