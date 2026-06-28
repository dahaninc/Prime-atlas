import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { scoreColor } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "prime-atlas | Real estate conviction — for every investor, at every scale.",
  description:
    "From retail investors spotting emerging markets early to institutional funds closing deals before competitors build a model. Pre-screened pipeline across 80+ markets, live underwrite, IC memo in one click. UK · US · AU · CA · ES.",
};

/* ─────────────────────────── data ─────────────────────────── */

const STATS = [
  { value: "80+",    label: "Markets pre-screened across 5 countries" },
  { value: "10 min", label: "Deal board → preliminary IC memo" },
  { value: "£50K+",  label: "Avg. cost of a late-aborted diligence process" },
  { value: "100%",   label: "Government-source attribution on every score" },
];

const AUDIENCES = [
  {
    tag: "Individual & retail investors",
    icon: "◎",
    headline: "The analysis funds commission — at your price point.",
    pain:
      "You see a market moving but can't quantify the thesis fast enough before prices reflect it. By the time a research note publishes, the entry window has closed.",
    value: [
      "80+ markets ranked by ROI Feasibility Index",
      "Undersupply signals before they reach mainstream press",
      "Conviction scores sourced from government data — not opinion",
      "Free tier: 5 markets per country, no credit card",
    ],
    cta: { label: "Start free", href: "/auth/signup" },
    border: "border-[#00C805]/30",
    bg: "bg-[#00C805]/[0.03]",
    tagColor: "text-[#00C805]",
    checkColor: "text-[#00C805]",
  },
  {
    tag: "Developers & operators",
    icon: "⬡",
    headline: "Know before you spend £50K on surveys.",
    pain:
      "You're committing to diligence costs before you have high-confidence conviction. Most aborted deals absorb 6–10 weeks of analyst and consultant time before hitting a wall that was visible from day one.",
    value: [
      "Live DCF — units, GSF, land cost, hard cost, yield-on-cost",
      "Planning pipeline and zoning velocity per market",
      "Pre-screened BTR, PBSA, Industrial, Mixed-use pipeline",
      "Go/no-go conviction before the £50K diligence commitment",
    ],
    cta: { label: "Open Deal Board", href: "/deal-board" },
    border: "border-blue-500/30",
    bg: "bg-blue-500/[0.03]",
    tagColor: "text-blue-400",
    checkColor: "text-blue-400",
  },
  {
    tag: "Funds & institutions",
    icon: "▣",
    headline: "IC memo. Same day. Auditable.",
    pain:
      "Your analysts spend 2–3 weeks per site stitching data from eight different sources in formats that don't match. Off-market windows are 72 hours. You are structurally late.",
    value: [
      "Preliminary underwrite ready the moment a deal hits your desk",
      "Conviction checklist — every item linked to a named government source",
      "Exportable IC memo — assumptions traceable, sources cited, committee-ready",
      "Multi-market pipeline ranked by ROI index for allocation decisions",
    ],
    cta: { label: "Book institutional access", href: "/auth/signup?tier=institutional" },
    border: "border-purple-500/30",
    bg: "bg-purple-500/[0.03]",
    tagColor: "text-purple-400",
    checkColor: "text-purple-400",
  },
] as const;

const TIMELINE_WITHOUT = [
  { marker: "Day 1–3",   action: "Manual data pull — CoStar, parcel data, planning portals, census" },
  { marker: "Day 4–7",   action: "Analyst builds financial model from scratch in Excel" },
  { marker: "Day 8–14",  action: "Internal review — assumptions challenged, model rebuilt" },
  { marker: "Day 14–21", action: "IC memo drafted, formatted, circulated for sign-off" },
  { marker: "Day 21+",   action: "Off-market window closed. Vendor in exclusivity with someone else.", bad: true },
];

const TIMELINE_WITH = [
  { marker: "Min 1–5",  action: "Market screened — ROI index, growth, risk scores visible" },
  { marker: "Min 5–10", action: "Preliminary underwrite run — DCF inputs adjusted, yield-on-cost live" },
  { marker: "Min 10–15",action: "Conviction checklist reviewed — signals verified, sources cited" },
  { marker: "Min 15–20",action: "IC memo exported — structured, sourced, defensible in committee" },
  { marker: "Same day", action: "Deal in front of committee. Window open.", good: true },
];

const PAIN_POINTS = [
  {
    label: "Speed",
    icon: "⏱",
    stat: "72 hrs",
    statLabel: "avg. off-market window",
    body: "Off-market sites move in 72 hours. Every hour you spend manually pulling from fragmented sources is an hour a competitor's offer sits on the vendor's desk.",
  },
  {
    label: "Cost",
    icon: "$",
    stat: "£50K+",
    statLabel: "avg. aborted deal cost",
    body: "Late-stage diligence kills deals after £30–60K in fees — surveys, legal, planning consultants. The cost isn't the diligence: it's committing before you had conviction.",
  },
  {
    label: "Committee",
    icon: "◉",
    stat: "3 wks",
    statLabel: "avg. time to IC memo",
    body: "An IC won't approve a deal you can't defend in writing. Manual memo builds take days. By then the site is under offer, or the committee has moved on.",
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Pre-screened deal pipeline",
    body: "80+ markets ranked by ROI Feasibility Index across five conviction dimensions: growth momentum, development permissiveness, infrastructure pipeline, liquidity, and risk. Every score sources back to a named government data portal — nothing you can't explain in committee.",
    cta: { label: "Open Deal Board", href: "/deal-board" },
  },
  {
    step: "02",
    title: "Preliminary underwrite — live, in the browser",
    body: "Select any market and run a DCF immediately: units, gross square footage, hard cost, land cost, rent assumptions. Yield-on-cost and margin-on-cost recalculate in real time. No spreadsheet. No analyst. No waiting.",
    cta: null,
  },
  {
    step: "03",
    title: "IC memo — same day, defensible in writing",
    body: "Export a structured investment memo covering scores, source attribution, pro-forma outputs, and the conviction checklist you reviewed. Every assumption traced to a named source. Ready for committee the same day the deal hits your desk.",
    cta: null,
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
  { label: "Build-to-Rent",      href: "/opportunities?category=BTR",                icon: "🏢" },
  { label: "Student Housing",    href: "/opportunities?category=PBSA",               icon: "🎓" },
  { label: "Affordable Housing", href: "/opportunities?category=Affordable+Housing",  icon: "🏘" },
  { label: "Commercial Office",  href: "/opportunities?category=Commercial",          icon: "🏬" },
  { label: "Industrial",         href: "/opportunities?category=Industrial",          icon: "🏭" },
  { label: "Mixed-use",          href: "/opportunities?category=Mixed-use",           icon: "⬛" },
];

/* ─────────────────────────── page ─────────────────────────── */

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
        <section className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-28 pb-10 sm:pb-16 overflow-hidden">
          {/* Radial glow — signature yellow-green halo */}
          <div
            className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[480px] opacity-[0.15]"
            style={{ background: "radial-gradient(ellipse 60% 60% at 50% 40%, #CCFF00 0%, #00C805 45%, transparent 80%)" }}
          />
          {/* Subtle grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.02]"
            style={{ backgroundImage: "linear-gradient(#A1A1AA 1px, transparent 1px), linear-gradient(90deg, #A1A1AA 1px, transparent 1px)", backgroundSize: "60px 60px" }}
          />

          <div className="relative">
            <div className="inline-flex items-center gap-2 border border-[#00C805]/40 bg-[#00C805]/8 text-[#00C805] text-xs font-mono px-3 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C805] animate-pulse" />
              Live · 80+ markets · UK · US · AU · CA · ES
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-black tracking-tight leading-[1.05] mb-6 max-w-3xl">
              Real estate conviction.{" "}
              <span className="text-[#CCFF00]">For every investor, at every scale.</span>
            </h1>

            <p className="text-lg sm:text-xl text-[#A1A1AA] max-w-2xl mb-4 leading-relaxed">
              From retail investors spotting emerging markets early, to funds closing deals before their
              competitors have a model built — Prime Atlas compresses the time between{" "}
              <strong className="text-white">market interest and defensible commitment</strong>.
            </p>
            <p className="text-base text-[#A1A1AA] max-w-2xl mb-10 leading-relaxed">
              Pre-screened pipeline. Live preliminary underwrite. IC memo in one click.
              Sourced entirely from government data you can name in a committee room.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Link
                href="/deal-board"
                className="bg-[#CCFF00] text-black font-bold px-8 py-3.5 rounded-full hover:opacity-90 transition-all text-sm text-center shadow-[0_0_32px_rgba(204,255,0,0.2)]"
              >
                Open the Deal Board →
              </Link>
              <Link
                href="/auth/signup"
                className="border border-[#27272A] text-white px-8 py-3.5 rounded-full hover:bg-[#18181B] transition-colors text-sm text-center"
              >
                Create free account
              </Link>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Free tier included · No credit card · 5 markets per country
            </p>
          </div>
        </section>

        {/* ── Stat strip ── */}
        <section className="border-t border-b border-[#27272A] bg-[#0C0D14] py-7">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#27272A]">
              {STATS.map((s, i) => (
                <div key={s.value} className={`text-center px-6 ${i === 0 ? "pl-0" : ""}`}>
                  <p className="text-2xl font-black font-mono text-[#CCFF00]">{s.value}</p>
                  <p className="text-xs text-[#A1A1AA] mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Audience cards ── */}
        <section className="border-b border-[#27272A] py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-2 text-center">
              Built for every real estate investor
            </p>
            <h2 className="text-2xl font-black text-center mb-10">
              Your edge — regardless of scale
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {AUDIENCES.map((a) => (
                <div
                  key={a.tag}
                  className={`border ${a.border} ${a.bg} rounded-xl p-6 flex flex-col`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg font-mono text-[#A1A1AA]">{a.icon}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${a.tagColor}`}>
                      {a.tag}
                    </span>
                  </div>
                  <p className="font-bold text-base mb-3 leading-snug">{a.headline}</p>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed mb-6 flex-1">{a.pain}</p>
                  <ul className="space-y-2.5 mb-6">
                    {a.value.map((v) => (
                      <li key={v} className="flex items-start gap-2 text-xs text-[#A1A1AA]">
                        <span className={`${a.checkColor} mt-0.5 flex-shrink-0 font-bold`}>✓</span>
                        {v}
                      </li>
                    ))}
                  </ul>
                  <Link href={a.cta.href} className={`text-xs font-semibold ${a.checkColor} hover:underline`}>
                    {a.cta.label} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Timeline comparison ── */}
        <section className="border-b border-[#27272A] py-16 bg-[#0C0D14]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-2 text-center">
              The conviction gap
            </p>
            <h2 className="text-2xl font-bold text-center mb-2">
              Three weeks compressed to twenty minutes
            </h2>
            <p className="text-sm text-[#A1A1AA] text-center mb-10 max-w-xl mx-auto">
              The analysis is the same. The data is the same. The difference is the infrastructure that assembles it for you.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Without */}
              <div className="border border-[#27272A] rounded-xl overflow-hidden bg-[#18181B]">
                <div className="px-5 py-3 border-b border-[#27272A] bg-[#18181B]">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#A1A1AA]">
                    Without Prime Atlas
                  </p>
                </div>
                <div className="p-5 space-y-3.5">
                  {TIMELINE_WITHOUT.map((row, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-[10px] font-mono text-[#A1A1AA] flex-shrink-0 w-20 mt-0.5">
                        {row.marker}
                      </span>
                      <span className={`text-xs leading-relaxed flex-1 ${"bad" in row && row.bad ? "text-red-400 font-medium" : "text-[#A1A1AA]"}`}>
                        {row.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* With */}
              <div className="border border-[#00C805]/30 rounded-xl overflow-hidden bg-[#00C805]/[0.03]">
                <div className="px-5 py-3 border-b border-[#00C805]/20 bg-[#00C805]/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#00C805]">
                    With Prime Atlas
                  </p>
                </div>
                <div className="p-5 space-y-3.5">
                  {TIMELINE_WITH.map((row, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-[10px] font-mono text-[#00C805] flex-shrink-0 w-20 mt-0.5">
                        {row.marker}
                      </span>
                      <span className={`text-xs leading-relaxed flex-1 ${"good" in row && row.good ? "text-[#00C805] font-medium" : "text-foreground"}`}>
                        {row.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Pain points ── */}
        <section className="border-b border-[#27272A] py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-2">
              The cost of slow conviction
            </p>
            <h2 className="text-2xl font-bold mb-10">
              You don&apos;t have a data problem. You have a conviction-and-latency problem.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PAIN_POINTS.map((p) => (
                <div key={p.label} className="border border-[#27272A] rounded-xl p-5 bg-[#18181B]">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded border border-[#27272A] flex items-center justify-center text-xs font-mono text-[#A1A1AA]">
                        {p.icon}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#A1A1AA]">
                        {p.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold font-mono text-foreground">{p.stat}</p>
                      <p className="text-[9px] text-[#A1A1AA] leading-tight">{p.statLabel}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section className="border-b border-[#27272A] py-16 bg-[#0C0D14]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-2">
              How it works
            </p>
            <h2 className="text-2xl font-bold mb-10">
              From deal board to IC memo — same day, defensible in writing
            </h2>
            <div className="space-y-4">
              {WORKFLOW.map((step) => (
                <div
                  key={step.step}
                  className="border border-[#27272A] rounded-xl p-6 bg-[#18181B] flex flex-col sm:flex-row gap-5"
                >
                  <div className="flex-shrink-0">
                    <span className="text-xs font-mono text-[#00C805] border border-[#00C805]/30 rounded px-2 py-1">
                      {step.step}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-2">{step.title}</p>
                    <p className="text-sm text-[#A1A1AA] leading-relaxed mb-3">{step.body}</p>
                    {step.cta && (
                      <Link href={step.cta.href} className="text-xs text-[#00C805] hover:underline">
                        {step.cta.label} →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 border border-[#27272A]/50 rounded-xl bg-[#18181B]/50 text-xs text-[#A1A1AA] leading-relaxed">
              <strong className="text-foreground">Transparency.</strong>{" "}
              Sub-scores are manually-researched composite indexes compiled from official government data sources listed below.
              They are not black-box ML outputs. The pro-forma is a standard DCF — all inputs are set by you.
              Nothing in Prime Atlas constitutes investment advice.
            </div>
          </div>
        </section>

        {/* ── Top-ranked markets ── */}
        {topMunicipalities && topMunicipalities.length > 0 && (
          <section className="border-b border-[#27272A] py-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-1">
                    Pre-screened pipeline
                  </p>
                  <h2 className="text-2xl font-bold">Highest-conviction markets right now</h2>
                </div>
                <Link href="/deal-board" className="text-sm text-[#00C805] hover:underline whitespace-nowrap">
                  Full pipeline →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topMunicipalities.map((m, i) => (
                  <Link
                    key={m.id}
                    href={`/opportunities/${m.slug}`}
                    className="border border-[#27272A] rounded-xl p-5 bg-[#18181B] hover:border-[#00C805]/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs text-[#A1A1AA] font-mono mb-0.5">
                          {countryFlag[m.country] ?? "🌍"} {m.region}
                        </p>
                        <p className="font-semibold text-sm group-hover:text-[#00C805] transition-colors">
                          {m.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold font-mono ${scoreColor(m.opportunity_score)}`}>
                          {m.opportunity_score}
                        </span>
                        <p className="text-[9px] text-[#A1A1AA]">ROI index</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-[#A1A1AA]">
                      <span>Growth <strong className="text-foreground">{m.growth_score}</strong></span>
                      <span>Dev <strong className="text-foreground">{m.development_score}</strong></span>
                      <span
                        className={`ml-auto text-[10px] font-medium ${
                          m.risk_score <= 40
                            ? "text-[#00C805]"
                            : m.risk_score <= 55
                            ? "text-[#F5A623]"
                            : "text-red-400"
                        }`}
                      >
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
          <section className="border-b border-[#27272A] py-16 bg-[#0C0D14]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-1">
                    Underwrite-ready
                  </p>
                  <h2 className="text-xl font-bold">Active opportunities — sourced &amp; scored</h2>
                </div>
                <Link href="/opportunities" className="text-sm text-[#00C805] hover:underline">
                  All opportunities →
                </Link>
              </div>
              <div className="space-y-3">
                {recentOpps.map((opp) => {
                  const muni = opp.municipalities as { name: string; country: string; slug: string } | null;
                  return (
                    <Link
                      key={opp.id}
                      href={muni ? `/opportunities/${muni.slug}` : "/opportunities"}
                      className="flex items-center justify-between border border-[#27272A] rounded-xl px-5 py-3.5 bg-[#18181B] hover:border-[#00C805]/40 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-[10px] border border-[#27272A] rounded px-1.5 py-0.5 text-[#A1A1AA] font-mono">
                            {opp.category}
                          </span>
                          <span
                            className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                              opp.risk_level === "low"
                                ? "text-[#00C805]"
                                : opp.risk_level === "medium"
                                ? "text-[#F5A623]"
                                : "text-red-400"
                            }`}
                          >
                            {opp.risk_level} risk
                          </span>
                          {muni && (
                            <span className="text-[10px] text-[#A1A1AA]">
                              {countryFlag[muni.country] ?? ""} {muni.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug group-hover:text-[#00C805] transition-colors truncate">
                          {opp.title}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4 text-right">
                        <p className={`text-xl font-bold font-mono ${scoreColor(opp.opportunity_score)}`}>
                          {opp.opportunity_score}
                        </p>
                        <p className="text-[9px] text-[#A1A1AA]">score</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Conviction signals ── */}
        {recentSignals && recentSignals.length > 0 && (
          <section className="border-b border-[#27272A] py-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00C805] animate-pulse" />
                <div>
                  <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest">
                    Conviction signals
                  </p>
                  <p className="text-xs text-[#A1A1AA]">
                    Employer moves, infrastructure approvals, and planning decisions that materially change a market&apos;s conviction score
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {recentSignals.map((sig) => {
                  const muni = sig.municipalities as { name: string; country: string } | null;
                  return (
                    <div
                      key={sig.id}
                      className="flex items-center justify-between border border-[#27272A] rounded-xl px-5 py-3.5 bg-[#18181B]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-[#A1A1AA] border border-[#27272A] rounded px-1.5 py-0.5">
                            {signalTypeLabel[sig.signal_type] ?? sig.signal_type}
                          </span>
                          {muni && (
                            <span className="text-[10px] text-[#A1A1AA]">
                              {countryFlag[muni.country] ?? ""} {muni.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug truncate">{sig.title}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-[#00C805] font-mono font-bold text-sm">+{sig.opportunity_impact}</p>
                        <p className="text-[10px] text-[#A1A1AA]">conviction pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Browse by category ── */}
        <section className="border-b border-[#27272A] py-16 bg-[#0C0D14]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest text-center mb-2">
              Browse by asset class
            </p>
            <h2 className="text-2xl font-bold text-center mb-8">Pre-screened by property category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="border border-[#27272A] rounded-xl p-4 bg-[#18181B] hover:border-[#00C805]/40 transition-colors group flex items-center gap-3"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="font-semibold text-sm group-hover:text-[#00C805] transition-colors">
                    {cat.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Auditable data sources ── */}
        <section className="border-b border-[#27272A] py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest text-center mb-2">
              Auditable sources
            </p>
            <h2 className="text-2xl font-bold text-center mb-3">
              Every score is traceable to a named government source
            </h2>
            <p className="text-sm text-[#A1A1AA] text-center mb-10 max-w-2xl mx-auto">
              An IC will ask where your numbers come from. Every score, signal, and opportunity in Prime Atlas
              links back to the original planning portal, official housing authority, or statistical body —
              not a model you can&apos;t explain.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
              {DATA_SOURCES.map((ds) => (
                <div key={ds.label} className="text-center">
                  <p className="text-3xl mb-2">{ds.flag}</p>
                  <p className="text-xs font-semibold mb-1">{ds.label}</p>
                  <p className="text-[10px] text-[#A1A1AA] leading-relaxed">{ds.sources}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free report ── */}
        <section className="border-b border-[#27272A] py-16 bg-[#0C0D14]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-3">
              Free quarterly report
            </p>
            <h2 className="text-2xl font-bold mb-4">
              The 25 Most Undersupplied Multifamily Submarkets — Q2 2026
            </h2>
            <p className="text-sm text-[#A1A1AA] mb-6 leading-relaxed max-w-xl mx-auto">
              Ranked by ROI Feasibility Index. Covers UK, US, Australia, and Canada.
              Free, ungated, sourced from official data.
            </p>
            <Link
              href="/reports/undersupplied-markets"
              className="inline-block border border-[#00C805]/40 text-[#00C805] px-8 py-3 rounded-full hover:bg-[#00C805]/10 transition-colors text-sm font-semibold"
            >
              Read the report →
            </Link>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative py-28 overflow-hidden">
          {/* Bottom glow */}
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-[0.12]"
            style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, #CCFF00 0%, #00C805 50%, transparent 80%)" }}
          />
          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest mb-5">
              Start compressing your conviction timeline
            </p>
            <h2 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">
              The deal you miss because you were slow.<br />
              The deal that dies because you committed too early.{" "}
              <span className="text-[#CCFF00]">Prime Atlas ends both.</span>
            </h2>
            <p className="text-[#A1A1AA] text-sm mb-8 leading-relaxed max-w-lg mx-auto">
              Free tier: full Deal Board, preliminary underwrite, pre-screened pipeline across 5 markets per country.
              Pro: all 80+ markets, full evidence layers, IC memo export.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Link
                href="/auth/signup"
                className="inline-block bg-[#CCFF00] text-black font-bold px-8 py-3.5 rounded-full hover:opacity-90 transition-all text-sm shadow-[0_0_32px_rgba(204,255,0,0.2)]"
              >
                Get access — free
              </Link>
              <Link
                href="/deal-board"
                className="inline-block border border-[#27272A] text-white px-8 py-3.5 rounded-full hover:bg-[#18181B] transition-colors text-sm"
              >
                Open Deal Board →
              </Link>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              No credit card required · Upgrade or cancel at any time
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
