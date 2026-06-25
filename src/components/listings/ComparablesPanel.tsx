"use client";

import { useState, useEffect } from "react";

/* ─── types ──────────────────────────────────────────────────────── */

interface Comparable {
  address: string;
  price: number;
  currency?: string;
  date: string;
  type?: string;
  sqm?: number;
  source: string;
  source_label?: string;
  distance_m?: number;
}

interface Props {
  postcode?: string | null;
  /** JSONB comparables seeded for non-UK listings */
  seeded?: Comparable[] | null;
  askingPrice: number;
  currency: string;
}

/* ─── helpers ────────────────────────────────────────────────────── */

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", AUD: "A$", CAD: "C$",
};

function fmt(price: number, currency = "GBP") {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const n = price;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${sym}${(n / 1_000).toFixed(0)}K`;
  return `${sym}${n.toLocaleString()}`;
}

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function Verdict({ avg, asking, currency }: { avg: number; asking: number; currency: string }) {
  if (!avg || !asking) return null;
  const pct = ((asking - avg) / avg) * 100;
  const abs = Math.abs(pct);

  let label: string;
  let cls: string;

  if (pct < -10) {
    label = `${abs.toFixed(1)}% below comparable sales — potential value`;
    cls = "text-pa-green";
  } else if (pct > 15) {
    label = `${abs.toFixed(1)}% above comparable sales — premium pricing`;
    cls = "text-red-400";
  } else {
    label = `Within ${abs.toFixed(1)}% of comparable sales — fair market`;
    cls = "text-pa-amber";
  }

  return (
    <p className={`text-xs font-semibold mt-2 ${cls}`}>
      ▸ {label}
    </p>
  );
}

/* ─── component ─────────────────────────────────────────────────── */

export function ComparablesPanel({ postcode, seeded, askingPrice, currency }: Props) {
  const [comparables, setComparables] = useState<Comparable[]>(seeded ?? []);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<string>(seeded?.length ? "seeded" : "none");

  const isUK = !!postcode;

  useEffect(() => {
    if (!isUK || !postcode) {
      // Use seeded comparables for non-UK
      if (seeded?.length) {
        setComparables(seeded);
        setSource("seeded");
      }
      return;
    }

    // UK: fetch live from Land Registry proxy
    setLoading(true);
    const encoded = postcode.trim().replace(/\s+/g, "-");
    fetch(`/api/comparables/${encoded}`)
      .then(r => r.json())
      .then(data => {
        if (data?.comparables?.length) {
          setComparables(data.comparables);
          setSource("land_registry");
        } else if (seeded?.length) {
          setComparables(seeded);
          setSource("seeded");
        }
      })
      .catch(() => {
        if (seeded?.length) {
          setComparables(seeded);
          setSource("seeded");
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postcode]);

  if (!comparables.length && !loading) return null;

  // Only use price comps (source=land_registry or type includes "sold")
  const priceComps = comparables.filter(c =>
    c.source === "land_registry" || c.type?.toLowerCase().includes("sold")
  );
  const avg = priceComps.length
    ? priceComps.reduce((s, c) => s + c.price, 0) / priceComps.length
    : 0;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Comparable Evidence
        </h2>
        {source === "land_registry" && (
          <span className="text-[9px] text-pa-green border border-pa-green/30 rounded px-1.5 py-0.5 font-semibold">
            🇬🇧 Land Registry — Live
          </span>
        )}
        {source === "seeded" && (
          <span className="text-[9px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Curated comparables
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <span className="w-3 h-3 rounded-full border-2 border-pa-green border-t-transparent animate-spin" />
          Fetching Land Registry sold prices…
        </div>
      ) : (
        <>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {comparables.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-card text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{c.address}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {c.type && <>{c.type} · </>}
                    {fmtDate(c.date)}
                    {c.distance_m && <> · {c.distance_m}m away</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold font-mono text-sm text-foreground">
                    {fmt(c.price, c.currency ?? currency)}
                  </p>
                  {c.sqm && (
                    <p className="text-muted-foreground">
                      {fmt(Math.round(c.price / c.sqm), c.currency ?? currency)}/sqm
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {avg > 0 && (
            <div className="mt-3 px-4 py-3 border border-border rounded-xl bg-card">
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">Average comparable price</span>
                <span className="font-bold font-mono">{fmt(avg, currency)}</span>
              </div>
              <Verdict avg={avg} asking={askingPrice / 100} currency={currency} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
