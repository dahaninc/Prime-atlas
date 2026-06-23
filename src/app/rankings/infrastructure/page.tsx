import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { scoreColor } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Infrastructure Impact Index 2026 | Highest Infrastructure Investment Municipalities Spain",
  description:
    "Spanish municipalities with the highest infrastructure investment pipeline — roads, rail, ports, utilities. Ranked by infrastructure score and active project budget. Updated weekly.",
};

export const revalidate = 3600;

export default async function InfrastructureImpactPage() {
  const supabase = await createClient();

  const { data: municipalities } = await supabase
    .from("municipalities")
    .select("id, name, region, slug, opportunity_score, infrastructure_score")
    .order("infrastructure_score", { ascending: false })
    .limit(30);

  // Get top infrastructure projects per municipality
  const { data: projects } = await supabase
    .from("infrastructure_projects")
    .select("municipality_id, project_name, budget, impact_score, status")
    .in("status", ["approved", "under_construction"])
    .order("impact_score", { ascending: false });

  const projectMap = (projects ?? []).reduce<Record<string, { name: string; budget: number }>>((acc, p) => {
    if (!acc[p.municipality_id]) acc[p.municipality_id] = { name: p.project_name, budget: p.budget };
    return acc;
  }, {});

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <nav className="text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/rankings" className="hover:text-foreground">Rankings</Link>
        <span className="mx-2">/</span>
        <span>Infrastructure Impact</span>
      </nav>

      <div className="flex gap-2 flex-wrap mb-8">
        {[
          { href: "/rankings", label: "Spain Opportunity Index" },
          { href: "/rankings/coastal", label: "Coastal Growth" },
          { href: "/rankings/development", label: "Development Momentum" },
          { href: "/rankings/infrastructure", label: "Infrastructure Impact", active: true },
        ].map((tab) => (
          <Link key={tab.href} href={tab.href}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${tab.active ? "border-pa-green/40 bg-pa-green/10 text-pa-green" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-8">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">prime-atlas · Infrastructure Index</p>
        <h1 className="text-4xl font-bold mb-3">Infrastructure Impact Index</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
          Infrastructure spend is the single most reliable leading indicator of property value uplift.
          This index ranks municipalities by the quality and quantum of approved and under-construction
          infrastructure projects — roads, rail, ports, utilities, and public investment.
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border bg-secondary/30 text-xs text-muted-foreground font-mono uppercase tracking-widest">
          <span className="col-span-1">#</span>
          <span className="col-span-3">Municipality</span>
          <span className="col-span-4">Top Project</span>
          <span className="col-span-1 text-right">Infra</span>
          <span className="col-span-3 text-right">Score</span>
        </div>
        {municipalities?.map((m, i) => {
          const proj = projectMap[m.id];
          return (
            <Link key={m.id}
              href={`/opportunities/${m.slug ?? m.name.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "")}`}
              className="grid grid-cols-12 px-5 py-4 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors items-center group">
              <span className="col-span-1 text-muted-foreground font-mono text-sm">{i + 1}</span>
              <div className="col-span-5 sm:col-span-3">
                <p className="font-medium text-sm group-hover:text-pa-green transition-colors">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.region}</p>
              </div>
              <div className="hidden sm:block col-span-4 pr-4">
                {proj ? (
                  <>
                    <p className="text-xs text-foreground leading-snug line-clamp-1">{proj.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      €{(proj.budget / 100_000_000).toFixed(0)}M
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </div>
              <span className={`hidden sm:block col-span-1 text-right font-mono text-sm ${scoreColor(m.infrastructure_score)}`}>{m.infrastructure_score}</span>
              <div className="col-span-6 sm:col-span-3 text-right">
                <span className={`font-mono font-bold text-xl ${scoreColor(m.opportunity_score)}`}>{m.opportunity_score}</span>
                <span className="text-xs text-muted-foreground ml-0.5">/100</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 p-6 border border-border rounded-xl bg-card text-center">
        <p className="text-sm font-semibold mb-1">Get infrastructure alerts before they move the market</p>
        <p className="text-xs text-muted-foreground mb-4">Pro subscribers are notified the moment a new infrastructure project is approved in their watched municipalities.</p>
        <Link href="/auth/signup" className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors">Start free</Link>
      </div>
    </main>
  );
}
