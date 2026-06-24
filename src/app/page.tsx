import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SearchBar } from "@/components/ui/SearchBar";
import { scoreColor } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "prime-atlas | Find Tomorrow's Winners Before Everyone Else",
  description:
    "Ranked, scored investment markets across Spain, UK, USA, Australia, and Canada. Data-driven opportunity index for property developers, capital allocators, and fund managers.",
};

const INDEXES = [
  { href: "/deal-board",             label: "Global Opportunity Index",   description: "All markets ranked by composite score across 5 countries" },
  { href: "/rankings/coastal",       label: "Coastal Growth Index",        description: "Highest migration & tourism momentum" },
  { href: "/rankings/development",   label: "Development Momentum",        description: "Fastest-moving planning pipelines" },
  { href: "/rankings/infrastructure",label: "Infrastructure Impact",       description: "Biggest approved infrastructure spend" },
];

const MARKETS = [
  { flag: "🇬🇧", label: "United Kingdom", sub: "HM Land Registry" },
  { flag: "🇺🇸", label: "United States",  sub: "Census + FRED" },
  { flag: "🇦🇺", label: "Australia",       sub: "CoreLogic proxies" },
  { flag: "🇨🇦", label: "Canada",          sub: "CMHC data" },
  { flag: "🇪🇸", label: "Spain",           sub: "Catastro + INE" },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: topMunicipalities } = await supabase
    .from("municipalities")
    .select("id, name, region, country, slug, opportunity_score")
    .order("opportunity_score", { ascending: false })
    .limit(3);

  const { data: recentSignals } = await supabase
    .from("signals")
    .select("id, title, opportunity_impact, municipalities(name)")
    .order("detected_at", { ascending: false })
    .limit(3);

  return (
    <>
      <Navbar user={user} />

      <main>
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 border border-pa-green/30 bg-pa-green/5 text-pa-green text-xs font-mono px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-pa-green animate-pulse" />
            Live signals · London · New York · Melbourne · Madrid
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Find Tomorrow&apos;s{" "}
            <span className="text-pa-green">Winners</span>{" "}
            Before Everyone Else.
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            The intelligence layer for global investment markets. Municipalities across five countries,
            ranked by growth, infrastructure, development, liquidity, and risk — before the market prices it in.
          </p>

          {/* Search */}
          <SearchBar className="max-w-lg mx-auto mb-8" />

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="bg-pa-green text-pa-navy font-semibold px-8 py-3.5 rounded-lg hover:bg-pa-green/90 transition-colors text-sm">
              Start for free
            </Link>
            <Link href="/deal-board" className="border border-border text-foreground px-8 py-3.5 rounded-lg hover:bg-secondary transition-colors text-sm">
              Explore Deal Board →
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required</p>
        </section>

        {/* Markets strip */}
        <section className="border-t border-b border-border py-8 bg-secondary/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest text-center mb-6">
              Markets covered
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {MARKETS.map((m) => (
                <div key={m.label} className="text-center">
                  <p className="text-2xl mb-1">{m.flag}</p>
                  <p className="text-xs font-medium">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Top 3 opportunities */}
        <section className="border-b border-border py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest text-center mb-8">
              Top-ranked markets right now
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {topMunicipalities?.map((m, i) => (
                <Link
                  key={m.id}
                  href={`/opportunities/${m.slug ?? m.name.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "")}`}
                  className="border border-border rounded-xl p-5 bg-card hover:border-pa-green/40 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-1">#{i + 1}</p>
                      <p className="font-semibold text-sm group-hover:text-pa-green transition-colors">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.region} · {m.country}</p>
                    </div>
                  </div>
                  <p className={`text-3xl font-bold font-mono ${scoreColor(m.opportunity_score)}`}>{m.opportunity_score}</p>
                  <p className="text-xs text-muted-foreground mt-1">Opportunity Score</p>
                </Link>
              ))}
            </div>
            <p className="text-center mt-6">
              <Link href="/deal-board" className="text-sm text-pa-green hover:underline">
                View all markets in the Deal Board →
              </Link>
            </p>
          </div>
        </section>

        {/* Indexes */}
        <section className="border-b border-border py-14 bg-secondary/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2 text-center">Public indexes — free forever</p>
            <h2 className="text-3xl font-bold text-center mb-10">Four ways to find the next winner</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INDEXES.map((idx) => (
                <Link key={idx.href} href={idx.href}
                  className="border border-border rounded-xl p-5 bg-card hover:border-pa-green/40 transition-colors group">
                  <p className="font-semibold text-sm group-hover:text-pa-green transition-colors mb-1">{idx.label}</p>
                  <p className="text-xs text-muted-foreground">{idx.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Live signals strip */}
        {recentSignals && recentSignals.length > 0 && (
          <section className="border-b border-border py-14">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Live signals</p>
                </div>
                <Link href="/signals" className="text-xs text-pa-green hover:underline">View all →</Link>
              </div>
              <div className="space-y-3">
                {recentSignals.map((sig) => (
                  <div key={sig.id} className="flex items-center justify-between border border-border rounded-xl px-5 py-4 bg-card">
                    <div>
                      <p className="text-sm font-medium">{sig.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(sig.municipalities as { name: string } | null)?.name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-pa-green font-mono font-bold">+{sig.opportunity_impact}</p>
                      <p className="text-xs text-muted-foreground">impact</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center mt-4">
                <Link href="/auth/signup" className="text-xs text-muted-foreground hover:text-foreground">
                  Sign up for real-time signal alerts →
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="py-20 text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold mb-4">The next winner could be in Manchester, Miami, or Melbourne.</h2>
            <p className="text-muted-foreground text-sm mb-8">
              prime-atlas scores municipalities across five countries on growth, infrastructure, development, liquidity,
              and risk — so you see the opportunity before consensus does.
            </p>
            <Link href="/auth/signup" className="inline-block bg-pa-green text-pa-navy font-semibold px-8 py-3.5 rounded-lg hover:bg-pa-green/90 transition-colors text-sm">
              Start for free — no card required
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
