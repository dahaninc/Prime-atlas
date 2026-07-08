import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { normalizeTier, underpricedListingLimit } from "@/lib/entitlements";
import { fetchZipCompScreens } from "@/lib/server/compScreens";
import { fmt, symFor } from "@/lib/money";
import { WaitlistCta } from "./WaitlistCta";

// Members-only feed: tier decides what renders, so this page is dynamic.
// Non-members get aggregate market stats + waitlist — never listing data.
//
// Basis (2026-07-08 methodology rebuild): every flag on this page comes from
// the ZIP-comp screen (src/lib/comps.ts via fetchZipCompScreens) — a listing
// is "underpriced" only vs the median of ≥5 comps in its own ZIP × property
// type × bedrooms, the SAME basis as the Deal Board and the Investment
// Analysis Report. Never the blended metro median: that basis made
// "discount" a proxy for "smaller/cheaper than the metro's blended mix",
// and this page advertising SF "bargains" the report honestly refused to
// rank was exactly the contradiction a sharp customer would catch. Markets
// without comp density (all UK today, and US flagships like SF/LA) drop
// out rather than showing discounts against the wrong basis.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Underpriced Property Deals — Members | Prime Atlas",
  description:
    "Live listings priced ≥15% below their own ZIP-level comparables (same ZIP, property type, bedrooms — minimum 5 comps) in covered US submarkets. Members-only mispricing feed — join the waitlist for undervalued-property alerts.",
};

interface Muni {
  id: string; name: string; region: string; country: string; slug: string;
  currency_code: string | null;
}

export default async function UnderpricedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: munis }, { data: waitlistRow }] =
    await Promise.all([
      user
        ? supabase.from("profiles").select("subscription_tier").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("municipalities")
        .select("id, name, region, country, slug, currency_code")
        .in("country", ["United Kingdom", "United States"]),
      user
        ? supabase.from("underpriced_waitlist").select("id").eq("user_id", user.id).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const tier  = normalizeTier((profile as { subscription_tier?: string } | null)?.subscription_tier);
  const limit = underpricedListingLimit(tier); // 0 = free (aggregate only), N = Explorer teaser, null = full feed

  const muniMap = new Map((munis ?? []).map((m) => [m.id, m as Muni]));

  // ZIP-comp screens over US markets' full sale inventories. UK is
  // structurally uncovered (no size/postcode data — see compScreens.ts) and
  // is deliberately not fetched: honest silence, not a blended-median flag.
  const usMarketIds = (munis ?? []).filter((m) => m.country === "United States").map((m) => m.id);
  const screens = await fetchZipCompScreens(supabase, usMarketIds);

  const rankedMarkets = usMarketIds
    .map((id) => ({ id, ...screens.get(id)! }))
    .filter((s) => s.screen.mispricingCount > 0)
    .sort((a, b) => b.screen.mispricingCount - a.screen.mispricingCount)
    .slice(0, 8);

  const totalFlagged = rankedMarkets.reduce((n, s) => n + s.screen.mispricingCount, 0);
  const coveredMarketCount = Array.from(screens.values()).filter((s) => s.screen.coveredCount > 0).length;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  /* ── Free tier: aggregate teaser + waitlist. No real listing data. ──── */
  if (limit === 0) {
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
              Listings priced <span className="text-foreground font-semibold">15% or more below their own
              ZIP-level comparables</span> — same ZIP, property type, and bedroom count, minimum 5 live comps,
              recomputed from live scraped data. Real submarket comps currently cover {coveredMarketCount} US
              markets; where a listing lacks true comparables we say so rather than measure it against a blended
              metro median. The full feed, addresses, and photos are reserved for members.
            </p>
            <div className="flex items-center gap-5 mt-5 text-xs font-mono text-muted-foreground">
              <span><span className="text-foreground font-bold">{totalFlagged}</span> listings flagged right now</span>
              <span><span className="text-foreground font-bold">{rankedMarkets.length}</span> markets</span>
              <span className="flex items-center gap-1.5"><span className="status-dot-live" /> live data</span>
            </div>
          </div>

          {/* Market-level aggregate teaser — counts + coverage only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {rankedMarkets.map((s) => {
              const m = muniMap.get(s.id)!;
              return (
                <div key={s.id} className="border border-border rounded-xl bg-card p-4">
                  <p className="text-sm font-bold">🇺🇸 {m.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.region}</p>
                  <p className="text-lg font-bold font-mono tabular-nums mt-3 text-pa-amber">
                    {s.screen.mispricingCount} flagged
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-1">
                    {s.screen.coveredCount} of {s.screen.totalCount} listings have ≥5-comp coverage
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
                  Every flagged listing with full address, photos, discount vs its own ZIP-level comps, and
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
  // Deals per market straight from the same screen the counts came from —
  // one basis, one query instant, comp evidence attached.
  const byMarket = new Map<string, {
    id: string; address: string | null; price: number; ppsqm: number;
    bedrooms: number | null; property_type: string | null; size_sqm: number | null;
    images: string[] | null; municipality_id: string;
    discountPct: number; compCount: number; basisLabel: string | null;
  }[]>();
  for (const s of rankedMarkets) {
    const deals = s.listings
      .map((l) => ({ l, c: s.screen.byId.get(l.id)! }))
      .filter(({ c }) => c.status === "mispriced")
      .map(({ l, c }) => ({
        id: l.id, address: l.address, price: l.price!, ppsqm: l.price! / (l.size_sqm as number),
        bedrooms: l.bedrooms, property_type: l.property_type, size_sqm: l.size_sqm,
        images: l.images, municipality_id: l.municipality_id,
        discountPct: c.discountPct!, compCount: c.comps.length, basisLabel: c.basisLabel,
      }))
      .sort((a, b) => b.discountPct - a.discountPct)
      .slice(0, 6);
    if (deals.length) byMarket.set(s.id, deals);
  }

  const totalDeals = Array.from(byMarket.values()).reduce((n, d) => n + d.length, 0);

  // Explorer teaser: the N globally-best real deals (by discount), flat —
  // not grouped by market. Professional/Institutional (limit === null) skip
  // this entirely and get the full per-market feed below.
  const isTeaser = limit !== null;
  const teaserDeals = isTeaser
    ? Array.from(byMarket.values()).flat().sort((a, b) => b.discountPct - a.discountPct).slice(0, limit)
    : [];
  const lockedCount = Math.max(0, totalDeals - teaserDeals.length);

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
            <span className="kicker text-pa-amber">Mispricing detector · updated {today}{isTeaser ? " · Explorer preview" : ""}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">The Underpriced Feed</h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
            Listings priced <span className="text-foreground font-semibold">15% or more below their own
            ZIP-level comparables</span> — same ZIP, property type, and bedroom count, minimum 5 live comps.
            Real submarket comps currently cover {coveredMarketCount} US markets; a listing without true
            comparables is excluded, never measured against a blended metro median.
            {isTeaser
              ? ` Showing your top ${teaserDeals.length} — the full feed is a Professional feature.`
              : " This is the spread institutional buyers move on before it closes."}
          </p>
          <div className="flex items-center gap-5 mt-5 text-xs font-mono text-muted-foreground">
            <span><span className="text-foreground font-bold">{isTeaser ? teaserDeals.length : totalDeals}</span> {isTeaser ? "shown" : "flagged deals"}</span>
            {!isTeaser && <span><span className="text-foreground font-bold">{byMarket.size}</span> markets</span>}
            <span className="flex items-center gap-1.5"><span className="status-dot-live" /> live data</span>
          </div>
        </div>

        {isTeaser ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {teaserDeals.map((d) => {
                const m = muniMap.get(d.municipality_id)!;
                const sym = symFor(m.currency_code ?? "USD");
                return (
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
                        −{Math.round(d.discountPct)}% vs {d.compCount} ZIP comps
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">
                        🇺🇸 {m.name}
                      </p>
                      <p className="text-lg font-bold font-mono tabular-nums">
                        {fmt(d.price / 100, sym)}
                        <span className="text-xs text-muted-foreground font-normal ml-2">
                          {fmt(d.ppsqm / 100, sym)}/sqm
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
                );
              })}
            </div>

            {lockedCount > 0 && (
              <div className="border border-border rounded-xl bg-card px-6 py-8 text-center mb-12">
                <p className="text-sm font-semibold mb-1">
                  {lockedCount} more flagged deal{lockedCount === 1 ? "" : "s"} across {byMarket.size} markets
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
                  Explorer shows your top {teaserDeals.length} mispriced listings. Professional unlocks the full
                  feed, every covered market, and hourly alerts.
                </p>
                <Link href="/pricing" className="inline-block bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors">
                  Upgrade to Professional →
                </Link>
              </div>
            )}
          </>
        ) : (
        <div className="space-y-12">
          {rankedMarkets.filter((s) => byMarket.has(s.id)).map((s) => {
            const m = muniMap.get(s.id)!;
            const deals = byMarket.get(s.id)!;
            const sym = symFor(m.currency_code ?? "USD");
            return (
              <section key={s.id}>
                <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold">
                      🇺🇸 {m.name}
                      <span className="text-muted-foreground font-normal text-sm ml-2">{m.region}</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {s.screen.mispricingCount} listings flagged · {s.screen.coveredCount} of {s.screen.totalCount} have ≥5-comp coverage
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
                          −{Math.round(d.discountPct)}% vs {d.compCount} ZIP comps
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="text-lg font-bold font-mono tabular-nums">
                          {fmt(d.price / 100, sym)}
                          <span className="text-xs text-muted-foreground font-normal ml-2">
                            {fmt(d.ppsqm / 100, sym)}/sqm
                          </span>
                        </p>
                        <p className="text-xs mt-1 truncate text-muted-foreground">
                          {d.address ?? "Address on file"}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                          {d.bedrooms ? `${d.bedrooms} bed · ` : ""}{d.property_type ?? "Residential"} · {Math.round(d.size_sqm!)} sqm
                          {d.basisLabel ? ` · vs ${d.basisLabel}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        )}
      </main>

      <Footer />
    </>
  );
}
