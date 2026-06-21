import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { scoreColor } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Coastal Growth Index 2026 | Best Coastal Investment Municipalities Spain",
  description:
    "Ranked coastal municipalities in Spain by growth trajectory. Migration rates, tourism index, development activity, and infrastructure investment. Costa Blanca, Costa Dorada, Costa del Sol.",
};

export const revalidate = 3600;

export default async function CoastalGrowthIndexPage() {
  const supabase = await createClient();

  // Coastal = weight tourism + growth + liquidity heavily
  const { data: municipalities } = await supabase
    .from("municipalities")
    .select("id, name, region, population, opportunity_score, growth_score, liquidity_score, development_score")
    .order("growth_score", { ascending: false })
    .limit(30);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <nav className="text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/rankings" className="hover:text-foreground">Rankings</Link>
        <span className="mx-2">/</span>
        <span>Coastal Growth Index</span>
      </nav>

      <div className="flex gap-2 flex-wrap mb-8">
        {[
          { href: "/rankings", label: "Spain Opportunity Index" },
          { href: "/rankings/coastal", label: "Coastal Growth", active: true },
          { href: "/rankings/development", label: "Development Momentum" },
          { href: "/rankings/infrastructure", label: "Infrastructure Impact" },
        ].map((tab) => (
          <Link key={tab.href} href={tab.href}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${tab.active ? "border-pa-green/40 bg-pa-green/10 text-pa-green" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-8">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">prime-atlas · Coastal Index</p>
        <h1 className="text-4xl font-bold mb-3">Coastal Growth Index</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
          Ranks coastal and near-coastal municipalities by growth trajectory — net migration, population growth,
          tourism demand, and residential transaction velocity. The strongest leading indicator of
          medium-term capital growth in coastal markets.
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border bg-secondary/30 text-xs text-muted-foreground font-mono uppercase tracking-widest">
          <span className="col-span-1">#</span>
          <span className="col-span-4">Municipality</span>
          <span className="col-span-2">Region</span>
          <span className="col-span-2 text-right">Growth Score</span>
          <span className="col-span-3 text-right">Opportunity Score</span>
        </div>
        {municipalities?.map((m, i) => (
          <Link key={m.id}
            href={`/opportunities/${m.name.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "")}`}
            className="grid grid-cols-12 px-5 py-4 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors items-center group">
            <span className="col-span-1 text-muted-foreground font-mono text-sm">{i + 1}</span>
            <div className="col-span-6 sm:col-span-4">
              <p className="font-medium text-sm group-hover:text-pa-green transition-colors">{m.name}</p>
              <p className="sm:hidden text-xs text-muted-foreground">{m.region}</p>
            </div>
            <span className="hidden sm:block col-span-2 text-muted-foreground text-sm">{m.region}</span>
            <span className={`hidden sm:block col-span-2 text-right font-mono font-semibold ${scoreColor(m.growth_score)}`}>{m.growth_score}</span>
            <div className="col-span-6 sm:col-span-3 text-right">
              <span className={`font-mono font-bold text-xl ${scoreColor(m.opportunity_score)}`}>{m.opportunity_score}</span>
              <span className="text-xs text-muted-foreground ml-0.5">/100</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 p-6 border border-border rounded-xl bg-card text-center">
        <p className="text-sm font-semibold mb-1">See AI-generated theses for every coastal opportunity</p>
        <p className="text-xs text-muted-foreground mb-4">Pro subscribers unlock the full investment brief including evidence, risk rating, and signals.</p>
        <Link href="/auth/signup" className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors">
          Start free
        </Link>
      </div>
    </main>
  );
}
