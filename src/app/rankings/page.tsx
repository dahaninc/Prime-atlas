import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { scoreColor } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Spain Opportunity Index 2026 | Top Investment Municipalities",
  description:
    "The definitive ranking of investment municipalities in Spain by Opportunity Score. Updated weekly from infrastructure, development, growth, and liquidity signals. Costa Blanca, Alicante, Valencia.",
  openGraph: {
    title: "Spain Opportunity Index 2026 | prime-atlas",
    description: "Ranked investment municipalities in Spain by composite Opportunity Score.",
  },
};

export const revalidate = 3600; // ISR — revalidate every hour

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Spain Opportunity Index 2026",
  description: "Ranked list of investment municipalities in Spain by composite Opportunity Score",
  creator: { "@type": "Organization", name: "prime-atlas", url: "https://prime-atlas.com" },
  dateModified: new Date().toISOString().split("T")[0],
  keywords: ["Spain investment", "municipality ranking", "opportunity score", "Costa Blanca", "Alicante", "Valencia"],
};

export default async function SpainOpportunityIndexPage() {
  const supabase = await createClient();

  const { data: municipalities } = await supabase
    .from("municipalities")
    .select("id, name, region, population, opportunity_score, growth_score, infrastructure_score, development_score, liquidity_score, risk_score")
    .order("opportunity_score", { ascending: false })
    .limit(50);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>Rankings</span>
        </nav>

        {/* Index tabs */}
        <div className="flex gap-2 flex-wrap mb-8">
          {[
            { href: "/rankings", label: "Spain Opportunity Index", active: true },
            { href: "/rankings/coastal", label: "Coastal Growth" },
            { href: "/rankings/development", label: "Development Momentum" },
            { href: "/rankings/infrastructure", label: "Infrastructure Impact" },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                tab.active
                  ? "border-pa-green/40 bg-pa-green/10 text-pa-green"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="mb-8">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
            prime-atlas · Updated weekly · {municipalities?.length ?? 0} municipalities
          </p>
          <h1 className="text-4xl font-bold mb-3">Spain Opportunity Index</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            A composite ranking of Spain&apos;s highest-conviction investment municipalities, scored across
            Growth, Infrastructure, Development, Liquidity, and Risk. Scores are recomputed weekly
            from public infrastructure, planning, and economic records.
          </p>
        </div>

        {/* Score legend */}
        <div className="flex gap-4 mb-6 flex-wrap">
          {[
            { label: "75–100 High", color: "text-pa-green" },
            { label: "50–74 Medium", color: "text-pa-amber" },
            { label: "0–49 Low", color: "text-pa-red" },
          ].map(({ label, color }) => (
            <span key={label} className={`text-xs font-mono ${color}`}>{label}</span>
          ))}
        </div>

        {/* Rankings table */}
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border bg-secondary/30 text-xs text-muted-foreground font-mono uppercase tracking-widest">
            <span className="col-span-1">#</span>
            <span className="col-span-3">Municipality</span>
            <span className="col-span-2">Region</span>
            <span className="col-span-1 text-right hidden lg:block">Growth</span>
            <span className="col-span-1 text-right hidden lg:block">Infra</span>
            <span className="col-span-1 text-right hidden lg:block">Dev</span>
            <span className="col-span-1 text-right hidden lg:block">Liquidity</span>
            <span className="col-span-3 text-right">Score</span>
          </div>

          {municipalities?.map((m, i) => (
            <Link
              key={m.id}
              href={`/opportunities/${m.name.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "")}`}
              className="grid grid-cols-12 px-5 py-4 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors items-center group"
            >
              <span className="col-span-1 text-muted-foreground font-mono text-sm">
                {i + 1}
              </span>
              <div className="col-span-5 sm:col-span-3">
                <p className="font-medium text-sm group-hover:text-pa-green transition-colors">{m.name}</p>
                <p className="sm:hidden text-xs text-muted-foreground">{m.region}</p>
              </div>
              <span className="hidden sm:block col-span-2 text-muted-foreground text-sm">{m.region}</span>
              <span className="hidden lg:block col-span-1 text-right font-mono text-xs text-muted-foreground">{m.growth_score}</span>
              <span className="hidden lg:block col-span-1 text-right font-mono text-xs text-muted-foreground">{m.infrastructure_score}</span>
              <span className="hidden lg:block col-span-1 text-right font-mono text-xs text-muted-foreground">{m.development_score}</span>
              <span className="hidden lg:block col-span-1 text-right font-mono text-xs text-muted-foreground">{m.liquidity_score}</span>
              <div className="col-span-6 sm:col-span-3 text-right">
                <span className={`font-mono font-bold text-xl ${scoreColor(m.opportunity_score)}`}>
                  {m.opportunity_score}
                </span>
                <span className="text-xs text-muted-foreground ml-0.5">/100</span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 p-6 border border-border rounded-xl bg-card text-center">
          <p className="text-sm font-semibold mb-1">Get the full investment thesis for every ranked municipality</p>
          <p className="text-xs text-muted-foreground mb-4">
            Pro subscribers see AI-generated theses, supporting evidence, risk breakdowns, and live signals.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors"
          >
            Start free — no card required
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Scores are algorithmic estimates, not financial advice. Data sourced from public infrastructure,
          planning, and economic records.
        </p>
      </main>
    </>
  );
}
