import { createPublicClient } from "@/lib/supabase/public";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { scoreColor, scoreColor as sc, formatCurrency } from "@/lib/utils";
import { ScoreBadge, ScoreBar } from "@/components/ui/ScoreBadge";
import { ScoreRadar } from "@/components/charts/ScoreRadar";
import { ScoreBreakdown } from "@/components/charts/ScoreBreakdown";
import { LiveListings } from "@/components/listings/LiveListings";
import type { Listing } from "@/components/listings/LiveListings";
import type { Signal, InfrastructureProject } from "@/types";

// Skip static generation — municipalities require auth via RLS.
// Pages render on-demand for authenticated users.
// Revalidate every 5 minutes — public data, served from the CDN in between.
export const revalidate = 300;

// Enable ISR: pages are rendered on first request, then cached at the CDN
// until revalidation. No slugs are prebuilt at build time.
export async function generateStaticParams() {
  return [];
}

type PageProps = { params: Promise<{ slug: string }> };

// Dynamic SEO metadata per municipality
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data: m } = await supabase
    .from("municipalities")
    .select("name, region, country, opportunity_score")
    .eq("slug", slug)
    .single();

  if (!m) return { title: "Municipality Not Found" };

  const country = m.country ?? "Unknown";

  return {
    title: `Investment Opportunities in ${m.name}, ${m.region} 2026`,
    description: `${m.name} scores ${m.opportunity_score}/100 on the prime-atlas Opportunity Index. Discover ranked investment opportunities, infrastructure projects, and signals in ${m.name}, ${m.region}, ${country}.`,
    openGraph: {
      title: `Investment Opportunities in ${m.name} | prime-atlas`,
      description: `${m.name} Opportunity Score: ${m.opportunity_score}/100. Data-driven market analysis, infrastructure signals, and ranked opportunities.`,
    },
  };
}

export default async function MunicipalityPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data: municipality } = await supabase
    .from("municipalities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!municipality) notFound();
  if (!["United Kingdom", "United States"].includes(municipality.country ?? "")) notFound();

  const country      = municipality.country      ?? "Unknown";
  const currencyCode = municipality.currency_code ?? "EUR";

  const [
    { data: opportunities },
    { data: signals },
    { data: infraProjects },
    { data: planningApps },
    { data: listings },
  ] = await Promise.all([
    supabase.from("opportunities").select("*").eq("municipality_id", municipality.id).eq("status", "active").order("opportunity_score", { ascending: false }),
    supabase.from("signals").select("*").eq("municipality_id", municipality.id).order("detected_at", { ascending: false }).limit(5),
    supabase.from("infrastructure_projects").select("*").eq("municipality_id", municipality.id).order("impact_score", { ascending: false }),
    supabase.from("planning_applications").select("*").eq("municipality_id", municipality.id).order("application_date", { ascending: false }).limit(5),
    supabase.from("listings").select("*").eq("municipality_id", municipality.id).in("status", ["active","under_offer"]).order("featured", { ascending: false }).order("date_listed", { ascending: false }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: municipality.name,
    description: `Investment opportunity analysis for ${municipality.name}, ${municipality.region}, ${country}`,
    geo: { "@type": "GeoCoordinates", latitude: municipality.lat, longitude: municipality.lng },
    containedInPlace: { "@type": "AdministrativeArea", name: municipality.region },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href="/deal-board" className="hover:text-foreground">Deal Board</Link>
          <span>/</span>
          <span>{municipality.name}</span>
        </nav>

        {/* Hero */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-10">
          <div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
              {municipality.region} · {country} · Pop. {municipality.population?.toLocaleString("en-GB") ?? "—"}
            </p>
            <h1 className="text-4xl font-bold mb-2">
              {municipality.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              prime-atlas Opportunity Index · Updated weekly
            </p>
          </div>
          <div className="flex-shrink-0">
            <ScoreBadge score={municipality.opportunity_score} size="lg" showLabel />
          </div>
        </div>

        {/* Score breakdown */}
        <div className="border border-border rounded-xl p-6 bg-card mb-8">
          <h2 className="font-semibold text-sm mb-5">Score Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
            <ScoreRadar scores={{
              growth_score: municipality.growth_score,
              infrastructure_score: municipality.infrastructure_score,
              development_score: municipality.development_score,
              liquidity_score: municipality.liquidity_score,
              risk_score: municipality.risk_score,
            }} size={240} />
            <div className="space-y-3 flex flex-col justify-center">
              <ScoreBar label="Growth Score"       score={municipality.growth_score} />
              <ScoreBar label="Infrastructure Score" score={municipality.infrastructure_score} />
              <ScoreBar label="Development Score"   score={municipality.development_score} />
              <ScoreBar label="Liquidity Score"     score={municipality.liquidity_score} />
              <ScoreBar label="Safety (inv. risk)"  score={100 - municipality.risk_score} />
            </div>
          </div>
          <ScoreBreakdown scores={{
            growth_score: municipality.growth_score,
            infrastructure_score: municipality.infrastructure_score,
            development_score: municipality.development_score,
            liquidity_score: municipality.liquidity_score,
            risk_score: municipality.risk_score,
          }} />
          <p className="text-xs text-muted-foreground mt-4">
            Composite Opportunity Score = weighted blend of Growth (25%) + Infrastructure (25%) + Development (25%) + Liquidity (15%) + Risk-adjusted (10%)
          </p>
        </div>

        {/* Market overview */}
        {opportunities?.[0]?.investment_thesis && (
          <div className="border border-border rounded-xl p-6 bg-card mb-8">
            <div className="flex items-center justify-between gap-2 mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Market Overview
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {opportunities[0].investment_thesis}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Opportunities */}
            <section>
              <h2 className="font-semibold mb-4">
                Active Opportunities
                <span className="ml-2 text-xs text-muted-foreground font-normal">({opportunities?.length ?? 0})</span>
              </h2>
              {opportunities?.length ? (
                <div className="space-y-4">
                  {opportunities.map((opp) => (
                    <div key={opp.id} className="border border-border rounded-xl p-5 bg-card">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="font-semibold text-sm leading-snug">{opp.title}</h3>
                        <div className="flex-shrink-0 text-right">
                          <p className={`font-mono font-bold text-xl ${scoreColor(opp.opportunity_score)}`}>{opp.opportunity_score}</p>
                          <p className="text-xs text-muted-foreground">score</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                        {opp.investment_thesis}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs border border-border rounded px-2 py-0.5 text-muted-foreground">{opp.category}</span>
                        <span className={`text-xs border rounded px-2 py-0.5 font-medium ${opp.risk_level === "low" ? "border-pa-green/30 text-pa-green bg-pa-green/5" : "border-pa-amber/30 text-pa-amber bg-pa-amber/5"}`}>
                          {opp.risk_level} risk
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">No active opportunities scored yet for this market.</p>
                  <p className="text-xs text-muted-foreground mt-1">Opportunity data is being expanded across new markets — check back soon.</p>
                </div>
              )}
            </section>

            {/* Infrastructure projects */}
            <section>
              <h2 className="font-semibold mb-4">
                Infrastructure Projects
                <span className="ml-2 text-xs text-muted-foreground font-normal">({infraProjects?.length ?? 0})</span>
              </h2>
              {infraProjects && infraProjects.length > 0 ? (
                <div className="space-y-3">
                  {(infraProjects as InfrastructureProject[]).map((proj) => (
                    <div key={proj.id} className="border border-border rounded-xl p-4 bg-card">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-medium text-sm">{proj.project_name}</p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs text-muted-foreground capitalize">{proj.type}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className={`text-xs font-medium capitalize ${proj.status === "under_construction" ? "text-pa-amber" : proj.status === "completed" ? "text-pa-green" : "text-muted-foreground"}`}>
                              {proj.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-mono font-semibold ${sc(proj.impact_score)}`}>{proj.impact_score}</p>
                          <p className="text-xs text-muted-foreground">impact</p>
                        </div>
                      </div>
                      {proj.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{proj.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Budget: {formatCurrency(proj.budget / 100, currencyCode)} · Expected: {proj.expected_completion ? new Date(proj.expected_completion).getFullYear() : "TBC"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">No infrastructure projects recorded yet.</p>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Live signals */}
            <div className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">Signals</h3>
                <span className="w-1.5 h-1.5 rounded-full bg-pa-green animate-pulse" />
              </div>
              <div className="divide-y divide-border">
                {signals?.length ? (
                  (signals as Signal[]).map((sig) => (
                    <div key={sig.id} className="p-4">
                      <p className="text-xs font-medium leading-snug mb-1">{sig.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{sig.summary}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{sig.source}</span>
                        <span className={`text-xs font-mono font-semibold ${sc(sig.opportunity_impact)}`}>
                          +{sig.opportunity_impact}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-xs text-muted-foreground">No signals recorded yet for this market.</p>
                )}
              </div>
            </div>

            {/* Planning activity */}
            {planningApps && planningApps.length > 0 ? (
              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="font-semibold text-sm">Planning Activity</h3>
                </div>
                <div className="divide-y divide-border">
                  {planningApps.map((app) => (
                    <div key={app.id} className="p-4">
                      <p className="text-xs font-medium capitalize">{app.project_type} · {app.description?.slice(0, 60)}…</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium ${app.status === "approved" ? "text-pa-green" : app.status === "rejected" ? "text-pa-red" : "text-pa-amber"}`}>
                          {app.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{new Date(app.application_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Watchlist CTA */}
            <div className="border border-pa-green/20 rounded-xl p-4 bg-pa-green/5">
              <p className="text-sm font-semibold mb-1">Watch {municipality.name}</p>
              <p className="text-xs text-muted-foreground mb-3">Get alerts when new signals, planning applications, or infrastructure projects are detected.</p>
              <Link href="/auth/signup" className="block text-center bg-primary text-white font-semibold text-xs py-2 rounded-lg hover:bg-primary/85 transition-colors">
                Start free — add to Watchlist
              </Link>
            </div>

            {/* Back to Deal Board */}
            <Link
              href="/deal-board"
              className="block text-center border border-border rounded-xl py-3 text-xs text-muted-foreground hover:text-pa-green hover:border-pa-green/40 transition-colors"
            >
              ← Back to Deal Board
            </Link>
          </div>
        </div>

        {/* Live Listings */}
        {listings && listings.length > 0 && (
          <section className="mt-10 border-t border-border pt-10">
            <LiveListings
              listings={listings as Listing[]}
              marketContext={{
                name:              municipality.name,
                slug:              municipality.slug ?? "",
                country:           country,
                opportunity_score: municipality.opportunity_score,
                growth_score:      municipality.growth_score,
                risk_score:        municipality.risk_score,
              }}
              heading={`Live Listings · ${municipality.name}`}
              showMarketLink
            />
          </section>
        )}

        {/* Footer links */}
        <section className="mt-12 pt-8 border-t border-border">
          <h2 className="font-semibold text-sm mb-4">Explore more</h2>
          <div className="flex gap-3 flex-wrap">
            <Link href="/deal-board"              className="text-xs text-pa-green hover:underline">Global Opportunity Index →</Link>
            <Link href="/rankings/coastal"        className="text-xs text-pa-green hover:underline">Coastal Growth Index →</Link>
            <Link href="/rankings/infrastructure" className="text-xs text-pa-green hover:underline">Infrastructure Impact Index →</Link>
            <Link href="/opportunities"           className="text-xs text-pa-green hover:underline">All Opportunities →</Link>
          </div>
        </section>
      </main>
    </>
  );
}
