import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { scoreColor } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "prime-atlas | Real Estate Investment Opportunity Intelligence",
  description:
    "Ranked composite scores for property and development markets across the UK, US, Australia, and Canada. Based on publicly available planning data, price indices, rental growth, and infrastructure pipelines.",
};

const CATEGORIES = [
  { label: "Build-to-Rent (BTR)",   href: "/opportunities?category=BTR",               icon: "🏢", desc: "Purpose-built residential rental schemes" },
  { label: "Student Housing (PBSA)",href: "/opportunities?category=PBSA",              icon: "🎓", desc: "Purpose-built student accommodation" },
  { label: "Affordable Housing",    href: "/opportunities?category=Affordable+Housing", icon: "🏘", desc: "Subsidised and mixed-tenure residential" },
  { label: "Commercial",            href: "/opportunities?category=Commercial",         icon: "🏬", desc: "Office, retail, and hospitality" },
  { label: "Industrial",            href: "/opportunities?category=Industrial",         icon: "🏭", desc: "Warehouse, logistics, and manufacturing" },
  { label: "Mixed-use",             href: "/opportunities?category=Mixed-use",          icon: "⬛", desc: "Residential above commercial" },
];

const DATA_SOURCES = [
  { flag: "🇬🇧", label: "United Kingdom",  sources: "HM Land Registry · ONS · NHBC · Homes England" },
  { flag: "🇺🇸", label: "United States",   sources: "US Census BPS · NAR · HUD · CoStar public data" },
  { flag: "🇦🇺", label: "Australia",        sources: "ABS Building Approvals · NHFIC · CoreLogic proxies" },
  { flag: "🇨🇦", label: "Canada",           sources: "CMHC Housing Starts · CREA · Statistics Canada" },
  { flag: "🇪🇸", label: "Spain",            sources: "Catastro · INE · Ministerio de Fomento" },
];

const WHAT_IT_IS = [
  {
    title: "Composite Opportunity Scores",
    body: "Each market is scored 0–100 on five dimensions: growth momentum, infrastructure pipeline, development permissiveness, liquidity, and risk. Scores are compiled from publicly available data and updated periodically.",
    icon: "⬡",
  },
  {
    title: "Planning & Infrastructure Signals",
    body: "Major employer relocations, approved infrastructure projects, and planning application activity are tracked per city and surfaced as actionable signals — with source attribution to the original government or regulatory announcement.",
    icon: "📡",
  },
  {
    title: "Development Pro-Forma",
    body: "Build out a deal on any market in the Deal Board: enter units, gross square footage, hard costs, land cost, and rent assumptions — and get live yield-on-cost and margin-on-cost calculations.",
    icon: "⊞",
  },
  {
    title: "IC Memo Export",
    body: "One click exports a structured CSV investment committee memo covering scores, pro-forma outputs, and the evidence layers you've reviewed.",
    icon: "↗",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: topMunicipalities }, { data: recentSignals }, { data: recentOpps }] = await Promise.all([
    supabase
      .from("municipalities")
      .select("id, name, region, country, slug, opportunity_score, growth_score, development_score")
      .order("opportunity_score", { ascending: false })
      .limit(6),
    supabase
      .from("signals")
      .select("id, title, signal_type, opportunity_impact, detected_at, municipalities(name, country)")
      .order("detected_at", { ascending: false })
      .limit(4),
    supabase
      .from("opportunities")
      .select("id, title, category, opportunity_score, risk_level, municipalities(name, country, slug)")
      .eq("status", "active")
      .order("opportunity_score", { ascending: false })
      .limit(4),
  ]);

  const countryFlag: Record<string, string> = {
    "United Kingdom": "🇬🇧",
    "United States":  "🇺🇸",
    "Australia":      "🇦🇺",
    "Canada":         "🇨🇦",
    "Spain":          "🇪🇸",
  };

  const signalTypeLabel: Record<string, string> = {
    infrastructure_approved: "Infrastructure",
    employer_relocating:     "Employer",
    planning_application:    "Planning",
    transport_link:          "Transport",
    development_zone:        "Dev Zone",
    government_investment:   "Gov Investment",
    university_announced:    "University",
    utility_expansion:       "Utility",
  };

  return (
    <>
      <Navbar user={user} />

      <main>
        {/* ── Hero ── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 border border-pa-green/30 bg-pa-green/5 text-pa-green text-xs font-mono px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-pa-green animate-pulse" />
            58 markets tracked · UK · US · AU · CA · ES
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
            Real Estate Opportunity{" "}
            <span className="text-pa-green">Intelligence</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Ranked composite scores for property and development markets across five countries —
            built from publicly available planning data, price indices, rental growth metrics,
            and infrastructure pipelines.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/deal-board" className="bg-pa-green text-pa-navy font-semibold px-8 py-3 rounded-lg hover:bg-pa-green/90 transition-colors text-sm">
              Open Deal Board
            </Link>
            <Link href="/auth/signup" className="border border-border text-foreground px-8 py-3 rounded-lg hover:bg-secondary transition-colors text-sm">
              Create free account
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            No credit card · Free tier includes 5 markets per country
          </p>
        </section>

        {/* ── What prime-atlas actually is ── */}
        <section className="border-t border-b border-border py-14 bg-secondary/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest text-center mb-2">What it is</p>
            <h2 className="text-2xl font-bold text-center mb-10">A scored, ranked index of real estate opportunity markets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WHAT_IT_IS.map((item) => (
                <div key={item.title} className="border border-border rounded-xl p-5 bg-card">
                  <p className="text-2xl mb-3">{item.icon}</p>
                  <p className="font-semibold text-sm mb-2">{item.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>

            {/* Honest disclaimer */}
            <div className="mt-6 p-4 border border-border/50 rounded-xl bg-card/50 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">About the scores.</strong> Sub-scores (growth, infrastructure, development, liquidity, risk)
              are manually researched composite indexes compiled from the data sources listed below. They are not generated by
              machine learning and are not predictive models. The Deal Board pro-forma is a standard discounted cash flow calculator —
              all inputs and assumptions are set by you. Scores are updated periodically as underlying data changes.
            </div>
          </div>
        </section>

        {/* ── Top-ranked markets ── */}
        <section className="border-b border-border py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-1">Current rankings</p>
                <h2 className="text-2xl font-bold">Top-ranked markets</h2>
              </div>
              <Link href="/deal-board" className="text-sm text-pa-green hover:underline">
                All 58 markets →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topMunicipalities?.map((m, i) => (
                <Link
                  key={m.id}
                  href={`/opportunities/${m.slug}`}
                  className="border border-border rounded-xl p-5 bg-card hover:border-pa-green/40 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono mb-0.5">
                        {countryFlag[m.country] ?? "🌍"} {m.region}
                      </p>
                      <p className="font-semibold text-sm group-hover:text-pa-green transition-colors">{m.name}</p>
                    </div>
                    <span className={`text-2xl font-bold font-mono ${scoreColor(m.opportunity_score)}`}>
                      {m.opportunity_score}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Growth <strong className="text-foreground">{m.growth_score}</strong></span>
                    <span>Dev <strong className="text-foreground">{m.development_score}</strong></span>
                    <span className="ml-auto font-mono">#{i + 1}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live signals ── */}
        {recentSignals && recentSignals.length > 0 && (
          <section className="border-b border-border py-14 bg-secondary/20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Market signals</p>
                </div>
                <Link href="/signals" className="text-xs text-pa-green hover:underline">View all →</Link>
              </div>
              <div className="space-y-3">
                {recentSignals.map((sig) => {
                  const muni = sig.municipalities as { name: string; country: string } | null;
                  return (
                    <div key={sig.id} className="flex items-center justify-between border border-border rounded-xl px-5 py-3.5 bg-card">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                            {signalTypeLabel[sig.signal_type] ?? sig.signal_type}
                          </span>
                          {muni && <span className="text-[10px] text-muted-foreground">{countryFlag[muni.country] ?? ""} {muni.name}</span>}
                        </div>
                        <p className="text-sm font-medium leading-snug truncate">{sig.title}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-pa-green font-mono font-bold text-sm">+{sig.opportunity_impact}</p>
                        <p className="text-[10px] text-muted-foreground">impact pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Browse by category ── */}
        <section className="border-b border-border py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest text-center mb-2">Browse opportunities</p>
            <h2 className="text-2xl font-bold text-center mb-8">By property category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="border border-border rounded-xl p-4 bg-card hover:border-pa-green/40 transition-colors group"
                >
                  <p className="text-2xl mb-2">{cat.icon}</p>
                  <p className="font-semibold text-sm group-hover:text-pa-green transition-colors mb-1">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Latest opportunities ── */}
        {recentOpps && recentOpps.length > 0 && (
          <section className="border-b border-border py-14 bg-secondary/20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Active Opportunities</h2>
                <Link href="/opportunities" className="text-sm text-pa-green hover:underline">Browse all →</Link>
              </div>
              <div className="space-y-3">
                {recentOpps.map((opp) => {
                  const muni = opp.municipalities as { name: string; country: string; slug: string } | null;
                  return (
                    <Link
                      key={opp.id}
                      href={muni ? `/opportunities/${muni.slug}` : "/opportunities"}
                      className="flex items-center justify-between border border-border rounded-xl px-5 py-3.5 bg-card hover:border-pa-green/40 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground font-mono">{opp.category}</span>
                          <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${opp.risk_level === "low" ? "text-pa-green" : "text-pa-amber"}`}>
                            {opp.risk_level} risk
                          </span>
                          {muni && <span className="text-[10px] text-muted-foreground">{countryFlag[muni.country] ?? ""} {muni.name}</span>}
                        </div>
                        <p className="text-sm font-medium leading-snug group-hover:text-pa-green transition-colors truncate">{opp.title}</p>
                      </div>
                      <p className={`flex-shrink-0 ml-4 text-xl font-bold font-mono ${scoreColor(opp.opportunity_score)}`}>
                        {opp.opportunity_score}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Data sources ── */}
        <section className="border-b border-border py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest text-center mb-2">Data sources</p>
            <h2 className="text-2xl font-bold text-center mb-8">Built from official public data</h2>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {DATA_SOURCES.map((ds) => (
                <div key={ds.label} className="text-center">
                  <p className="text-3xl mb-2">{ds.flag}</p>
                  <p className="text-xs font-semibold mb-1">{ds.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{ds.sources}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free report CTA ── */}
        <section className="border-b border-border py-14 bg-secondary/20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">Free quarterly report</p>
            <h2 className="text-2xl font-bold mb-4">
              The 25 Most Undersupplied Multifamily Submarkets — Q2 2026
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-xl mx-auto">
              Ranked by ROI Feasibility Index. Covers UK, US, Australia, and Canada. Free, ungated, and updated quarterly.
            </p>
            <Link
              href="/reports/undersupplied-markets"
              className="inline-block bg-pa-green text-pa-navy font-semibold px-8 py-3 rounded-lg hover:bg-pa-green/90 transition-colors text-sm"
            >
              Read the report →
            </Link>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-20 text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold mb-4">
              Start with a free account
            </h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              Access the Deal Board, browse opportunities by category, export IC memos, and track market signals
              across the UK, US, Australia, and Canada.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/signup" className="inline-block bg-pa-green text-pa-navy font-semibold px-8 py-3 rounded-lg hover:bg-pa-green/90 transition-colors text-sm">
                Get access — free
              </Link>
              <Link href="/deal-board" className="inline-block border border-border text-foreground px-8 py-3 rounded-lg hover:bg-secondary transition-colors text-sm">
                Browse Deal Board →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
