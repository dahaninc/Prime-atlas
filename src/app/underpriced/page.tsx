import { createPublicClient } from "@/lib/supabase/public";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// Public acquisition surface — ISR, CDN-cached, refreshed hourly.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Underpriced Property Deals — Live | Prime Atlas",
  description:
    "Live listings priced ≥15% below their market's median per-sqm across USA and UK markets. Computed daily from scraped market data — the mispricing feed institutional buyers act on.",
};

const SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

interface StatRow {
  municipality_id: string;
  sale_count: number;
  underpriced_count: number;
  median_ppsqm: string | null;
}
interface Muni {
  id: string; name: string; region: string; country: string; slug: string;
  currency_code: string | null;
}
interface Prop {
  id: string; address: string | null; price: number | null; size_sqm: number | null;
  bedrooms: number | null; property_type: string | null; currency_code: string;
  images: string[] | null; municipality_id: string;
}

function money(minor: number, sym: string): string {
  const v = minor / 100;
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${sym}${Math.round(v / 1_000)}K`;
  return `${sym}${Math.round(v)}`;
}

export default async function UnderpricedPage() {
  const supabase = createPublicClient();

  const [{ data: stats }, { data: munis }] = await Promise.all([
    supabase
      .from("market_listing_stats")
      .select("municipality_id, sale_count, underpriced_count, median_ppsqm")
      .gt("underpriced_count", 0)
      .not("median_ppsqm", "is", null),
    supabase
      .from("municipalities")
      .select("id, name, region, country, slug, currency_code")
      .in("country", ["United Kingdom", "United States"]),
  ]);

  const muniMap = new Map((munis ?? []).map((m) => [m.id, m as Muni]));
  const ranked = ((stats ?? []) as StatRow[])
    .filter((s) => muniMap.has(s.municipality_id))
    .sort((a, b) => b.underpriced_count - a.underpriced_count)
    .slice(0, 8);

  const { data: rawProps } = await supabase
    .from("properties")
    .select("id, address, price, size_sqm, bedrooms, property_type, currency_code, images, municipality_id")
    .in("municipality_id", ranked.map((r) => r.municipality_id))
    .eq("status", "active")
    .eq("listing_type", "sale")
    .not("price", "is", null)
    .not("size_sqm", "is", null)
    .gt("size_sqm", 15)
    .limit(3000);

  const byMarket = new Map<string, (Prop & { discount: number; ppsqm: number })[]>();
  for (const s of ranked) {
    const median = Number(s.median_ppsqm);
    if (!isFinite(median) || median <= 0) continue;
    const deals = ((rawProps ?? []) as Prop[])
      .filter((p) => p.municipality_id === s.municipality_id && p.price! > 0 && p.size_sqm! > 0)
      .map((p) => {
        const ppsqm = p.price! / p.size_sqm!;
        return { ...p, ppsqm, discount: 1 - ppsqm / median };
      })
      .filter((p) => p.discount >= 0.15 && p.discount <= 0.75)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 6);
    if (deals.length) byMarket.set(s.municipality_id, deals);
  }

  const totalDeals = Array.from(byMarket.values()).reduce((n, d) => n + d.length, 0);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <span>Underpriced</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-pa-amber animate-pulse" />
            <span className="kicker text-pa-amber">Mispricing detector · updated {today}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">The Underpriced Feed</h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
            Listings priced <span className="text-foreground font-semibold">15% or more below their market&apos;s
            median per-sqm</span> — recomputed from live scraped data across USA and UK markets.
            This is the spread institutional buyers move on before it closes.
          </p>
          <div className="flex items-center gap-5 mt-5 text-xs font-mono text-muted-foreground">
            <span><span className="text-foreground font-bold">{totalDeals}</span> flagged deals</span>
            <span><span className="text-foreground font-bold">{byMarket.size}</span> markets</span>
            <span className="flex items-center gap-1.5"><span className="status-dot-live" /> live data</span>
          </div>
        </div>

        {/* Market sections */}
        <div className="space-y-12">
          {ranked.filter((s) => byMarket.has(s.municipality_id)).map((s) => {
            const m = muniMap.get(s.municipality_id)!;
            const deals = byMarket.get(s.municipality_id)!;
            const sym = SYM[m.currency_code ?? "USD"] ?? "$";
            const median = Number(s.median_ppsqm);
            return (
              <section key={s.municipality_id}>
                <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold">
                      {m.country === "United Kingdom" ? "🇬🇧" : "🇺🇸"} {m.name}
                      <span className="text-muted-foreground font-normal text-sm ml-2">{m.region}</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      market median {money(median, sym)}/sqm · {s.underpriced_count} listings flagged
                    </p>
                  </div>
                  <Link href={`/opportunities/${m.slug}`} className="text-xs text-primary hover:underline shrink-0">
                    Full market analysis →
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deals.map((d, i) => {
                    const locked = i >= 2; // first 2 per market free — rest for members
                    return (
                      <Link
                        key={d.id}
                        href={locked ? "/auth/signup" : `/market-feed/${d.id}`}
                        className="group border border-border rounded-xl bg-card overflow-hidden hover:border-primary/40 transition-colors"
                      >
                        <div className="relative h-40 bg-secondary overflow-hidden">
                          {d.images?.[0] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={d.images[0]}
                              alt=""
                              className={`w-full h-full object-cover ${locked ? "blur-[6px] scale-105" : ""} group-hover:scale-105 transition-transform duration-300`}
                              loading="lazy"
                            />
                          )}
                          <span className="absolute top-2 left-2 text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5">
                            −{Math.round(d.discount * 100)}% vs median
                          </span>
                          {locked && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[11px] font-semibold bg-primary text-white rounded-lg px-3 py-1.5 shadow-lg">
                                Members only — unlock free
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="text-lg font-bold font-mono tabular-nums">
                            {money(d.price!, sym)}
                            <span className="text-xs text-muted-foreground font-normal ml-2">
                              {money(d.ppsqm, sym)}/sqm
                            </span>
                          </p>
                          <p className={`text-xs mt-1 truncate ${locked ? "blur-sm select-none" : "text-muted-foreground"}`}>
                            {locked ? "Address available to members" : (d.address ?? "Address on file")}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                            {d.bedrooms ? `${d.bedrooms} bed · ` : ""}{d.property_type ?? "Residential"} · {Math.round(d.size_sqm!)} sqm
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Conversion banner */}
        <div className="mt-16 border border-primary/25 bg-primary/10 rounded-2xl p-8 sm:p-10 text-center">
          <p className="kicker mb-3">Prime Atlas membership</p>
          <h2 className="text-2xl font-bold mb-2">Every flagged deal. Every market. Alerts the hour they list.</h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-6">
            Members see full addresses, run the live underwrite, export committee-ready IC memos,
            and get email alerts when new listings undercut their market&apos;s median — from $29.99/mo,
            a fraction of CoStar&apos;s $466.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/auth/signup" className="bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors">
              Start free — no card
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 transition-colors">
              Compare plans →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
