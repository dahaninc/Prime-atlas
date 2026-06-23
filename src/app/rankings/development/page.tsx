import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { scoreColor } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Development Momentum Index 2026 | Fastest Growing Municipalities Spain",
  description:
    "Spain's fastest-growing development municipalities ranked by planning activity, permits issued, land availability, and developer interest. Updated weekly.",
};

export const revalidate = 3600;

export default async function DevelopmentMomentumPage() {
  const supabase = await createClient();

  const { data: municipalities } = await supabase
    .from("municipalities")
    .select("id, name, region, slug, opportunity_score, development_score, growth_score")
    .order("development_score", { ascending: false })
    .limit(30);

  // Get planning application counts per municipality
  const { data: planningCounts } = await supabase
    .from("planning_applications")
    .select("municipality_id, status");

  const countMap = (planningCounts ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.municipality_id] = (acc[p.municipality_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <nav className="text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/rankings" className="hover:text-foreground">Rankings</Link>
        <span className="mx-2">/</span>
        <span>Development Momentum</span>
      </nav>

      <div className="flex gap-2 flex-wrap mb-8">
        {[
          { href: "/rankings", label: "Spain Opportunity Index" },
          { href: "/rankings/coastal", label: "Coastal Growth" },
          { href: "/rankings/development", label: "Development Momentum", active: true },
          { href: "/rankings/infrastructure", label: "Infrastructure Impact" },
        ].map((tab) => (
          <Link key={tab.href} href={tab.href}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${tab.active ? "border-pa-green/40 bg-pa-green/10 text-pa-green" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-8">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">prime-atlas · Development Index</p>
        <h1 className="text-4xl font-bold mb-3">Development Momentum Index</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
          Measures planning activity, permit velocity, land availability, and developer interest across
          Spanish municipalities. High development momentum indicates a market entering its growth phase —
          the ideal entry window before mainstream capital deployment.
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border bg-secondary/30 text-xs text-muted-foreground font-mono uppercase tracking-widest">
          <span className="col-span-1">#</span>
          <span className="col-span-4">Municipality</span>
          <span className="col-span-2">Region</span>
          <span className="col-span-2 text-right">Active Plans</span>
          <span className="col-span-3 text-right">Dev Score</span>
        </div>
        {municipalities?.map((m, i) => (
          <Link key={m.id}
            href={`/opportunities/${m.slug ?? m.name.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "")}`}
            className="grid grid-cols-12 px-5 py-4 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors items-center group">
            <span className="col-span-1 text-muted-foreground font-mono text-sm">{i + 1}</span>
            <div className="col-span-6 sm:col-span-4">
              <p className="font-medium text-sm group-hover:text-pa-green transition-colors">{m.name}</p>
              <p className="sm:hidden text-xs text-muted-foreground">{m.region}</p>
            </div>
            <span className="hidden sm:block col-span-2 text-muted-foreground text-sm">{m.region}</span>
            <span className="hidden sm:block col-span-2 text-right font-mono text-xs text-muted-foreground">
              {countMap[m.id] ?? 0}
            </span>
            <div className="col-span-6 sm:col-span-3 text-right">
              <span className={`font-mono font-bold text-xl ${scoreColor(m.development_score)}`}>{m.development_score}</span>
              <span className="text-xs text-muted-foreground ml-0.5">/100</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 p-6 border border-border rounded-xl bg-card text-center">
        <p className="text-sm font-semibold mb-1">Track planning applications in real time</p>
        <p className="text-xs text-muted-foreground mb-4">Pro subscribers get alerts when new planning applications are filed in their watched municipalities.</p>
        <Link href="/auth/signup" className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors">Start free</Link>
      </div>
    </main>
  );
}
