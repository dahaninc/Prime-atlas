import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { scoreColor } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "prime-atlas | Go/no-go in 10 minutes. IC memo in one click.",
  description:
    "Prime Atlas compresses time-to-defensible-conviction on real estate sites from weeks of analyst labour to ten minutes you can defend. Pre-screened pipeline, preliminary underwrite, one-click IC memo — across UK, US, Australia, Canada, and Spain.",
};

const WORKFLOW = [
  {
    step: "01",
    title: "Pre-screened pipeline",
    body: "80+ markets ranked by ROI Feasibility Index across five conviction dimensions: growth momentum, development permissiveness, infrastructure pipeline, liquidity, and risk. Sourced from official planning portals — not black-box models.",
    cta: { label: "Open Deal Board", href: "/deal-board" },
  },
  {
    step: "02",
    title: "Preliminary underwrite in the board",
    body: "Select any market and run a live DCF: units, gross square footage, hard cost, land cost, rent assumptions. Yield-on-cost and margin-on-cost recalculate instantly. No spreadsheet, no waiting for an analyst to build the model.",
    cta: null,
  },
  {
    step: "03",
    title: "One-click IC memo — defended, sourced, exportable",
    body: "Export a structured CSV covering scores, source attribution, pro-forma outputs, and the conviction checklist you reviewed. The same day the deal comes in. Before your competitor's analyst has finished pulling zoning.",
    cta: null,
  },
];

const PAIN_POINTS = [
  {
    label: "The clock",
    icon: "⏱",
    body: "Off-market sites move in days. Every hour you spend manually stitching zoning, comps, absorption, and build cost from four fragmented sources is an hour a competitor's offer sits on the vendor's desk.",
  },
  {
    label: "The burn",
    icon: "$",
    body: "Late-stage diligence kills deals after £30–60K in fees. Almost every deal that dies late is one that wasn't pre-screened properly. The cost isn't the diligence — it's that you got there too late to know you shouldn't have started.",
  },
  {
    label: "The committee",
    icon: "◉",
    body: "An IC won't approve a deal you can't defend in writing. Manual builds take days. By then the window has closed, the site is in exclusivity, or the committee has moved on to something they can hold.",
  },
];

const DATA_SOURCES = [
  { flag: "🇬🇧", label: "United Kingdom", sources: "HM Land Registry · ONS · NHBC · Homes England · GLA" },
  { flag: "🇺🇸", label: "United States",  sources: "US Census BPS · NAR · HUD · NYC DoB · LA Planning" },
  { flag: "🇦🇺", label: "Australia",       sources: "ABS Building Approvals · NSW Planning · Housing Australia" },
  { flag: "🇨🇦", label: "Canada",          sources: "CMHC Housing Starts · CREA · BC Housing · Toronto Housing" },
  { flag: "🇪🇸", label: "Spain",           sources: "Ministerio de Fomento · INE · Catastro · Comunidad de Madrid" },
];

const CATEGORIES = [
  { label: "Build-to-Rent",      href: "/opportunities?category=BTR",               icon: "🏢" },
  { label: "Student Housing",    href: "/opportunities?category=PBSA",              icon: "🎓" },
  { label: "Affordable Housing", href: "/opportunities?category=Affordable+Housing", icon: "🏘" },
  { label: "Commercial Office",  href: "/opportunities?category=Commercial",         icon: "🏬" },
  { label: "Industrial",         href: "/opportunities?category=Industrial",         icon: "🏭" },
  { label: "Mixed-use",          href: "/opportunities?category=Mixed-use",          icon: "⬛" },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: topMunicipalities }, { data: recentSignals }, { data: recentOpps }] = await Promise.all([
    supabase
      .from("municipalities")
      .select("id, name, region, country, slug, opportunity_score, growth_score, development_score, risk_score")
      .order("opportunity_score", { ascending: false })
      .limit(6),
    supabase
      .from("signals")
      .select("id, title, signal_type, opportunity_impact, detected_at, municipalities(name, country)")
      .order("detected_at", { ascending: false })
      .limit(3),
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
    employer_relocating:     "Employer move",
    planning_application:    "Planning",
    transport_link:          "Transport",
    development_zone:        "Dev Zone",
    government_investment:   "Gov investment",
    university_announced:    "University",
    utility_expansion:       "Utility",
  };

  return (
    <>
      <Navbar user={user} />

      <main>

        {/* ── Hero ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 sm:pb-20">
          <div className="inline-flex items-center gap-2 border border-pa-green/30 bg-pa-green/5 text-pa-green text-xs font-mono px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-pa-green animate-pulse" />
            80+ markets · UK · US · AU · CA · ES
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6 max-w-3xl">
            Go/no-go in 10 minutes.{" "}
            <span className="text-pa-green">IC memo in one click.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-4 leading-relaxed">
            Funds and developers already have CoStar, parcel data, and demographics.
            The bottleneck isn't data — it's getting to a <strong className="text-foreground">defensible conviction</strong> before the off-market window closes.
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Prime Atlas compresses three weeks of analyst time stitching zoning, comps, build cost, and absorption
            to ten minutes you can put in front of a committee.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Link href="/deal-board" className="bg-pa-green text-pa-navy font-semibold px-8 py-3.5 rounded-lg hover:bg-pa-green/90 transition-colors text-sm text-center">
              Open the Deal Board →
            </Link>
            <Link href="/auth/signup" className="border border-border text-foreground px-8 py-3.5 rounded-lg hover:bg-secondary transition-colors text-sm text-center">
              Create free account
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Free tier · No credit card · 5 markets per country included
          </p>
        </section>

        {/* ── The problem ── */}
        <section className="border-t border-b border-border py-14 bg-secondary/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">The bottleneck</p>
            <h2 className="text-2xl font-bold mb-2">You don't have a data problem. You have a conviction-and-latency problem.</h2>
            <p className="text-sm text-muted-foreground mb-10 max-w-2xl leading-relaxed">
              To decide whether a site is worth the £30–60K and weeks of analyst time that real diligence costs,
              you have to manually stitch together zoning, comps, build cost, demand, and absorption from fragmented,
              differently-formatted sources. And even then, you often can't defend the number cleanly enough to put it in front of a committee.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PAIN_POINTS.map((p) => (
                <div key={p.label} className="border border-border rounded-xl p-5 bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded border border-border flex items-center justify-center text-xs font-mono text-muted-foreground">{p.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{p.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── The workflow ── */}
        <section className="border-b border-border py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">How it works</p>
            <h2 className="text-2xl font-bold mb-10">From deal board to IC memo — same day, defensible in writing</h2>
            <div className="space-y-4">
              {WORKFLOW.map((step) => (
                <div key={step.step} className="border border-border rounded-xl p-6 bg-card flex flex-col sm:flex-row gap-5">
                  <div className="flex-shrink-0">
                    <span className="text-xs font-mono text-pa-green border border-pa-green/30 rounded px-2 py-1">{step.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-2">{step.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{step.body}</p>
                    {step.cta && (
                      <Link href={step.cta.href} className="text-xs text-pa-green hover:underline">
                        {step.cta.label} →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 border border-border/50 rounded-xl bg-card/50 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">About the scores.</strong>{" "}
              Sub-scores (growth, infrastructure, development, liquidity, risk) are manually-researched composite indexes compiled from the official data sources listed below.
              They are not generated by machine learning. The pro-forma is a standard DCF calculator — all inputs are set by you.
              Nothing in Prime Atlas constitutes investment advice.
            </div>
          </div>
        </section>

        {/* ── Top-ranked markets ── */}
        {topMunicipalities && topMunicipalities.length > 0 && (
          <section className="border-b border-border py-14 bg-secondary/20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-1">Pre-screened pipeline</p>
                  <h2 className="text-2xl font-bold">Highest-conviction markets right now</h2>
                </div>
                <Link href="/deal-board" className="text-sm text-pa-green hover:underline whitespace-nowrap">
                  Full pipeline →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topMunicipalities.map((m, i) => (
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
                      <div className="text-right">
                        <span className={`text-2xl font-bold font-mono ${scoreColor(m.opportunity_score)}`}>
                          {m.opportunity_score}
                        </span>
                        <p className="text-[9px] text-muted-foreground">ROI index</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Growth <strong className="text-foreground">{m.growth_score}</strong></span>
                      <span>Dev <strong className="text-foreground">{m.development_score}</strong></span>
                      <span className={`ml-auto text-[10px] font-medium ${m.risk_score <= 40 ? "text-pa-green" : m.risk_score <= 55 ? "text-pa-amber" : "text-red-400"}`}>
                        risk {m.risk_score}
                      </span>
                      <span className="font-mono text-[10px]">#{i + 1}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Active opportunities ── */}
        {recentOpps && recentOpps.length > 0 && (
          <section className="border-b border-border py-14">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-1">Underwrite-ready</p>
                  <h2 className="text-xl font-bold">Active opportunities — sourced &amp; scored</h2>
                </div>
                <Link href="/opportunities" className="text-sm text-pa-green hover:underline">All opportunities →</Link>
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
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground font-mono">{opp.category}</span>
                          <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${opp.risk_level === "low" ? "text-pa-green" : opp.risk_level === "medium" ? "text-pa-amber" : "text-red-400"}`}>
                            {opp.risk_level} risk
                          </span>
                          {muni && <span className="text-[10px] text-muted-foreground">{countryFlag[muni.country] ?? ""} {muni.name}</span>}
                        </div>
                        <p className="text-sm font-medium leading-snug group-hover:text-pa-green transition-colors truncate">{opp.title}</p>
                      </div>
                      <div className="flex-shrink-0 ml-4 text-right">
                        <p className={`text-xl font-bold font-mono ${scoreColor(opp.opportunity_score)}`}>
                          {opp.opportunity_score}
                        </p>
                        <p className="text-[9px] text-muted-foreground">score</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Signals ── */}
        {recentSignals && recentSignals.length > 0 && (
          <section className="border-b border-border py-14 bg-secondary/20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Conviction signals</p>
                  <p className="text-xs text-muted-foreground">Major employer moves, infrastructure approvals, and planning decisions that change a market's score</p>
                </div>
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
                        <p className="text-[10px] text-muted-foreground">conviction pts</p>
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
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest text-center mb-2">Browse by format</p>
            <h2 className="text-2xl font-bold text-center mb-8">Pre-screened by property category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="border border-border rounded-xl p-4 bg-card hover:border-pa-green/40 transition-colors group flex items-center gap-3"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-semibold text-sm group-hover:text-pa-green transition-colors">{cat.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Auditable data sources ── */}
        <section className="border-b border-border py-14 bg-secondary/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest text-center mb-2">Auditable sources</p>
            <h2 className="text-2xl font-bold text-center mb-3">Every score is traceable to a named government source</h2>
            <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              An IC will ask where your numbers come from. Every score, signal, and opportunity in Prime Atlas links back to the original planning portal, official housing authority, or statistical body — not a model you can't explain.
            </p>
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

        {/* ── Free report ── */}
        <section className="border-b border-border py-14">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">Free quarterly report</p>
            <h2 className="text-2xl font-bold mb-4">
              The 25 Most Undersupplied Multifamily Submarkets — Q2 2026
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-xl mx-auto">
              Ranked by ROI Feasibility Index. Covers UK, US, Australia, and Canada. Free, ungated, sourced from official data.
            </p>
            <Link
              href="/reports/undersupplied-markets"
              className="inline-block border border-pa-green/40 text-pa-green px-8 py-3 rounded-lg hover:bg-pa-green/10 transition-colors text-sm font-semibold"
            >
              Read the report →
            </Link>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-20">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-4">Start compressing your conviction timeline</p>
            <h2 className="text-3xl font-bold mb-4">
              Know which sites are worth your committee's time.<br/>
              <span className="text-pa-green">Before your competitor's analyst finishes pulling zoning.</span>
            </h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed max-w-lg mx-auto">
              Free tier includes the full Deal Board, preliminary underwrite, and pre-screened pipeline across 5 markets per country.
              Pro unlocks all 80+ markets, full evidence layers, and IC memo export.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/signup" className="inline-block bg-pa-green text-pa-navy font-semibold px-8 py-3.5 rounded-lg hover:bg-pa-green/90 transition-colors text-sm">
                Get access — free
              </Link>
              <Link href="/deal-board" className="inline-block border border-border text-foreground px-8 py-3.5 rounded-lg hover:bg-secondary transition-colors text-sm">
                Open Deal Board →
              </Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
