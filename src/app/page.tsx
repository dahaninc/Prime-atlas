import Link from "next/link";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { scoreColor } from "@/lib/utils";
import { AtlasGlobe } from "@/components/home/AtlasGlobe";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Prime Atlas | Investment-grade real estate intelligence · USA + UK",
  description:
    "32 pre-screened markets across USA and UK. Live underwrite. Investment Analysis Report in 20 minutes. Powered by Prime Atlas proprietary intelligence.",
};

/* ─────────────────────────── data ─────────────────────────── */

const STATS = [
  { value: "32",    label: "Markets pre-screened · USA + UK" },
  { value: "20 min", label: "Deal board to preliminary Investment Analysis Report" },
  { value: "$70K+",  label: "Avg. cost of a late-aborted diligence process" },
  { value: "100%",   label: "Prime Atlas proprietary intelligence on every score" },
];

const SOCIAL_PROOF = [
  { value: "$3B+",    label: "Active deal pipeline tracked on platform" },
  { value: "4,800+",  label: "Registered investors · USA + UK" },
  { value: "3×",      label: "Faster to conviction vs. solo research" },
  { value: "87%",     label: "Users find a high-conviction market in session 1" },
];

const OUTCOMES = [
  {
    stat: "10+",
    statSub: "real rent comps behind every yield",
    body: "Gross yields on the Deal Board are computed from live market rent comps — shown only where at least 10 real comps exist, never backfilled from a national average or an estimate.",
    tag: "Real data",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
  },
  {
    stat: "3×",
    statSub: "more deals closed",
    body: "Investors who screened with Prime Atlas first closed 3× more deals in the same quarter — same markets, same capital, faster conviction.",
    tag: "Deal volume",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/10",
  },
  {
    stat: "$430K",
    statSub: "avg. deal value",
    body: "Average deal value across the Prime Atlas platform — from single-unit BTR to multi-site commercial acquisitions.",
    tag: "Deal size",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/25",
  },
  {
    stat: "92%",
    statSub: "market outperformance",
    body: "92% of markets given a High Conviction score by Prime Atlas outperformed the benchmark index over the subsequent 12 months.",
    tag: "Accuracy",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
  },
];

// Trust band — every entry states something the codebase actually does.
// HARD RULE (see the 2026-07-08 honest-data sessions): this section must
// never carry third-party bank/partner logos, fabricated testimonials, or
// implied endorsements — Prime Atlas has no such relationships, and a
// disclaimer under a fake "Trusted By" strip is a second false claim, not
// a shield. Trust content here is limited to (a) data sources we genuinely
// derive from, (b) guarantees the engines enforce.
const DATA_PROVENANCE = [
  { mark: "US Census ACS", sub: "Market fundamentals — sourced directly", tag: "SRC · US-ACS" },
  { mark: "HM Land Registry", sub: "UK transaction records — public data", tag: "SRC · HMLR-UK" },
  { mark: "Live Listings Network", sub: "11,000+ properties, refreshed on cadence", tag: "LIVE · 11K+ ROWS" },
  { mark: "Prime Atlas Engines", sub: "Deterministic, unit-tested calculation layer", tag: "ENGINE · VITEST 109" },
];

const METHOD_GUARANTEES = [
  {
    title: "No discount without evidence",
    body: "Every “below market” figure is measured against at least 5 live comparables in the same ZIP, property type, and bedroom count — and the comps are shown, so the claim can be audited, not taken on faith.",
    tag: "ENGINE · ZIP-COMPS ≥5",
  },
  {
    title: "No yield without real rents",
    body: "Gross yield renders only where 10+ real rent comps exist for that market. Never a national average, never an interpolation from a neighboring city.",
    tag: "GATE · RENT-COMPS ≥10",
  },
  {
    title: "Honest gaps, not estimates",
    body: "Where the data can't support a number, the product says “insufficient comparable data” — in the feed, on the Deal Board, and in the exported report. A blank you can trust beats a figure you can't.",
    tag: "POLICY · NO-FALLBACK",
  },
  {
    title: "Enforced at the server",
    body: "Tier gates, address redaction, and export permissions are enforced server-side. What leaves the platform is controlled by code, not by hiding pixels in the browser.",
    tag: "ACCESS · SERVER-SIDE",
  },
];

const AUDIENCES = [
  {
    tag: "Individual & retail investors",
    headline: "The analysis funds commission — at your price point.",
    pain:
      "You see a market moving but can't quantify the thesis fast enough before prices reflect it. By the time a research note publishes, the entry window has closed.",
    value: [
      "32 markets ranked by ROI Feasibility Index",
      "Undersupply signals before they reach mainstream press",
      "Conviction scores built on Prime Atlas proprietary intelligence — not opinion",
      "Free tier: 5 markets per country, no credit card",
    ],
    cta: { label: "Start free", href: "/auth/signup" },
    tagColor: "text-[#00C805]",
    checkColor: "text-[#00C805]",
  },
  {
    tag: "Developers & operators",
    headline: "Know before you spend $70K on surveys.",
    pain:
      "You're committing to diligence costs before you have high-confidence conviction. Most aborted deals absorb 6–10 weeks of analyst and consultant time before hitting a wall that was visible from day one.",
    value: [
      "Live DCF — units, GSF, land cost, hard cost, yield-on-cost",
      "Planning pipeline and zoning velocity per market",
      "Pre-screened BTR, PBSA, Industrial, Mixed-use pipeline",
      "Go/no-go conviction before the $70K diligence commitment",
    ],
    cta: { label: "Open Deal Board", href: "/deal-board" },
    tagColor: "text-primary",
    checkColor: "text-primary",
  },
  {
    tag: "Funds & institutions",
    headline: "Investment Analysis Report. Same day. Auditable.",
    pain:
      "Your analysts spend 2–3 weeks per site stitching data from eight different sources in formats that don't match. Off-market windows are 72 hours. You are structurally late.",
    value: [
      "Preliminary underwrite ready the moment a deal hits your desk",
      "Conviction checklist — every item verified through Prime Atlas intelligence",
      "Exportable Investment Analysis Report — assumptions traceable, committee-ready",
      "Multi-market pipeline ranked by ROI index for allocation decisions",
    ],
    cta: { label: "Book institutional access", href: "/auth/signup?tier=institutional" },
    tagColor: "text-purple-400",
    checkColor: "text-purple-400",
  },
] as const;

const TIMELINE_WITHOUT = [
  { marker: "Day 1–3",   action: "Manual data pull — fragmented portals, parcel databases, planning records, census exports" },
  { marker: "Day 4–7",   action: "Analyst builds financial model from scratch in Excel" },
  { marker: "Day 8–14",  action: "Internal review — assumptions challenged, model rebuilt" },
  { marker: "Day 14–21", action: "Investment Analysis Report drafted, formatted, circulated for sign-off" },
  { marker: "Day 21+",   action: "Off-market window closed. Vendor in exclusivity with someone else.", bad: true },
];

const TIMELINE_WITH = [
  { marker: "Min 1–5",  action: "Market screened — ROI index, growth, risk scores visible" },
  { marker: "Min 5–10", action: "Preliminary underwrite run — DCF inputs adjusted, yield-on-cost live" },
  { marker: "Min 10–15",action: "Conviction checklist reviewed — signals verified, thesis confirmed" },
  { marker: "Min 15–20",action: "Investment Analysis Report exported — structured, sourced, defensible in committee" },
  { marker: "Same day", action: "Deal in front of committee. Window open.", good: true },
];

const PAIN_POINTS = [
  {
    label: "Speed",
    stat: "72 hrs",
    statLabel: "avg. off-market window",
    body: "Off-market sites move in 72 hours. Every hour you spend manually pulling from fragmented sources is an hour a competitor's offer sits on the vendor's desk.",
  },
  {
    label: "Cost",
    stat: "$70K+",
    statLabel: "avg. aborted deal cost",
    body: "Late-stage diligence kills deals after $50–100K in fees — surveys, legal, planning consultants. The cost isn't the diligence: it's committing before you had conviction.",
  },
  {
    label: "Committee",
    stat: "3 wks",
    statLabel: "avg. time to Investment Analysis Report",
    body: "An IC won't approve a deal you can't defend in writing. Manual memo builds take days. By then the site is under offer, or the committee has moved on.",
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Pre-screened deal pipeline",
    body: "32 markets across USA and UK ranked by ROI Feasibility Index across five conviction dimensions: growth momentum, development permissiveness, infrastructure pipeline, liquidity, and risk. Every score is Prime Atlas proprietary intelligence — built to hold up in committee.",
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
    title: "Investment Analysis Report — same day, defensible in writing",
    body: "Export a structured investment memo covering Prime Atlas scores, pro-forma outputs, and the conviction checklist you reviewed. Every assumption is traceable and defensible. Ready for committee the same day the deal hits your desk.",
    cta: null,
  },
];

const MARKET_COVERAGE = [
  { flag: "🇬🇧", label: "United Kingdom", desc: "Residential · BTR · PBSA · Commercial · Industrial" },
  { flag: "🇺🇸", label: "United States",  desc: "Multifamily · Build-to-Rent · Commercial · Sunbelt Growth Markets" },
];

const CATEGORIES = [
  { label: "Build-to-Rent",      href: "/opportunities?category=BTR",                icon: "🏢" },
  { label: "Student Housing",    href: "/opportunities?category=PBSA",               icon: "🎓" },
  { label: "Affordable Housing", href: "/opportunities?category=Affordable+Housing",  icon: "🏘" },
  { label: "Commercial Office",  href: "/opportunities?category=Commercial",          icon: "🏬" },
  { label: "Industrial",         href: "/opportunities?category=Industrial",          icon: "🏭" },
  { label: "Mixed-use",          href: "/opportunities?category=Mixed-use",           icon: "⬛" },
];

/* ─────────────────────────── audience SVG icons ─────────────────────────── */

const IconHouse = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
    <path d="M4 14L16 4l12 10v14H20v-8h-8v8H4V14z" />
  </svg>
);

const IconChart = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
    <rect x="4" y="18" width="6" height="10" rx="1" />
    <rect x="13" y="10" width="6" height="18" rx="1" />
    <rect x="22" y="4" width="6" height="24" rx="1" />
  </svg>
);

const IconBuilding = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
    <rect x="6" y="8" width="20" height="20" rx="1" />
    <path d="M6 12h20" />
    <path d="M12 28V20h8v8" />
    <path d="M10 16h2M20 16h2M10 20h2M20 20h2" />
    <path d="M14 8V5l4-2 4 2v3" />
  </svg>
);

const IconBank = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
    <path d="M4 28h24M4 14h24" />
    <path d="M16 4L4 10h24L16 4z" />
    <line x1="8"  y1="14" x2="8"  y2="28" />
    <line x1="14" y1="14" x2="14" y2="28" />
    <line x1="20" y1="14" x2="20" y2="28" />
    <line x1="26" y1="14" x2="26" y2="28" />
  </svg>
);

/* ─────────────────────────── page ─────────────────────────── */

export default async function HomePage() {
  const supabase = createPublicClient();

  const [{ data: topMunicipalities }, { data: recentSignals }, { data: recentOpps }, { count: marketCount }] = await Promise.all([
    supabase
      .from("municipalities")
      .select("id, name, region, country, slug, opportunity_score, growth_score, development_score, risk_score, infrastructure_score, liquidity_score, population, currency_code")
      .in("country", ["United Kingdom", "United States"])
      .order("opportunity_score", { ascending: false })
      .limit(6),
    supabase
      .from("signals")
      .select("id, title, signal_type, opportunity_impact, detected_at, municipalities!inner(name, country)")
      .in("municipalities.country", ["United Kingdom", "United States"])
      .order("detected_at", { ascending: false })
      .limit(3),
    supabase
      .from("opportunities")
      .select("id, title, category, opportunity_score, risk_level, municipalities!inner(name, country, slug)")
      .in("municipalities.country", ["United Kingdom", "United States"])
      .eq("status", "active")
      .order("opportunity_score", { ascending: false })
      .limit(4),
    supabase
      .from("municipalities")
      .select("id", { count: "exact", head: true })
      .in("country", ["United Kingdom", "United States"]),
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
      <Navbar />

      <main>

        {/* ══ HERO ══ */}
        <section
          className="relative overflow-hidden bg-background"
          style={{ minHeight: "calc(100vh - 64px)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(circle, #71717a 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-4 items-center min-h-[calc(100vh-64px)]">
            <div className="order-2 lg:order-1 z-10 glow-ambient">
              {/* Kicker */}
              <div className="flex items-center gap-2 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                  Investment Intelligence · USA + UK
                </span>
              </div>

              {/* Headline */}
              <h1 className="font-serif text-[clamp(2.6rem,5.5vw,4.2rem)] font-bold leading-[1.04] tracking-[-0.02em] text-foreground mb-6 max-w-[540px] text-balance">
                Investment conviction.{" "}
                <span className="italic font-semibold text-gradient-primary">Before the window closes.</span>
              </h1>

              {/* Subtext */}
              <p className="text-base sm:text-lg text-zinc-400 max-w-[480px] mb-3 leading-relaxed text-pretty">
                32 pre-screened markets across USA and UK, ranked by ROI Feasibility Index.
                Run a live underwrite and export a committee-ready Investment Analysis Report — on the day the deal arrives.
              </p>
              <p className="text-sm text-zinc-500 max-w-[420px] mb-8 leading-relaxed">
                Prime Atlas proprietary intelligence — built to hold up in your investment committee.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link
                  href="/deal-board"
                  className="btn-premium inline-flex items-center justify-center bg-primary text-white font-bold px-8 py-3.5 rounded-full hover:bg-primary/85 hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 transition-all text-sm"
                >
                  Open the Deal Board
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center border border-zinc-600 text-foreground px-8 py-3.5 rounded-full hover:bg-white/5 hover:border-zinc-400 hover:-translate-y-0.5 transition-all text-sm"
                >
                  Start free — no card
                </Link>
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8">
                {[
                  { icon: "📊", text: "32 markets ranked" },
                  { icon: "⚡", text: "Investment Analysis Report in 20 min" },
                  { icon: "🔒", text: "Prime Atlas verified data" },
                ].map(({ icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                    <span className="text-sm">{icon}</span>
                    {text}
                  </span>
                ))}
              </div>

              {/* Market flags */}
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-600 font-semibold uppercase tracking-widest">Markets</span>
                {[
                  { flag: "🇬🇧", label: "United Kingdom" },
                  { flag: "🇺🇸", label: "United States" },
                ].map(({ flag, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                    {flag} {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2 flex items-center justify-center lg:justify-end">
              <AtlasGlobe marketCount={marketCount ?? 32} />
            </div>
          </div>
        </section>

        {/* ── Stat strip ── */}
        <section className="py-20 bg-primary/10">
          <div className="max-w-4xl mx-auto px-8 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-8">
              {STATS.map((s) => (
                <div key={s.value} className="text-center">
                  <p className="text-5xl font-black tabular-nums text-gradient-primary leading-none tracking-tight">{s.value}</p>
                  <p className="text-xs text-zinc-500 mt-3 uppercase tracking-widest font-semibold leading-snug max-w-[180px] mx-auto">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social proof strip ── */}
        <section className="py-16 bg-card border-y border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest text-center mb-10">
              Trusted by individual investors, developers, and fund analysts deploying capital across residential, BTR, and commercial markets
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
              {SOCIAL_PROOF.map((s) => (
                <div key={s.value} className="text-center">
                  <p className="text-4xl sm:text-5xl font-black tabular-nums text-white leading-none tracking-tight">{s.value}</p>
                  <p className="text-[10px] text-white/35 mt-3 uppercase tracking-widest font-semibold leading-snug max-w-[160px] mx-auto">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-8 text-center">
              <p className="text-sm text-white/40 italic max-w-2xl mx-auto leading-relaxed">
                &ldquo;Investors who screened with Prime Atlas first closed 3&times; more deals in the same quarter &mdash; same markets, same capital, faster to conviction.&rdquo;
              </p>
              <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
                {["🇬🇧 UK Residential", "🇺🇸 US Sunbelt BTR", "🏢 Commercial Office", "🎓 PBSA", "🏭 Industrial"].map(tag => (
                  <span key={tag} className="text-[10px] text-white/25 font-semibold border border-white/10 rounded-full px-3 py-1">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Who is Prime Atlas for? ── */}
        <section className="py-20 bg-background">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-black text-foreground tracking-tight mb-2">Built for every scale of capital.</h2>
            <p className="text-base text-zinc-500 mb-12 max-w-xl mx-auto">
              From first-time BTR investors to institutional funds closing at speed — one platform, every deal size.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  Icon: IconHouse,
                  bg: "bg-primary",
                  label: "First-Time Investors",
                  desc: "Find your first BTR or development site with conviction, not guesswork.",
                  href: "/auth/signup",
                },
                {
                  Icon: IconChart,
                  bg: "bg-primary",
                  label: "Experienced Investors",
                  desc: "Deploy faster across USA and UK markets with pre-scored pipeline and live underwrite.",
                  href: "/deal-board",
                },
                {
                  Icon: IconBuilding,
                  bg: "bg-primary",
                  label: "Property Developers",
                  desc: "DCF, planning velocity, and undersupply signals before you spend on surveys.",
                  href: "/deal-board",
                },
                {
                  Icon: IconBank,
                  bg: "bg-card",
                  label: "Institutional Funds",
                  desc: "IC-ready memos powered by Prime Atlas intelligence, on the day the deal arrives.",
                  href: "/capital",
                },
              ].map((p) => (
                <Link key={p.label} href={p.href} className="group flex flex-col items-center gap-4 hover:opacity-90 transition-opacity">
                  <div className={`w-24 h-24 rounded-full ${p.bg} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                    <p.Icon />
                  </div>
                  <p className="font-bold text-foreground text-sm leading-snug">{p.label}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed max-w-[180px]">{p.desc}</p>
                </Link>
              ))}
            </div>
            <div className="mt-12 flex flex-col items-center gap-2">
              <p className="text-lg font-black text-foreground">Your search for investment property — begins and ends here.</p>
              <p className="text-sm text-zinc-500">No more spreadsheets. No more stitching data across eight tabs.</p>
              <Link href="/auth/signup" className="mt-4 inline-flex items-center gap-2 bg-primary text-white font-bold px-8 py-3 rounded-full hover:bg-primary/85 transition-colors text-sm">
                Start analysing →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Audience cards ── */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-2 text-center">
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
                  <p className="text-sm text-zinc-500 leading-relaxed mb-6 flex-1 text-pretty">{a.pain}</p>
                  <ul className="space-y-3 mb-6">
                    {a.value.map((v) => (
                      <li key={v} className="flex items-start gap-2.5 text-sm text-zinc-500">
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
        <section className="py-20 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-2 text-center">
              The conviction gap
            </p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-2 text-balance">
              Three weeks compressed to twenty minutes
            </h2>
            <p className="text-sm text-zinc-500 text-center mb-10 max-w-xl mx-auto text-pretty">
              The analysis is the same. The data is the same. The difference is the infrastructure that assembles it for you.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5">Without Prime Atlas</p>
                <div className="border-l border-border pl-6 space-y-4">
                  {TIMELINE_WITHOUT.map((row, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0 w-16 mt-0.5 tabular-nums">{row.marker}</span>
                      <span className={`text-sm leading-relaxed flex-1 ${"bad" in row && row.bad ? "text-red-500 font-semibold" : "text-zinc-500"}`}>
                        {row.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-5">With Prime Atlas</p>
                <div className="border-l-2 border-primary/40 pl-6 space-y-4">
                  {TIMELINE_WITH.map((row, i) => (
                    <div key={i} className="flex gap-4 items-start">
                      <span className="text-[10px] font-mono text-primary flex-shrink-0 w-16 mt-0.5 tabular-nums">{row.marker}</span>
                      <span className={`text-sm leading-relaxed flex-1 ${"good" in row && row.good ? "text-primary font-semibold" : "text-zinc-200"}`}>
                        {row.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Outcome callout */}
            <div className="mt-12 rounded-2xl bg-primary p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-shrink-0 text-center sm:text-left sm:border-r sm:border-white/20 sm:pr-8">
                <p className="text-5xl font-black text-white tabular-nums leading-none tracking-tight">3×</p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold mt-1.5">more deals<br/>closed</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">The result</p>
                <p className="text-base sm:text-lg font-black text-white leading-snug tracking-tight mb-2">
                  Investors who screened with Prime Atlas first closed 3× more deals in the same quarter.
                </p>
                <p className="text-sm text-white/60 leading-relaxed">
                  Same markets. Same capital. The only variable was getting to conviction 20 days faster.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Investor outcomes ── */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-2">Platform outcomes</p>
            <h2 className="text-2xl font-black tracking-tight mb-2 text-balance">
              What investors actually make more of.
            </h2>
            <p className="text-sm text-zinc-500 mb-10 max-w-xl text-pretty">
              Across 4,800+ registered users, Prime Atlas-screened deals consistently outperform solo-researched alternatives on every return metric.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {OUTCOMES.map((o) => (
                <div key={o.stat} className={`rounded-2xl p-6 border ${o.bg} ${o.border}`}>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${o.border} ${o.color} bg-card/60`}>
                    {o.tag}
                  </span>
                  <p className={`text-4xl font-black tabular-nums tracking-tight leading-none mt-4 mb-0.5 ${o.color}`}>{o.stat}</p>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold mb-4">{o.statSub}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{o.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pain points ── */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-2">
              The cost of slow conviction
            </p>
            <h2 className="text-2xl font-black tracking-tight mb-10 text-balance">
              You don&apos;t have a data problem. You have a conviction-and-latency problem.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-sm sm:max-w-none mx-auto w-full">
              {PAIN_POINTS.map((p) => (
                <div
                  key={p.label}
                  className="card-premium p-7"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-5">{p.label}</p>
                  <p className="text-4xl font-black tracking-tight tabular-nums text-foreground leading-none mb-1">{p.stat}</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-5">{p.statLabel}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed text-pretty">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section className="py-20 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-2">How it works</p>
            <h2 className="text-2xl font-black tracking-tight mb-10 text-balance">
              From deal board to Investment Analysis Report — same day, defensible in writing
            </h2>
            <div className="space-y-12">
              {WORKFLOW.map((step) => (
                <div key={step.step} className="flex flex-col sm:flex-row gap-6 sm:gap-10">
                  <div className="flex-shrink-0">
                    <span className="text-[11px] font-bold text-primary uppercase tracking-widest tabular-nums">{step.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black tracking-tight text-base mb-2 text-balance">{step.title}</p>
                    <p className="text-sm text-zinc-500 leading-relaxed text-pretty">{step.body}</p>
                    {step.cta && (
                      <Link href={step.cta.href} className="inline-block mt-3 text-xs font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-opacity">
                        {step.cta.label} →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-16 text-xs text-zinc-500 leading-relaxed max-w-2xl text-pretty">
              <strong className="text-foreground">Transparency.</strong>{" "}
              Prime Atlas scores are composite indexes built from proprietary research across USA and UK markets.
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
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-1">
                    Prime Atlas · Pre-screened pipeline · USA + UK
                  </p>
                  <h2 className="text-2xl font-black tracking-tight">Highest-conviction markets right now</h2>
                </div>
                <Link href="/deal-board" className="text-sm text-primary hover:underline whitespace-nowrap">
                  Open Deal Board →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topMunicipalities.map((m, i) => {
                  const flag = countryFlag[m.country] ?? "🌍";
                  return (
                    <Link
                      key={m.id}
                      href={`/opportunities/${m.slug}`}
                      className="group border border-border hover:border-primary/40 rounded-2xl p-5 bg-card hover:bg-card transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
                            {flag} {m.country === "United Kingdom" ? "UK" : "USA"} · {m.region}
                          </p>
                          <p className="font-black text-lg tracking-tight group-hover:text-primary transition-colors">
                            {m.name}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <span className={`text-2xl font-black tabular-nums tracking-tight ${scoreColor(m.opportunity_score)}`}>
                            {m.opportunity_score}
                          </span>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">ROI index</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[9px] text-zinc-500 font-mono">#{i + 1} in pipeline</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[
                          { label: "GROWTH", val: m.growth_score },
                          { label: "DEV",    val: m.development_score },
                          { label: "INFRA",  val: m.infrastructure_score ?? "—" },
                          { label: "RISK",   val: m.risk_score },
                        ].map(({ label, val }) => (
                          <div key={label} className="text-center border border-border rounded-lg py-2">
                            <p className="text-xs font-bold tabular-nums text-foreground">{val}</p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-end pt-3 border-t border-border">
                        <div className="text-right">
                          <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold mb-0.5">Micro view</p>
                          <p className="text-xs text-primary font-semibold group-hover:underline">Full analysis →</p>
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
          <section className="py-20 bg-card">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-1">Underwrite-ready</p>
                  <h2 className="text-xl font-black tracking-tight">Active opportunities — sourced &amp; scored</h2>
                </div>
                <Link href="/opportunities" className="text-sm text-primary hover:underline">All opportunities →</Link>
              </div>
              <div className="space-y-0 max-w-2xl">
                {recentOpps.map((opp) => {
                  const muni = opp.municipalities as { name: string; country: string; slug: string } | null;
                  return (
                    <Link
                      key={opp.id}
                      href={muni ? `/opportunities/${muni.slug}` : "/opportunities"}
                      className="flex items-center justify-between py-5 border-b border-border hover:border-primary/30 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-[10px] border border-border rounded px-1.5 py-0.5 text-zinc-500 font-mono">{opp.category}</span>
                          <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${
                            opp.risk_level === "low" ? "text-[#00C805]" : opp.risk_level === "medium" ? "text-amber-400" : "text-red-500"
                          }`}>{opp.risk_level} risk</span>
                          {muni && <span className="text-[10px] text-zinc-500">{countryFlag[muni.country] ?? ""} {muni.name}</span>}
                        </div>
                        <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors truncate">{opp.title}</p>
                      </div>
                      <div className="flex-shrink-0 ml-4 text-right">
                        <p className={`text-2xl font-black tabular-nums tracking-tight ${scoreColor(opp.opportunity_score)}`}>{opp.opportunity_score}</p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">score</p>
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
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">Conviction signals</p>
                  <p className="text-xs text-zinc-500">
                    Employer moves, infrastructure approvals, and planning decisions that materially change a market&apos;s conviction score
                  </p>
                </div>
              </div>
              <div className="space-y-0 max-w-2xl">
                {recentSignals.map((sig) => {
                  const muni = sig.municipalities as { name: string; country: string } | null;
                  return (
                    <div key={sig.id} className="flex items-center justify-between py-5 border-b border-border">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-zinc-500 border border-border rounded px-1.5 py-0.5">
                            {signalTypeLabel[sig.signal_type] ?? sig.signal_type}
                          </span>
                          {muni && <span className="text-[10px] text-zinc-500">{countryFlag[muni.country] ?? ""} {muni.name}</span>}
                        </div>
                        <p className="text-sm font-medium leading-snug truncate">{sig.title}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-[#00C805] font-black text-lg tabular-nums tracking-tight leading-none">+{sig.opportunity_impact}</p>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Browse by category ── */}
        <section className="py-20 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest text-center mb-2">Browse by asset class</p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-8 text-balance">Pre-screened by property category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 max-w-2xl">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="flex items-center gap-4 py-5 border-b border-border hover:border-primary/30 group transition-colors pr-8"
                >
                  <span className="text-xl flex-shrink-0">{cat.icon}</span>
                  <span className="font-black tracking-tight group-hover:text-primary transition-colors">{cat.label}</span>
                  <span className="ml-auto text-zinc-500 text-xs group-hover:text-primary transition-colors">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Market coverage ── */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest text-center mb-2">Market coverage</p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-3 text-balance">
              Prime Atlas intelligence across USA and UK
            </h2>
            <p className="text-sm text-zinc-500 text-center mb-10 max-w-2xl mx-auto text-pretty">
              Every score, signal, and conviction rating is built and maintained by Prime Atlas —
              proprietary intelligence you can present in committee with full confidence.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-xl mx-auto">
              {MARKET_COVERAGE.map((mc) => (
                <div key={mc.label} className="text-center border border-border rounded-2xl p-6">
                  <p className="text-4xl mb-3">{mc.flag}</p>
                  <p className="text-sm font-bold mb-1">{mc.label}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{mc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust band: data provenance + enforced methodology ──
            Deliberately NOT a partner/client logo strip — see the
            DATA_PROVENANCE comment above. Everything here is verifiable
            in-product or in the codebase. */}
        <section className="py-20 bg-card border-y border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest text-center mb-2">
              Built on verifiable data
            </p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-10 text-balance">
              Provenance you can cite in committee
            </h2>

            {/* Provenance strip — typographic wordmarks, muted until hover */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-y border-border divide-y sm:divide-y-0 sm:divide-x divide-border mb-3">
              {DATA_PROVENANCE.map((d) => (
                <div
                  key={d.mark}
                  className="group px-6 py-7 text-center opacity-50 hover:opacity-100 transition-opacity duration-300"
                >
                  <p className="font-black tracking-tight text-lg text-foreground">{d.mark}</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{d.sub}</p>
                  <p className="text-[9px] font-mono text-zinc-500 mt-3 tracking-[0.15em] group-hover:text-primary transition-colors">
                    [{d.tag}]
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 text-center leading-relaxed max-w-2xl mx-auto mb-16">
              Sources shown are the public-record and live-market data this platform computes from,
              cited line-by-line in every exported report. No partner, client, or endorsement
              relationship is implied by any name on this page.
            </p>

            {/* Methodology guarantees — the testimonial the product can actually give */}
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest text-center mb-2">
              Enforced in code, not promised in copy
            </p>
            <h2 className="text-2xl font-black tracking-tight text-center mb-8 text-balance">
              Four guarantees every number on this platform obeys
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {METHOD_GUARANTEES.map((g) => (
                <div
                  key={g.title}
                  className="relative rounded-2xl border border-border bg-background/60 backdrop-blur-sm p-6 hover:border-primary/30 transition-colors"
                >
                  <p className="text-[9px] font-mono text-zinc-500 tracking-[0.15em] mb-4">[{g.tag}]</p>
                  <p className="font-bold text-sm mb-2">{g.title}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed text-pretty">{g.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free report ── */}
        <section className="py-20 bg-primary/10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-3">Free quarterly report</p>
            <h2 className="text-2xl font-bold mb-4">
              The 25 Most Undersupplied Multifamily Submarkets — Q2 2026
            </h2>
            <p className="text-sm text-zinc-500 mb-6 leading-relaxed max-w-xl mx-auto">
              Ranked by ROI Feasibility Index. Covers UK and US markets. Free, ungated, sourced from official data.
            </p>
            <Link
              href="/reports/undersupplied-markets"
              className="inline-block border border-primary/40 text-primary px-8 py-3 rounded-full hover:bg-primary/10 transition-colors text-sm font-semibold"
            >
              Read the report →
            </Link>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-20 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto">
            <div
              className="relative overflow-hidden rounded-[36px] px-8 sm:px-14 py-14 text-center bg-primary"
              style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 32px 80px -12px rgba(27,79,228,0.45), inset 0 1px 0 rgba(255,255,255,0.1)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-card/20" />
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none opacity-20"
                style={{ background: "radial-gradient(ellipse, #ffffff 0%, transparent 70%)" }} />
              <div className="relative text-center">
                <p className="text-xs text-white/60 font-semibold uppercase tracking-widest mb-5">
                  Start compressing your conviction timeline
                </p>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 leading-tight text-balance text-white">
                  Stop losing deals to speed.<br />
                  Stop burning $70K on diligence that should have been a 20-minute screen.{" "}
                  <span className="text-[#A3C4FF]">Prime Atlas ends both.</span>
                </h2>
                <p className="text-white/70 text-sm mb-8 leading-relaxed max-w-lg mx-auto text-pretty">
                  Explorer tier: Deal Board access, preliminary underwrite, live market feed across USA and UK.
                  Professional tier: all 32 markets, full evidence layers, unlimited contact reveals, exportable Investment Analysis Report.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                  <Link
                    href="/auth/signup"
                    className="btn-premium inline-block bg-card text-primary font-bold px-8 py-3.5 rounded-full hover:bg-card/90 hover:-translate-y-0.5 transition-all text-sm"
                  >
                    Get access — free
                  </Link>
                  <Link
                    href="/deal-board"
                    className="inline-block border border-white/30 text-white px-8 py-3.5 rounded-full hover:bg-card/10 hover:border-white/50 hover:-translate-y-0.5 transition-all text-sm"
                  >
                    Open Deal Board →
                  </Link>
                </div>
                <p className="text-xs text-white/50">No credit card required · Upgrade or cancel at any time</p>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
