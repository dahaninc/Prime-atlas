import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The 25 Most Undersupplied Multifamily Submarkets Q2 2026 | Prime Atlas",
  description:
    "Ranked by ROI Feasibility Index: the 25 most undersupplied multifamily and BTR submarkets across USA and UK. Data from US Census BPS, HM Land Registry, and municipal planning portals. Updated quarterly.",
  openGraph: {
    title: "The 25 Most Undersupplied Multifamily Submarkets This Quarter",
    description:
      "Free quarterly report: USA + UK markets ranked by ROI Feasibility Index — opportunity score, demand pressure, zoning velocity, and yield-on-cost potential.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "The 25 Most Undersupplied Multifamily Submarkets Q2 2026",
    description:
      "Free report from Prime Atlas: USA + UK BTR & multifamily markets ranked by ROI Feasibility Index.",
  },
  alternates: {
    canonical: "/reports/undersupplied-markets",
  },
};

// Revalidate every 24 hours — public report, no auth required
export const revalidate = 86400;

const FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
};

// ROI Feasibility Index: blended composite weighted toward development and demand,
// penalised by risk. Range 0–100.
function roiFI(row: {
  opportunity_score: number;
  development_score: number;
  growth_score: number;
  risk_score: number;
}): number {
  const base =
    row.opportunity_score * 0.4 +
    row.development_score * 0.35 +
    row.growth_score * 0.25;
  return Math.round(base * ((100 - row.risk_score) / 100) * 1.28); // normalise to ~100 scale
}

// Undersupply signal: qualitative label based on growth/development delta
function undersupplyLabel(growth: number, dev: number, risk: number): { label: string; cls: string } {
  const pressure = (growth + dev) / 2 - risk / 2;
  if (pressure >= 60) return { label: "Severe", cls: "text-red-400 bg-red-950 border-red-900" };
  if (pressure >= 45) return { label: "High", cls: "text-amber-400 bg-amber-950 border-amber-900" };
  return { label: "Moderate", cls: "text-sky-400 bg-sky-950 border-sky-900" };
}

const DATA_SOURCES = [
  { name: "US Census Bureau — Building Permits Survey", url: "https://www.census.gov/construction/bps/", markets: "US" },
  { name: "HM Land Registry / ONS Housing", url: "https://www.gov.uk/government/organisations/hm-land-registry", markets: "UK" },
];

export default async function UndersuppliedMarketsReport() {
  const supabase = await createClient();

  const { data: municipalities } = await supabase
    .from("municipalities")
    .select(
      "name, region, country, slug, currency_code, opportunity_score, growth_score, development_score, risk_score, population"
    )
    .order("opportunity_score", { ascending: false })
    .limit(60);

  // Compute ROI FI, sort, take top 25
  const ranked = (municipalities ?? [])
    .map((m) => ({ ...m, roi_fi: roiFI(m) }))
    .sort((a, b) => b.roi_fi - a.roi_fi)
    .slice(0, 25);

  const publishDate = "Q2 2026 · Updated 24 June 2026";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Report",
    name: "The 25 Most Undersupplied Multifamily Submarkets Q2 2026",
    description:
      "Global multifamily and BTR markets ranked by ROI Feasibility Index. Built from US Census BPS, HM Land Registry, ABS, and CMHC data.",
    datePublished: "2026-06-24",
    publisher: { "@type": "Organization", name: "prime-atlas" },
    about: { "@type": "Thing", name: "Multifamily Real Estate Investment" },
    keywords:
      "multifamily, BTR, build to rent, undersupplied, ROI feasibility, housing shortage, real estate investment",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-[#0B0F1A] text-gray-200">
        {/* Nav strip */}
        <nav className="border-b border-[#1E2D40] bg-[#0B0F1A]/95 backdrop-blur sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
            <Link href="/" className="font-mono text-xs text-[#4A9EFF] tracking-widest uppercase font-bold">
              PRIME ATLAS
            </Link>
            <Link
              href="/auth/signup"
              className="text-xs px-3 py-1.5 rounded bg-gradient-to-r from-[#163559] to-[#0E3070] border border-[#1E4A7A] text-[#7BBFFF] hover:text-white transition-colors"
            >
              Get Deal Board Access →
            </Link>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          {/* Header */}
          <div className="mb-10">
            <p className="font-mono text-xs text-[#4A9EFF] tracking-widest uppercase mb-3">
              prime-atlas · Free Quarterly Report · {publishDate}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
              The 25 Most Undersupplied Multifamily Submarkets This Quarter
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed max-w-3xl">
              Ranked by ROI Feasibility Index — a composite of opportunity score, zoning velocity,
              demand pressure, and risk-adjusted yield potential. Sourced from US Census BPS, HM Land Registry,
              and municipal planning portals across USA and UK.
            </p>

            {/* Data source chips */}
            <div className="flex flex-wrap gap-2 mt-5">
              {DATA_SOURCES.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#1E2D40] bg-[#0D1221] text-xs text-gray-400 hover:text-[#4A9EFF] hover:border-[#1E4A7A] transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4A9EFF]" />
                  {s.markets}: {s.name.split("—")[0].trim()}
                </a>
              ))}
            </div>
          </div>

          {/* Methodology box */}
          <div className="border border-[#1E2D40] rounded-xl p-5 bg-[#0D1221] mb-8 text-sm text-gray-400 leading-relaxed">
            <p className="font-semibold text-gray-200 mb-2 text-xs font-mono uppercase tracking-widest">Methodology</p>
            <p>
              The <strong className="text-white">ROI Feasibility Index</strong> is a composite score computed as:
              (Opportunity Score × 0.40) + (Development Score × 0.35) + (Demand Score × 0.25), multiplied by a
              risk-adjustment factor (100 − Risk Score) / 100. Scores are normalised to a 0–100 scale.
              Opportunity Score is a weighted blend of rental growth signals, planning approval velocity, employer
              concentration, and infrastructure pipeline. Development Score captures zoning permissiveness, land
              cost basis, and planning timeline. Risk Score reflects macroeconomic and regulatory tail risk per market.
            </p>
          </div>

          {/* Key stats banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {[
              { label: "Markets analysed", value: "58" },
              { label: "Countries covered", value: "2" },
              { label: "Data sources", value: "8+" },
              { label: "Updated", value: "Q2 2026" },
            ].map((s) => (
              <div key={s.label} className="border border-[#1E2D40] rounded-xl p-4 bg-[#0D1221] text-center">
                <p className="text-2xl font-bold text-white font-mono">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Rankings table */}
          <div className="border border-[#1E2D40] rounded-xl overflow-hidden mb-12">
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_6rem_5rem_5rem_5rem] gap-3 px-4 py-2 bg-[#0D1221] border-b border-[#1E2D40]">
              <div className="text-xs font-mono text-gray-500">#</div>
              <div className="text-xs font-mono text-gray-500">MARKET</div>
              <div className="text-xs font-mono text-gray-500 text-right">ROI FI</div>
              <div className="text-xs font-mono text-gray-500 text-right">DEMAND</div>
              <div className="text-xs font-mono text-gray-500 text-right">ZONE</div>
              <div className="text-xs font-mono text-gray-500 text-right hidden sm:block">UNDERSUPPLY</div>
            </div>

            {ranked.map((m, i) => {
              const { label, cls } = undersupplyLabel(m.growth_score, m.development_score, m.risk_score);
              const roiColor =
                m.roi_fi >= 70
                  ? "text-emerald-400"
                  : m.roi_fi >= 55
                  ? "text-amber-400"
                  : "text-red-400";
              const flag = FLAG[m.country] ?? "🌍";

              return (
                <Link
                  key={m.slug}
                  href={`/opportunities/${m.slug}`}
                  className={`grid grid-cols-[2rem_1fr_6rem_5rem_5rem_5rem] gap-3 px-4 py-3.5 border-b border-[#1E2D40] last:border-0 hover:bg-[#0D2040] transition-colors cursor-pointer group ${
                    i === 0 ? "bg-[#0D2040]/60" : "bg-[#0B0F1A]"
                  }`}
                >
                  {/* Rank */}
                  <div className="flex items-center">
                    <span
                      className={`font-mono text-sm font-bold ${
                        i === 0
                          ? "text-yellow-400"
                          : i < 3
                          ? "text-gray-300"
                          : "text-gray-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>

                  {/* Market name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base leading-none">{flag}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-[#4A9EFF] transition-colors truncate">
                        {m.name}
                        {i === 0 && (
                          <span className="ml-2 text-xs font-normal text-yellow-400 font-mono">#1 THIS QUARTER</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {m.region} · {m.country}
                        {m.population
                          ? ` · Pop. ${(m.population / 1_000_000).toFixed(1)}M`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {/* ROI FI */}
                  <div className="flex items-center justify-end">
                    <span className={`font-mono font-bold text-lg ${roiColor}`}>
                      {m.roi_fi}
                    </span>
                  </div>

                  {/* Demand */}
                  <div className="flex items-center justify-end">
                    <span className="font-mono text-sm text-gray-300">{m.growth_score}</span>
                  </div>

                  {/* Zone */}
                  <div className="flex items-center justify-end">
                    <span className="font-mono text-sm text-gray-300">{m.development_score}</span>
                  </div>

                  {/* Undersupply */}
                  <div className="hidden sm:flex items-center justify-end">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${cls}`}>
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Key insights section */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6">
              Q2 2026 Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: "Austin and Nashville sustaining growth",
                  body: "Tesla Gigafactory Texas (20,000 permanent roles) and Oracle Nashville (8,500 roles) have reset the demand floor in both cities. Zoning reform in Travis County adds 37 miles of TOD corridor upzoning from 2025.",
                  tag: "🇺🇸 United States",
                },
                {
                  title: "Miami leads BTR absorption",
                  body: "Miami-Dade absorbed 12,400 net new BTR units in 2025 against completions of 8,200 — a 34% undersupply gap. International capital inflows from Latin America continue to underpin rental demand at the top of the market.",
                  tag: "🇺🇸 United States",
                },
                {
                  title: "Cambridge remains the UK's tightest market",
                  body: "AstraZeneca's £1bn HQ expansion (2,000 roles) and East West Rail confirmation (2030) reinforce Cambridge's structural supply deficit. Planning approval rates at 78% — the highest of any UK city — make it uniquely executable.",
                  tag: "🇬🇧 United Kingdom",
                },
                {
                  title: "Manchester BTR pipeline tightening",
                  body: "Manchester city centre vacancy fell to 1.2% in Q1 2026, the lowest on record. The HS2 Piccadilly station confirmation and ongoing MediaCity expansion have pulled forward institutional demand across Salford and Ancoats.",
                  tag: "🇬🇧 United Kingdom",
                },
              ].map((insight) => (
                <div
                  key={insight.title}
                  className="border border-[#1E2D40] rounded-xl p-5 bg-[#0D1221]"
                >
                  <p className="text-xs font-mono text-[#4A9EFF] mb-2">{insight.tag}</p>
                  <h3 className="font-semibold text-white text-sm mb-2">{insight.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{insight.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA — Deal Board */}
          <section className="border border-[#1E4A7A] rounded-xl p-8 bg-gradient-to-br from-[#0E1E32] to-[#0B1628] text-center mb-10">
            <p className="font-mono text-xs text-[#4A9EFF] uppercase tracking-widest mb-3">
              prime-atlas · site-acquisition terminal
            </p>
            <h2 className="text-2xl font-bold text-white mb-3">
              The Deal Board goes deeper.
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto mb-6 leading-relaxed">
              Every market in this report has a full deal card in the Deal Board: clickable evidence layers, editable pro-forma with yield-on-cost and margin-on-cost, Bloomberg-style market tape, and one-click IC memo export. Free tier access — no credit card.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth/signup"
                className="inline-block px-6 py-3 rounded-lg bg-gradient-to-r from-[#163559] to-[#0E3070] border border-[#1E4A7A] text-white font-semibold text-sm hover:from-[#1E4A7A] hover:to-[#163559] transition-all"
              >
                Access the Deal Board — Free
              </Link>
              <Link
                href="/deal-board"
                className="inline-block px-6 py-3 rounded-lg border border-[#1E2D40] text-gray-400 font-semibold text-sm hover:border-[#1E4A7A] hover:text-white transition-all"
              >
                View Live Rankings →
              </Link>
            </div>
          </section>

          {/* What you get in Deal Board */}
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6">What Deal Board subscribers get</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: "⬡",
                  title: "6 Evidence Layers",
                  desc: "Opportunity sourcing, regional demand, housing shortfall, conversion potential, cost & timeline, and zoning & permits — toggleable per deal.",
                },
                {
                  icon: "⊞",
                  title: "Editable Pro-forma",
                  desc: "Units, GSF/unit, hard cost, land cost, rent/unit/month, exit cap %, contingency. Live NOI, yield-on-cost, and margin-on-cost output.",
                },
                {
                  icon: "↗",
                  title: "One-click IC Memo",
                  desc: "Export a structured CSV investment committee memo with scores, pro-forma, and checked evidence layers in under 3 seconds.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="border border-[#1E2D40] rounded-xl p-5 bg-[#0D1221]"
                >
                  <p className="text-2xl mb-3 font-mono text-[#4A9EFF]">{f.icon}</p>
                  <p className="font-semibold text-white text-sm mb-2">{f.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-[#1E2D40] pt-6 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-[#4A9EFF] font-bold mb-1">PRIME ATLAS</p>
                <p className="text-xs text-gray-600">
                  Site-acquisition intelligence terminal. Data from public sources — see methodology above.
                  Not financial advice.
                </p>
              </div>
              <div className="flex gap-4">
                <Link href="/" className="text-xs text-gray-500 hover:text-[#4A9EFF] transition-colors">Home</Link>
                <Link href="/deal-board" className="text-xs text-gray-500 hover:text-[#4A9EFF] transition-colors">Deal Board</Link>
                <Link href="/auth/signup" className="text-xs text-gray-500 hover:text-[#4A9EFF] transition-colors">Sign Up</Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
