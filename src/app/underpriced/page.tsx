import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { isPaidTier } from "@/lib/access";
import { WaitlistCta } from "./WaitlistCta";

// Members-only feed: tier decides what renders, so this page is dynamic.
// Non-members get aggregate market stats + waitlist — never listing data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Underpriced Property Deals — Members | Prime Atlas",
  description:
    "Live listings priced ≥15% below their market's median per-sqm across USA and UK markets. Members-only mispricing feed — join the waitlist for undervalued-property alerts.",
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: stats }, { data: munis }, { data: waitlistRow }] =
    await Promise.all([
      user
        ? supabase.from("profiles").select("subscription_tier").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("market_listing_stats")
        .select("municipality_id, sale_count, underpriced_count, median_ppsqm")
        .gt("underpriced_count", 0)
        .not("median_ppsqm", "is", null),
      supabase
        .from("municipalities")
        .select("id, name, region, country, slug, currency_code")
        .in("country", ["United Kingdom", "United States"]),
      user
        ? supabase.from("underpriced_waitlist").select("id").eq("user_id", user.id).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const isMember = isPaidTier(
    (profile as { subscription_tier?: string } | null)?.subscription_tier
  );

  const muniMap = new Map((munis ?? []).map((m) => [m.id, m as Muni]));
  const ranked = ((stats ?? []) as StatRow[])
    .filter((s) => muniMap.has(s.municipality_id))
    .sort((a, b) => b.underpriced_count - a.underpriced_count)
    .slice(0, 8);

  const totalFlagged = ranked.reduce((n, s) => n + s.underpriced_count, 0);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  /* ── Non-member view: aggregate teaser + waitlist. No listing data. ──── */
  if (!isMember) {
    return (
      <>
        <Navbar user={user ? { email: user.email } : null} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <span>Underpriced</span>
          </nav>

          <div className="mb-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-pa-amber animate-pulse" />
              <span className="kicker text-pa-amber">Mispricing detector · updated {today} · members only</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">The Underpriced Feed</h1>
            <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
              Listings priced <span className="text-foreground font-semibold">15% or more below their
              market&apos;s median per-sqm</span> — recomputed from live scraped data across USA and UK
              markets. The full feed, addresses, and photos are reserved for members.
            </p>
            <div className="flex items-center gap-5 mt-5 text-xs font-mono text-muted-foreground">
              <span><span className="text-foreground font-bold">{totalFlagged}</span> listings flagged right now</span>
              <span><span className="text-foreground font-bold">{ranked.length}</span> markets</span>
              <span className="flex items-center gap-1.5"><span className="status-dot-live" /> live data</span>
            </div>
          </div>

          {/* Market-level aggregate teaser — counts + medians only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {ranked.map((s) => {
              const m = muniMap.get(s.municipality_id)!;
              const sym = SYM[m.currency_code ?? "USD"] ?? "$";
              return (
                <div key={s.municipality_id} className="border border-border rounded-xl bg-card p-4">
                  <p className="text-sm font-bold">
                    {m.country === "United Kingdom" ? "🇬🇧" : "🇺🇸"} {m.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.region}</p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-3 text-pa-amber">
                    {s.underpriced_count} flagged
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-1">
                    market median {money(Number(s.median_ppsqm), sym)}/sqm
                  </p>
                </div>
              );
            })}
          </div>

          {/* Locked preview — pure decoration, zero real data */}
          <div className="relative mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pointer-events-none select-none" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl bg-card overflow-hidden">
                  <div className="h-40 skeleton" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 w-24 skeleton rounded" />
                    <div className="h-3 w-40 skeleton rounded" />
                    <div className="h-3 w-28 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
              <div className="text-center px-6">
                <p className="text-lg font-bold mb-1">Deals, addresses & photos — members only</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-sm">
                  Every flagged listing with full address, photos, discount vs median, and
                  hourly email alerts, from $29.99/mo.
                </p>
                <Link href="/pricing" className="bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors inline-block">
                  Unlock the feed →
                </Link>
              </div>
            </div>
          </div>

          {/* Waitlist */}
          <div className="border border-primary/25 bg-primary/10 rounded-2xl p-8 sm:p-10 text-center">
            <p className="kicker mb-3">Undervalued-property waitlist</p>
            <h2 className="text-2xl font-bold mb-2">Be first when a mispriced listing hits your markets</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-6">
              Join the waitlist now — the moment you become a member, you&apos;ll be notified as
              undervalued properties are launched in the market, the hour our detector flags them.
            </p>
            <WaitlistCta isAuthed={!!user} initialJoined={!!waitlistRow} />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  /* ── Member view: the full feed ───────────────────────────────────────── */
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
      .filter((p) => p.discount >= 0.15 && p.discount <= 0.60) // deeper than −60% = presumed data error
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 6);
    if (deals.length) byMarket.set(s.municipality_id, deals);
  }

  const totalDeals = Array.from(byMarket.values()).reduce((n, d) => n + d.length, 0);

  return (
    <>
      <Navbar user={user ? { email: user.email } : null} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <span>Underpriced</span>
        </nav>

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
                  {deals.map((d) => (
                    <Link
                      key={d.id}
                      href={`/market-feed/${d.id}`}
                      className="group border border-border rounded-xl bg-card overflow-hidden hover:border-primary/40 transition-colors"
                    >
                      <div className="relative h-40 bg-secondary overflow-hidden">
                        {d.images?.[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={d.images[0]}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        )}
                        <span className="absolute top-2 left-2 text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5">
                          −{Math.round(d.discount * 100)}% vs median
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="text-lg font-bold font-mono tabular-nums">
                          {money(d.price!, sym)}
                          <span className="text-xs text-muted-foreground font-normal ml-2">
                            {money(d.ppsqm, sym)}/sqm
                          </span>
                        </p>
                        <p className="text-xs mt-1 truncate text-muted-foreground">
                          {d.address ?? "Address on file"}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                          {d.bedrooms ? `${d.bedrooms} bed · ` : ""}{d.property_type ?? "Residential"} · {Math.round(d.size_sqm!)} sqm
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <Footer />
    </>
  );
}
