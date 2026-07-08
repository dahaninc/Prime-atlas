"use client";

/**
 * All-Markets deal explorer — Deal Board's cross-market view mode.
 *
 * Relocated 2026-07-09 from the standalone /underpriced page (now a
 * redirect into Deal Board's "All Markets" toggle — see
 * src/app/underpriced/page.tsx and the surface-consolidation audit).
 * Unchanged behavior: free-text search (address/ZIP), market / property-type
 * / bedrooms / price / discount filters, sorting, and multi-select →
 * one-click Deal Brochure export (POST /api/export/deal-brochure,
 * Professional+, server-gated — the button here is convenience, not the
 * boundary).
 *
 * Every deal in `deals` already passed the ZIP-comp mispricing screen
 * server-side (src/lib/comps.ts via the page's fetchZipCompScreens call) —
 * this component only filters/sorts what the honest basis produced; it
 * never recomputes or relaxes the screen.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmt, symFor } from "@/lib/money";
import { toast } from "@/components/ui/Toaster";

export interface ExplorerDeal {
  id: string;
  address: string | null;
  price: number;            // minor units
  ppsqm: number;            // minor units per sqm
  bedrooms: number | null;
  property_type: string | null;
  size_sqm: number | null;
  image: string | null;
  marketId: string;
  marketName: string;
  currency: string;
  discountPct: number;
  compCount: number;
  basisLabel: string | null;
  grossYieldPct: number | null; // null = insufficient rent comps for that market
}

interface Props {
  deals: ExplorerDeal[];
  markets: { id: string; name: string }[];
  canBrochure: boolean;      // Professional+ — server enforces regardless
  isTeaser: boolean;         // Explorer tier: capped list, upsell instead of export
  lockedCount: number;       // deals beyond the teaser cap
}

type SortKey = "discount" | "price_asc" | "price_desc" | "yield" | "ppsqm";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "discount", label: "Deepest discount" },
  { key: "yield", label: "Gross yield" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "ppsqm", label: "$/sqm ↑" },
];

export function AllMarketsExplorer({ deals, markets, canBrochure, isTeaser, lockedCount }: Props) {
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("all");
  const [ptype, setPtype] = useState("all");
  const [minBeds, setMinBeds] = useState(0);
  const [maxPriceK, setMaxPriceK] = useState("");   // major units, thousands
  const [minDiscount, setMinDiscount] = useState(15);
  const [sort, setSort] = useState<SortKey>("discount");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const propertyTypes = useMemo(
    () => Array.from(new Set(deals.map((d) => d.property_type).filter(Boolean))).sort() as string[],
    [deals],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const maxMinor = maxPriceK ? Number(maxPriceK) * 1000 * 100 : null;
    const out = deals.filter((d) => {
      if (q && !(d.address ?? "").toLowerCase().includes(q) && !d.marketName.toLowerCase().includes(q)) return false;
      if (market !== "all" && d.marketId !== market) return false;
      if (ptype !== "all" && d.property_type !== ptype) return false;
      if (minBeds > 0 && (d.bedrooms ?? 0) < minBeds) return false;
      if (maxMinor != null && d.price > maxMinor) return false;
      if (d.discountPct < minDiscount) return false;
      return true;
    });
    const by: Record<SortKey, (a: ExplorerDeal, b: ExplorerDeal) => number> = {
      discount:   (a, b) => b.discountPct - a.discountPct,
      yield:      (a, b) => (b.grossYieldPct ?? -1) - (a.grossYieldPct ?? -1),
      price_asc:  (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      ppsqm:      (a, b) => a.ppsqm - b.ppsqm,
    };
    return [...out].sort(by[sort]);
  }, [deals, query, market, ptype, minBeds, maxPriceK, minDiscount, sort]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size >= 12) { toast("Brochure holds up to 12 properties", "error"); return prev; }
      else next.add(id);
      return next;
    });
  }

  async function exportBrochure() {
    if (!selected.size || exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/deal-brochure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyIds: Array.from(selected) }),
      });
      if (res.status === 403) {
        toast("Deal Brochure export is a Professional feature — upgrade to unlock", "error");
        return;
      }
      if (!res.ok) {
        toast("Brochure export failed — try again", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "prime-atlas-deal-brochure.doc";
      a.click(); URL.revokeObjectURL(url);
      toast(`Deal Brochure exported — ${selected.size} propert${selected.size === 1 ? "y" : "ies"}, Word-editable .doc`);
    } finally {
      setExporting(false);
    }
  }

  const inputCls = "bg-[#111827] border border-[#1E2D40] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2A5C96]";

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address, ZIP, or market…"
          className={`${inputCls} w-56`}
        />
        <select value={market} onChange={(e) => setMarket(e.target.value)} className={inputCls}>
          <option value="all">All markets</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={ptype} onChange={(e) => setPtype(e.target.value)} className={inputCls}>
          <option value="all">All types</option>
          {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={minBeds} onChange={(e) => setMinBeds(Number(e.target.value))} className={inputCls}>
          <option value={0}>Any beds</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ beds</option>)}
        </select>
        <input
          value={maxPriceK}
          onChange={(e) => setMaxPriceK(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Max price ($K)"
          className={`${inputCls} w-28`}
          inputMode="numeric"
        />
        <select value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} className={inputCls}>
          {[15, 20, 25, 30, 40].map((n) => <option key={n} value={n}>≥{n}% below comps</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${inputCls} ml-auto`}>
          {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
        </select>
      </div>

      <p className="text-xs font-mono text-[#4A6080] mb-4">
        {filtered.length} of {deals.length} flagged deals match your criteria
      </p>

      {/* Deal grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {filtered.map((d) => {
          const sym = symFor(d.currency);
          const isSel = selected.has(d.id);
          return (
            <div
              key={d.id}
              className={`group relative border rounded-xl bg-[#111827] overflow-hidden transition-colors ${
                isSel ? "border-primary" : "border-[#1E2D40] hover:border-[#2A5C96]"
              }`}
            >
              <button
                onClick={() => toggle(d.id)}
                aria-pressed={isSel}
                title={isSel ? "Remove from brochure" : "Add to brochure"}
                className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-md border text-sm font-bold transition-colors ${
                  isSel
                    ? "bg-primary border-primary text-white"
                    : "bg-[#0D1624]/70 backdrop-blur-sm border-[#1E2D40] text-zinc-400 hover:border-primary/50 hover:text-white"
                }`}
              >
                {isSel ? "✓" : "+"}
              </button>
              <Link href={`/market-feed/${d.id}`} className="block">
                <div className="relative h-40 bg-[#0D1624] overflow-hidden">
                  {d.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  )}
                  <span className="absolute top-2 left-2 text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5">
                    −{Math.round(d.discountPct)}% vs {d.compCount} ZIP comps
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-[10px] text-[#4A6080] font-mono uppercase tracking-wider mb-1">🇺🇸 {d.marketName}</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-white">
                    {fmt(d.price / 100, sym)}
                    <span className="text-xs text-[#4A6080] font-normal ml-2">{fmt(d.ppsqm / 100, sym)}/sqm</span>
                  </p>
                  <p className="text-xs mt-1 truncate text-[#6A8098]">{d.address ?? "Address on file"}</p>
                  <p className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                    {d.bedrooms ? `${d.bedrooms} bed · ` : ""}{d.property_type ?? "Residential"}{d.size_sqm ? ` · ${Math.round(d.size_sqm)} sqm` : ""}
                    {d.grossYieldPct != null ? ` · ${d.grossYieldPct.toFixed(1)}% gross yield` : ""}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="border border-[#1E2D40] rounded-xl bg-[#111827] px-6 py-10 text-center mb-8">
          <p className="text-sm font-semibold mb-1 text-white">No flagged deals match these criteria</p>
          <p className="text-xs text-[#4A6080] max-w-md mx-auto">
            Every deal here must sit 15–60% below its own ZIP-level comparable basis — widen a filter, or check
            back as new listings are screened on each scrape.
          </p>
        </div>
      )}

      {isTeaser && lockedCount > 0 && (
        <div className="border border-[#1E2D40] rounded-xl bg-[#111827] px-6 py-8 text-center mb-8">
          <p className="text-sm font-semibold mb-1 text-white">{lockedCount} more flagged deal{lockedCount === 1 ? "" : "s"} beyond your Explorer preview</p>
          <p className="text-xs text-[#4A6080] max-w-md mx-auto mb-4">
            Professional unlocks the full feed, every covered market, filters over the whole pool, and the
            multi-property Deal Brochure export.
          </p>
          <Link href="/pricing" className="inline-block bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors">
            Upgrade to Professional →
          </Link>
        </div>
      )}

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20">
          <div className="max-w-xl mx-auto flex items-center gap-4 border border-primary/40 bg-[#0D1221]/90 backdrop-blur-md rounded-2xl px-5 py-3 shadow-lg">
            <p className="text-xs font-mono text-white">
              <span className="font-bold">{selected.size}</span>/12 selected
            </p>
            <button onClick={() => setSelected(new Set())} className="text-xs text-zinc-400 hover:text-white transition-colors">
              Clear
            </button>
            {canBrochure ? (
              <button
                onClick={exportBrochure}
                disabled={exporting}
                className="ml-auto bg-primary text-white text-xs font-semibold px-5 py-2 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-60"
              >
                {exporting ? "Building…" : "Generate Deal Brochure →"}
              </button>
            ) : (
              <Link href="/pricing" className="ml-auto border border-primary/40 text-primary text-xs font-semibold px-5 py-2 rounded-lg hover:bg-primary/10 transition-colors">
                Brochure export — Professional →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
