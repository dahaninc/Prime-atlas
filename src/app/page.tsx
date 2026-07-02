import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { scoreColor } from "@/lib/utils";
import { AtlasGlobe } from "@/components/home/AtlasGlobe";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "prime-atlas | Real estate conviction — for every investor, at every scale.",
  description:
    "From retail investors spotting emerging markets early to institutional funds closing deals before competitors build a model. Pre-screened pipeline across USA and UK, live underwrite, IC memo in one click.",
};

/* ─────────────────────────── data ─────────────────────────── */

const STATS = [
  { value: "58+",    label: "Markets pre-screened · USA + UK" },
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
    body: "58+ markets across USA and UK ranked by ROI Feasibility Index across five conviction dimensions: growth momentum, development permissiveness, infrastructure pipeline, liquidity, and risk. Every score sources back to a named government data portal — nothing you can't explain in committee.",
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
  { flag: "🇬🇧", label: "United Kingdom", sources: "HM Land Registry · ONS · NHBC · Homes England · GLA · Rightmove" },
  { flag: "🇺🇸", label: "United States",  sources: "US Census BPS · NAR · HUD · NYC DoB · LA Planning · Zillow" },
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
      .select("id, name, region, country, slug, opportunity_score, growth_score, development_score, risk_score, infrastructure_score, liquidity_score, population, currency_code")
      .in("country", ["United Kingdom", "United States"])
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

        {/* ══ HERO — Robinhood layout: cream bg, serif headline, atlas globe right ══ */}
        <section
          className="relative overflow-hidden"
          style={{ background: "#F5F5EF", minHeight: "calc(100vh - 64px)" }}
        >
          {/* Subtle topographic texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: "radial-gradient(circle, #5A5A4A 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-4 items-center min-h-[calc(100vh-64px)]">

            {/* ── Left: copy ── */}
            <div className="order-2 lg:order-1 z-10">
              {/* Pre-label — mirrors "Robinhood Presents" */}
              <div className="flex items-center gap-2 mb-7">
                <span className="text-sm font-semibold text-black/50 tracking-wide">prime-atlas</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C805] animate-pulse" />
                <span className="text-sm text-black/40">Real estate intelligence</span>
              </div>

              {/* Serif headline — editorial weight, Newsreader */}
              <h1 className="font-serif text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[1.03] tracking-[-0.02em] text-black mb-6 max-w-[540px] text-balance">
                The real estate atlas.{" "}
                <span className="italic font-semibold">Redrawn.</span>
              </h1>

              <p className="text-lg text-black/55 max-w-[460px] mb-8 leading-relaxed text-pretty">
                80+ markets pre-screened. Live underwrite. IC memo same day.
                Sourced from government data you can name in committee.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <Link
                  href="/deal-board"
                  className="inline-flex items-center justify-center bg-[#CCFF00] text-black font-bold px-8 py-3.5 rounded-full hover:opacity-90 active:scale-[0.98] transition-all text-sm"
                >
                  Open the Deal Board
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center border border-black/20 text-black px-8 py-3.5 rounded-full hover:bg-black/5 transition-colors text-sm"
                >
                  Create free account
                </Link>
              </div>
              <p className="text-xs text-black/35">
                Free tier · No credit card · 5 markets per country
              </p>

              {/* Country strip */}
              <div className="flex items-center gap-3 mt-8 flex-wrap">
                {["🇬🇧 UK", "🇺🇸 US"].map(c => (
                  <span key={c} className="text-xs text-black/40 font-medium">{c}</span>
                ))}
              </div>
            </div>

            {/* ── Right: atlas globe ── */}
            <div className="order-1 lg:order-2 flex items-center justify-center lg:justify-end">
              <AtlasGlobe />
            </div>
          </div>
        </section>

        {/* ── Stat strip — monoblock: no dividers, generous spacing ── */}
        <section className="py-20 bg-black">
          <div className="max-w-4xl mx-auto px-8 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-8">
              {STATS.map((s) => (
                <div key={s.value} className="text-center">
                  <p className="text-5xl font-black tabular-nums text-[#CCFF00] leading-none tracking-tight">{s.value}</p>
                  <p className="text-xs text-[#A1A1AA] mt-3 uppercase tracking-widest font-semibold leading-snug max-w-[180px] mx-auto">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who is Prime Atlas for? (Mashvisor-style) ── */}
        <section className="py-20 bg-[#F5F5EF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-black tracking-tight mb-2">Who Uses Prime Atlas?</h2>
            <p className="text-base text-black/50 mb-12 max-w-xl mx-auto">
              From first investment to institutional capital deployment — one platform, every scale.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: "🏠",
                  bg: "bg-[#00C805]",
                  label: "First-Time Investors",
                  desc: "Find your first BTR or development site with conviction, not guesswork.",
                  href: "/auth/signup",
                },
                {
                  icon: "📊",
                  bg: "bg-blue-500",
                  label: "Experienced Investors",
                  desc: "Deploy faster across USA and UK markets with pre-scored pipeline and live underwrite.",
                  href: "/deal-board",
                },
                {
                  icon: "🏗️",
                  bg: "bg-purple-500",
                  label: "Property Developers",
                  desc: "DCF, planning velocity, and undersupply signals before you spend on surveys.",
                  href: "/listings",
                },
                {
                  icon: "🏦",
                  bg: "bg-amber-500",
                  label: "Institutional Funds",
                  desc: "IC-ready memos, sourced from government data, on the day the deal arrives.",
                  href: "/capital",
                },
              ].map((p) => (
                <Link key={p.label} href={p.href} className="group flex flex-col items-center gap-4 hover:opacity-90 transition-opacity">
                  <div className={`w-24 h-24 rounded-full ${p.bg} flex items-center justify-center text-4xl shadow-lg group-hover:scale-105 transition-transform`}>
                    {p.icon}
                  </div>
                  <p className="font-bold text-black text-sm leading-snug">{p.label}</p>
                  <p className="text-xs text-black/50 leading-relaxed max-w-[180px]">{p.desc}</p>
                </Link>
              ))}
            </div>
            <div className="mt-12 flex flex-col items-center gap-2">
              <p className="text-lg font-black text-black">Your search for investment property — begins and ends here.</p>
              <p className="text-sm text-black/50">No more spreadsheets. No more stitching data across eight tabs.</p>
              <Link href="/auth/signup" className="mt-4 inline-flex items-center gap-2 bg-black text-white font-bold px-8 py-3 rounded-full hover:bg-black/85 transition-colors text-sm">
                Start analysing →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Audience cards ── */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-2 text-center">
              Built for every real estate investor
            </p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-10 text-balance">
              Your edge — regardless of scale
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-8">
              {AUDIENCES.map((a) => (
                <div key={a.tag} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${a.tagColor}`}>
                      {a.tag}
                    </span>
                  </div>
                  <p className="font-black text-lg tracking-tight mb-3 leading-snug text-balance">{a.headline}</p>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed mb-6 flex-1 text-pretty">{a.pain}</p>
                  <ul className="space-y-3 mb-6">
                    {a.value.map((v) => (
                      <li key={v} className="flex items-start gap-2.5 text-sm text-[#A1A1AA]">
                        <span className={`${a.checkColor} mt-0.5 flex-shrink-0 font-black text-xs`}>✓</span>
                        {v}
                      </li>
                    ))}
                  </ul>
                  <Link href={a.cta.href} className={`text-xs font-bold uppercase tracking-widest ${a.checkColor} hover:opacity-80 transition-opacity`}>
                    {a.cta.label} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Timeline comparison ── */}
        <section className="py-20 bg-[#0C0D14]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-2 text-center">
              The conviction gap
            </p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-2 text-balance">
              Three weeks compressed to twenty minutes
            </h2>
            <p className="text-sm text-[#A1A1AA] text-center mb-10 max-w-xl mx-auto text-pretty">
              The analysis is the same. The data is the same. The difference is the infrastructure that assembles it for you.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12">

              {/* Without */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#A1A1AA] mb-5">
                  Without Prime Atlas
                </p>
                <div className="border-l border-[#27272A] pl-6 space-y-4">
                  {TIMELINE_WITHOUT.map((row, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <span className="text-[10px] font-mono text-[#A1A1AA] flex-shrink-0 w-16 mt-0.5 tabular-nums">
                        {row.marker}
                      </span>
                      <span className={`text-sm leading-relaxed flex-1 ${"bad" in row && row.bad ? "text-[#FF3B30] font-semibold" : "text-[#A1A1AA]"}`}>
                        {row.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* With */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#00C805] mb-5">
                  With Prime Atlas
                </p>
                <div className="border-l-2 border-[#00C805]/40 pl-6 space-y-4">
                  {TIMELINE_WITH.map((row, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <span className="text-[10px] font-mono text-[#00C805] flex-shrink-0 w-16 mt-0.5 tabular-nums">
                        {row.marker}
                      </span>
                      <span className={`text-sm leading-relaxed flex-1 ${"good" in row && row.good ? "text-[#00C805] font-semibold" : "text-white"}`}>
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
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-2">
              The cost of slow conviction
            </p>
            <h2 className="text-2xl font-black tracking-tight mb-10 text-balance">
              You don&apos;t have a data problem. You have a conviction-and-latency problem.
            </h2>
            {/* Mobile: single column, centered — asymmetric whitespace */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-sm sm:max-w-none mx-auto w-full">
              {PAIN_POINTS.map((p) => (
                /* ── Liquid Glass card ── */
                <div
                  key={p.label}
                  className="relative overflow-hidden rounded-3xl p-7"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,200,5,0.08) 0%, rgba(204,255,0,0.04) 100%)",
                    boxShadow: "0 0 0 1px rgba(0,200,5,0.12), inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.35)"
                  }}
                >
                  {/* Inner gradient shimmer */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00C805]/30 to-transparent" />

                  {/* Label */}
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#A1A1AA] mb-5">
                    {p.label}
                  </p>

                  {/* Hero number */}
                  <p className="text-4xl font-black tracking-tight tabular-nums text-white leading-none mb-1">
                    {p.stat}
                  </p>
                  <p className="text-xs text-[#A1A1AA] uppercase tracking-widest font-semibold mb-5">
                    {p.statLabel}
                  </p>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed text-pretty">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section className="py-20 bg-[#0C0D14]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-2">
              How it works
            </p>
            <h2 className="text-2xl font-black tracking-tight mb-10 text-balance">
              From deal board to IC memo — same day, defensible in writing
            </h2>
            <div className="space-y-12">
              {WORKFLOW.map((step) => (
                <div key={step.step} className="flex flex-col sm:flex-row gap-6 sm:gap-10">
                  <div className="flex-shrink-0">
                    <span className="text-[11px] font-bold text-[#00C805] uppercase tracking-widest tabular-nums">
                      {step.step}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black tracking-tight text-base mb-2 text-balance">{step.title}</p>
                    <p className="text-sm text-[#A1A1AA] leading-relaxed text-pretty">{step.body}</p>
                    {step.cta && (
                      <Link href={step.cta.href} className="inline-block mt-3 text-xs font-bold uppercase tracking-widest text-[#CCFF00] hover:opacity-80 transition-opacity">
                        {step.cta.label} →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-16 text-xs text-[#A1A1AA] leading-relaxed max-w-2xl text-pretty">
              <strong className="text-white">Transparency.</strong>{" "}
              Sub-scores are manually-researched composite indexes compiled from official government data sources.
              Not black-box ML. The pro-forma is a standard DCF — all inputs are set by you.
              Nothing in Prime Atlas constitutes investment advice.
            </div>
          </div>
        </section>

        {/* ── Top-ranked markets ── */}
        {topMunicipalities && topMunicipalities.length > 0 && (
          <section className="py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-1">
                    Prime Atlas · Pre-screened pipeline · USA + UK
                  </p>
                  <h2 className="text-2xl font-black tracking-tight">Highest-conviction markets right now</h2>
                </div>
                <Link href="/listings" className="text-sm text-[#00C805] hover:underline whitespace-nowrap">
                  Full listings terminal →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topMunicipalities.map((m, i) => {
                  // Derive macro outlook from scores
                  const macro = m.opportunity_score >= 70 ? "BULLISH" : m.opportunity_score >= 55 ? "CAUTIOUS" : "NEUTRAL";
                  const macroColor = macro === "BULLISH" ? "text-[#00C805] bg-[#00C805]/10" : macro === "CAUTIOUS" ? "text-amber-400 bg-amber-400/10" : "text-[#A1A1AA] bg-[#27272A]";
                  // Estimate cap rate: base 4% + growth premium
                  const capRate = (4 + (m.growth_score - 50) * 0.04).toFixed(1);
                  // Estimate IRR range: cap rate + appreciation premium
                  const irrLow  = (parseFloat(capRate) + (m.development_score - 50) * 0.05).toFixed(1);
                  const irrHigh = (parseFloat(irrLow) + 3).toFixed(1);
                  const flag = countryFlag[m.country] ?? "🌍";
                  return (
                    <Link
                      key={m.id}
                      href={`/opportunities/${m.slug}`}
                      className="group border border-[#27272A] hover:border-[#00C805]/40 rounded-2xl p-5 bg-[#0C0D14] hover:bg-[#0C0D14]/80 transition-all"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-widest mb-1">
                            {flag} {m.country === "United Kingdom" ? "UK" : "USA"} · {m.region}
                          </p>
                          <p className="font-black text-lg tracking-tight group-hover:text-[#00C805] transition-colors">
                            {m.name}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <span className={`text-2xl font-black tabular-nums tracking-tight ${scoreColor(m.opportunity_score)}`}>
                            {m.opportunity_score}
                          </span>
                          <p className="text-[9px] text-[#A1A1AA] uppercase tracking-widest font-semibold">ROI index</p>
                        </div>
                      </div>

                      {/* Macro outlook badge */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${macroColor}`}>
                          {macro === "BULLISH" ? "↑ BULLISH" : macro === "CAUTIOUS" ? "→ CAUTIOUS" : "— NEUTRAL"} MACRO
                        </span>
                        <span className="text-[9px] text-[#A1A1AA] font-mono">#{i + 1} in pipeline</span>
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[
                          { label: "GROWTH", val: m.growth_score },
                          { label: "DEV",    val: m.development_score },
                          { label: "INFRA",  val: m.infrastructure_score ?? "—" },
                          { label: "RISK",   val: m.risk_score },
                        ].map(({ label, val }) => (
                          <div key={label} className="text-center border border-[#27272A] rounded-lg py-2">
                            <p className="text-xs font-bold tabular-nums text-white">{val}</p>
                            <p className="text-[8px] text-[#A1A1AA] uppercase tracking-widest mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* IRR + Cap Rate row */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#27272A]">
                        <div>
                          <p className="text-[9px] text-[#A1A1AA] uppercase tracking-widest font-semibold mb-0.5">Est. Cap Rate</p>
                          <p className="text-sm font-bold font-mono text-white">{capRate}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[#A1A1AA] uppercase tracking-widest font-semibold mb-0.5">IRR Range (5yr)</p>
                          <p className="text-sm font-bold font-mono text-[#00C805]">{irrLow}–{irrHigh}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-[#A1A1AA] uppercase tracking-widest font-semibold mb-0.5">Micro view</p>
                          <p className="text-xs text-[#00C805] font-semibold group-hover:underline">Full analysis →</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Active opportunities ── */}
        {recentOpps && recentOpps.length > 0 && (
          <section className="py-20 bg-[#0C0D14]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-1">
                    Underwrite-ready
                  </p>
                  <h2 className="text-xl font-black tracking-tight">Active opportunities — sourced &amp; scored</h2>
                </div>
                <Link href="/opportunities" className="text-sm text-[#00C805] hover:underline">
                  All opportunities →
                </Link>
              </div>
              <div className="space-y-0 max-w-2xl">
                {recentOpps.map((opp) => {
                  const muni = opp.municipalities as { name: string; country: string; slug: string } | null;
                  return (
                    <Link
                      key={opp.id}
                      href={muni ? `/opportunities/${muni.slug}` : "/opportunities"}
                      className="flex items-center justify-between py-5 border-b border-[#27272A]/40 hover:border-[#00C805]/30 transition-colors group"
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
                        <p className={`text-2xl font-black tabular-nums tracking-tight ${scoreColor(opp.opportunity_score)}`}>
                          {opp.opportunity_score}
                        </p>
                        <p className="text-[9px] text-[#A1A1AA] uppercase tracking-widest font-semibold">score</p>
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
          <section className="py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00C805] animate-pulse" />
                <div>
                  <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest">
                    Conviction signals
                  </p>
                  <p className="text-xs text-[#A1A1AA]">
                    Employer moves, infrastructure approvals, and planning decisions that materially change a market&apos;s conviction score
                  </p>
                </div>
              </div>
              <div className="space-y-0 max-w-2xl">
                {recentSignals.map((sig) => {
                  const muni = sig.municipalities as { name: string; country: string } | null;
                  return (
                    <div
                      key={sig.id}
                      className="flex items-center justify-between py-5 border-b border-[#27272A]/40"
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
                        <p className="text-[#00C805] font-black text-lg tabular-nums tracking-tight leading-none">+{sig.opportunity_impact}</p>
                        <p className="text-[9px] text-[#A1A1AA] uppercase tracking-widest font-semibold mt-0.5">pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Browse by category ── */}
        <section className="py-20 bg-[#0C0D14]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest text-center mb-2">
              Browse by asset class
            </p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-8 text-balance">Pre-screened by property category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 max-w-2xl">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="flex items-center gap-4 py-5 border-b border-[#27272A]/40 hover:border-[#00C805]/30 group transition-colors pr-8"
                >
                  <span className="text-xl flex-shrink-0">{cat.icon}</span>
                  <span className="font-black tracking-tight group-hover:text-[#00C805] transition-colors">
                    {cat.label}
                  </span>
                  <span className="ml-auto text-[#A1A1AA] text-xs group-hover:text-[#00C805] transition-colors">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Auditable data sources ── */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest text-center mb-2">
              Auditable sources
            </p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-3 text-balance">
              Every score is traceable to a named government source
            </h2>
            <p className="text-sm text-[#A1A1AA] text-center mb-10 max-w-2xl mx-auto text-pretty">
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
        <section className="py-20 bg-[#0C0D14]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-3">
              Free quarterly report
            </p>
            <h2 className="text-2xl font-bold mb-4">
              The 25 Most Undersupplied Multifamily Submarkets — Q2 2026
            </h2>
            <p className="text-sm text-[#A1A1AA] mb-6 leading-relaxed max-w-xl mx-auto">
              Ranked by ROI Feasibility Index. Covers UK and US markets.
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

        {/* ── Final CTA — Liquid Glass ── */}
        <section className="py-20 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
          {/* Liquid Glass container */}
          <div
            className="relative overflow-hidden rounded-[36px] px-8 sm:px-14 py-14 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(0,200,5,0.10) 0%, rgba(204,255,0,0.06) 50%, rgba(0,200,5,0.08) 100%)",
              boxShadow: "0 0 0 1px rgba(0,200,5,0.15), inset 0 1px 0 rgba(255,255,255,0.08), 0 40px 100px rgba(0,0,0,0.5)"
            }}
          >
            {/* Top shimmer line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#CCFF00]/40 to-transparent" />
            {/* Corner glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none opacity-20"
              style={{ background: "radial-gradient(ellipse, #00C805 0%, transparent 70%)" }} />

          <div className="relative text-center">
            <p className="text-xs text-[#A1A1AA] font-semibold uppercase tracking-widest mb-5">
              Start compressing your conviction timeline
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 leading-tight text-balance">
              The deal you miss because you were slow.<br />
              The deal that dies because you committed too early.{" "}
              <span className="text-[#CCFF00]">Prime Atlas ends both.</span>
            </h2>
            <p className="text-[#A1A1AA] text-sm mb-8 leading-relaxed max-w-lg mx-auto text-pretty">
              Explorer tier: Deal Board access, preliminary underwrite, live market feed across USA and UK.
              Analyst: all 58+ markets, full evidence layers, unlimited contact reveals, IC memo export.
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
          </div>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
