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
  municipalities?: {
    name: string; slug: string; country: string;
    opportunity_score: number; growth_score: number; risk_score: number;
  } | null;
}

/* ─── helpers ────────────────────────────────────────────────────── */

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", AUD: "A$", CAD: "C$",
};

const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
  "Australia": "🇦🇺",
  "Canada": "🇨🇦",
  "Spain": "🇪🇸",
};

const TYPE_LABEL: Record<string, string> = {
  "residential": "RESI",
  "commercial": "COMM",
  "land": "LAND",
  "mixed-use": "MIXD",
  "development-site": "DEV",
  "industrial": "INDS",
  "pbsa": "PBSA",
};

function fmtPrice(pence: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const n = pence / 100;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${sym}${(n / 1_000).toFixed(0)}K`;
  return `${sym}${n.toLocaleString()}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function capRate(l: FullListing): number | null {
  if (l.gross_yield_pct) return Number(l.gross_yield_pct);
  if (l.annual_income && l.asking_price)
    return Math.round(((l.annual_income / (l.asking_price / 100)) * 100) * 10) / 10;
  return null;
}

function yieldColor(y: number | null): string {
  if (y === null) return "text-muted-foreground";
  if (y >= 6) return "text-pa-green";
  if (y >= 4) return "text-yellow-400";
  return "text-red-400";
}

function yieldDisplay(y: number | null): string {
  if (y === null) return "—";
  const sign = y >= 6 ? "+" : y < 4 ? "−" : "";
  return `${sign}${y.toFixed(1)}%`;
}

function roiColor(score: number): string {
  if (score >= 70) return "text-pa-green";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

/* ─── command chip ───────────────────────────────────────────────── */

function CommandChip({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded transition-all border ${
        active
          ? "bg-pa-green text-pa-navy border-pa-green shadow-[0_0_8px_rgba(0,200,100,0.25)]"
          : "border-border text-muted-foreground hover:border-pa-green/40 hover:text-foreground bg-transparent"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── stats ticker ───────────────────────────────────────────────── */

function StatsTicker({ listings, filtered }: { listings: FullListing[]; filtered: FullListing[] }) {
  const withYield = filtered.filter(l => l.gross_yield_pct);
  const avgYield = withYield.length
    ? (withYield.reduce((s, l) => s + Number(l.gross_yield_pct), 0) / withYield.length).toFixed(1)
    : null;

  const usCnt = listings.filter(l => l.municipalities?.country === "United States").length;
  const ukCnt = listings.filter(l => l.municipalities?.country === "United Kingdom").length;
  const unknownCnt = listings.filter(l => !l.municipalities).length;

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-secondary/20 border-b border-border font-mono text-[10px] text-muted-foreground overflow-x-auto shrink-0">
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-pa-green animate-pulse" />
        <span className="text-foreground font-bold">{filtered.length}</span>&nbsp;MATCHES
      </span>
      <span className="shrink-0">
        <span className="text-foreground font-bold">{listings.length}</span>&nbsp;TOTAL
      </span>
      {usCnt > 0 && (
        <span className="shrink-0">🇺🇸&nbsp;<span className="text-foreground font-bold">{usCnt}</span></span>
      )}
      {ukCnt > 0 && (
        <span className="shrink-0">🇬🇧&nbsp;<span className="text-foreground font-bold">{ukCnt}</span></span>
      )}
      {unknownCnt > 0 && (
        <span className="shrink-0">OTHER&nbsp;<span className="text-foreground font-bold">{unknownCnt}</span></span>
      )}
      {avgYield && (
        <span className="shrink-0">
          AVG YIELD&nbsp;
          <span className={`font-bold ${Number(avgYield) >= 5 ? "text-pa-green" : "text-yellow-400"}`}>
            {avgYield}%
          </span>
        </span>
      )}
      <span className="ml-auto shrink-0 text-muted-foreground/40">
        PRIME ATLAS TERMINAL · LIVE
      </span>
    </div>
  );
}

/* ─── table row ──────────────────────────────────────────────────── */

function ListingRow({ listing, index }: { listing: FullListing; index: number }) {
  const muni = listing.municipalities;
  const cap = capRate(listing);
  const typeLabel = TYPE_LABEL[listing.listing_type] ?? listing.listing_type.toUpperCase().slice(0, 4);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex items-center hover:bg-pa-green/[0.04] border-b border-border/40 transition-colors"
    >
      {/* Row # */}
      <div className="w-9 shrink-0 px-2 py-2.5 text-[10px] font-mono text-muted-foreground/30 text-right select-none">
        {index + 1}
      </div>

      {/* Featured dot */}
      <div className="w-4 shrink-0 flex items-center justify-center">
        {listing.featured && (
          <span className="w-1.5 h-1.5 rounded-full bg-pa-green shadow-[0_0_4px_rgba(0,200,100,0.6)]" />
        )}
      </div>

      {/* Asset title + address */}
      <div className="flex-1 min-w-0 px-2 py-2.5">
        <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-1 group-hover:text-pa-green transition-colors">
          {listing.title}
        </p>
        <p className="text-[9px] text-muted-foreground/50 leading-tight mt-0.5 line-clamp-1">
          {listing.address}
        </p>
      </div>

      {/* Market */}
      <div className="w-24 shrink-0 px-2 py-2.5 hidden sm:block">
        {muni ? (
          <p className="text-[10px] font-mono text-foreground/70 truncate">
            {COUNTRY_FLAG[muni.country] ?? ""}&nbsp;{muni.name}
          </p>
        ) : (
          <span className="text-[10px] text-muted-foreground/30">—</span>
        )}
      </div>

      {/* Type */}
      <div className="w-14 shrink-0 px-2 py-2.5 hidden md:block">
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground/60 bg-secondary/30">
          {typeLabel}
        </span>
      </div>

      {/* Price */}
      <div className="w-24 shrink-0 px-2 py-2.5 text-right">
        <span className="text-[11px] font-mono font-bold text-foreground">
          {fmtPrice(listing.asking_price, listing.currency_code)}
        </span>
      </div>

      {/* Beds */}
      <div className="w-10 shrink-0 px-1 py-2.5 text-center hidden lg:block">
        <span className="text-[10px] font-mono text-muted-foreground">
          {listing.bedrooms ?? "—"}
        </span>
      </div>

      {/* SQM */}
      <div className="w-16 shrink-0 px-2 py-2.5 text-right hidden lg:block">
        <span className="text-[10px] font-mono text-muted-foreground">
          {listing.size_sqm ? Number(listing.size_sqm).toLocaleString() : "—"}
        </span>
      </div>

      {/* Yield / Cap Rate */}
      <div className="w-16 shrink-0 px-2 py-2.5 text-right hidden md:block">
        <span className={`text-[11px] font-mono font-bold ${yieldColor(cap)}`}>
          {yieldDisplay(cap)}
        </span>
      </div>

      {/* ROI Score */}
      <div className="w-12 shrink-0 px-2 py-2.5 text-right hidden xl:block">
        {muni ? (
          <span className={`text-[11px] font-mono font-bold ${roiColor(muni.opportunity_score)}`}>
            {muni.opportunity_score}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/30">—</span>
        )}
      </div>

      {/* Date listed */}
      <div className="w-20 shrink-0 px-2 py-2.5 text-right hidden xl:block">
        <span className="text-[9px] font-mono text-muted-foreground/40">
          {fmtDate(listing.date_listed)}
        </span>
      </div>

      {/* Status */}
      <div className="w-20 shrink-0 px-2 py-2.5 text-right">
        {listing.status === "under_offer" ? (
          <span className="text-[8px] font-mono font-bold text-pa-amber border border-pa-amber/30 rounded px-1.5 py-0.5 bg-pa-amber/5">
            OFFER
          </span>
        ) : (
          <span className="text-[8px] font-mono font-bold text-pa-green/50 border border-pa-green/20 rounded px-1.5 py-0.5">
            LIVE
          </span>
        )}
      </div>

      {/* Arrow */}
      <div className="w-6 shrink-0 flex items-center justify-center pr-1">
        <span className="text-[10px] text-muted-foreground/20 group-hover:text-pa-green transition-colors">›</span>
      </div>
    </Link>
  );
}

/* ─── main explorer ──────────────────────────────────────────────── */

type Market = "all" | "US" | "UK";
type AssetClass = "all" | "residential" | "commercial" | "land" | "development-site" | "industrial";
type SortKey = "price_asc" | "price_desc" | "yield_desc" | "date_desc" | "roi_desc";

export function ListingsExplorer({ listings }: { listings: FullListing[] }) {
  const [market, setMarket] = useState<Market>("all");
  const [assetClass, setAssetClass] = useState<AssetClass>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");

  const MARKET_OPTIONS: { key: Market; label: string }[] = [
    { key: "all", label: "ALL MKTS" },
    { key: "US",  label: "🇺🇸 USA" },
    { key: "UK",  label: "🇬🇧 UK" },
  ];

  const ASSET_OPTIONS: { key: AssetClass; label: string }[] = [
    { key: "all",              label: "ALL" },
    { key: "residential",      label: "RESI" },
    { key: "commercial",       label: "COMM" },
    { key: "land",             label: "LAND" },
    { key: "development-site", label: "DEV" },
    { key: "industrial",       label: "INDS" },
  ];

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "date_desc",  label: "NEWEST" },
    { key: "price_asc",  label: "PRICE ↑" },
    { key: "price_desc", label: "PRICE ↓" },
    { key: "yield_desc", label: "YIELD ↓" },
    { key: "roi_desc",   label: "ROI ↓" },
  ];

  const filtered = useMemo(() => {
    let out = [...listings];

    if (market === "US") out = out.filter(l => l.municipalities?.country === "United States");
    if (market === "UK") out = out.filter(l => l.municipalities?.country === "United Kingdom");
    if (assetClass !== "all") out = out.filter(l => l.listing_type === assetClass);

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

    // Featured always float to top
    out.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

    return out;
  }, [listings, market, assetClass, sortKey]);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">

      {/* ── Terminal title bar ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-pa-green/50" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50 ml-2">
          prime-atlas · LIVE LISTINGS TERMINAL
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-pa-green">
          <span className="w-1.5 h-1.5 rounded-full bg-pa-green animate-pulse" />
          LIVE
        </span>
      </div>

      {/* ── Command bar ── */}
      <div className="px-4 py-3 border-b border-border bg-secondary/10">
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold text-muted-foreground/40 uppercase tracking-widest shrink-0">
              MARKETS
            </span>
            <div className="flex gap-1">
              {MARKET_OPTIONS.map(o => (
                <CommandChip key={o.key} active={market === o.key} label={o.label} onClick={() => setMarket(o.key)} />
              ))}
            </div>
          </div>

          <span className="text-muted-foreground/20 font-mono hidden sm:block">›</span>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold text-muted-foreground/40 uppercase tracking-widest shrink-0">
              CLASS
            </span>
            <div className="flex gap-1 flex-wrap">
              {ASSET_OPTIONS.map(o => (
                <CommandChip key={o.key} active={assetClass === o.key} label={o.label} onClick={() => setAssetClass(o.key)} />
              ))}
            </div>
          </div>

          <span className="text-muted-foreground/20 font-mono hidden sm:block">›</span>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold text-muted-foreground/40 uppercase tracking-widest shrink-0">
              SORT
            </span>
            <div className="flex gap-1 flex-wrap">
              {SORT_OPTIONS.map(o => (
                <CommandChip key={o.key} active={sortKey === o.key} label={o.label} onClick={() => setSortKey(o.key)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ticker ── */}
      <StatsTicker listings={listings} filtered={filtered} />

      {/* ── Table column headers ── */}
      <div className="flex items-center bg-secondary/30 border-b border-border/60">
        <div className="w-9 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/30 text-right">#</div>
        <div className="w-4 shrink-0" />
        <div className="flex-1 min-w-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest">ASSET</div>
        <div className="w-24 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest hidden sm:block">MARKET</div>
        <div className="w-14 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest hidden md:block">TYPE</div>
        <div className="w-24 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest text-right">PRICE</div>
        <div className="w-10 shrink-0 px-1 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest text-center hidden lg:block">BED</div>
        <div className="w-16 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest text-right hidden lg:block">SQM</div>
        <div className="w-16 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest text-right hidden md:block">YIELD</div>
        <div className="w-12 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest text-right hidden xl:block">ROI</div>
        <div className="w-20 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest text-right hidden xl:block">LISTED</div>
        <div className="w-20 shrink-0 px-2 py-1.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest text-right">STATUS</div>
        <div className="w-6 shrink-0" />
      </div>

      {/* ── Rows ── */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)", minHeight: "320px" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="font-mono text-[11px] text-muted-foreground">NO LISTINGS MATCH CURRENT FILTER</p>
            <p className="text-[10px] text-muted-foreground/40">Adjust market or asset class above</p>
          </div>
        ) : (
          filtered.map((l, i) => <ListingRow key={l.id} listing={l} index={i} />)
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-secondary/20">
        <p className="text-[9px] font-mono text-muted-foreground/30">
          DATA: ZILLOW · RIGHTMOVE · ONTHEMARKET · REFRESHED DAILY
        </p>
        <a
          href="mailto:deals@prime-atlas.com?subject=Submit a listing"
          className="text-[9px] font-mono text-pa-green/50 hover:text-pa-green transition-colors"
        >
          + SUBMIT LISTING
        </a>
      </div>
    </div>
  );
}
