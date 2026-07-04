import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "About Prime Atlas | USA + UK Investment Intelligence Platform",
  description:
    "Prime Atlas is an institutional-grade property intelligence platform covering USA and UK markets. Investment theses, conviction scores, and live deal flow — built for investors, developers, and capital allocators.",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <nav className="text-xs text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>About</span>
        </nav>

        <h1 className="text-4xl font-bold mb-4">About Prime Atlas</h1>
        <p className="text-pa-green font-mono text-sm mb-10">
          Institutional investment intelligence for USA + UK property markets.
        </p>

        <div className="prose prose-sm prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">What we do</h2>
            <p>
              Prime Atlas is a cross-market property intelligence platform covering the United States and
              United Kingdom. We aggregate live listing data, public planning records, infrastructure pipelines,
              and economic indicators — and process them through a proprietary scoring engine to produce
              conviction scores, macro/micro investment theses, and predictive exit projections for every
              tracked market and asset.
            </p>
            <p className="mt-3">
              The result is an institutional-grade terminal — similar to Mashvisor, CoStar, or Crexi — but
              spanning both USA and UK markets from a single platform, at a price designed for active investors
              rather than enterprise procurement budgets.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">The problem we solve</h2>
            <p>
              Professional investors and developers operating across USA and UK markets spend significant
              resource sourcing, underwriting, and positioning deals that are already priced into the
              market. By the time an opportunity appears in mainstream media or on public portals, the
              alpha is gone.
            </p>
            <p className="mt-3">
              Prime Atlas inverts this dynamic. Our signal layer monitors planning registers, infrastructure
              procurement notices, rental demand indices, and economic indicators continuously — surfacing
              investment signals weeks or months before they reach the market. Every listing on Prime Atlas
              arrives with a conviction score, macro outlook, micro outlook, and 3/5/10-year exit projection
              already attached.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">How our scoring works</h2>
            <p>
              Every market and asset tracked by Prime Atlas receives a composite Opportunity Score (0–100)
              derived from five weighted sub-scores:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                ["Growth Score (25%)", "Population growth rate, net migration, and residential transaction velocity."],
                ["Infrastructure Score (25%)", "Quantum and quality of approved and under-construction public infrastructure — roads, rail, ports, utilities."],
                ["Development Score (25%)", "Planning application volume, permit approvals, and developer activity."],
                ["Liquidity Score (15%)", "Transaction volume, price stability, and depth of buyer demand."],
                ["Risk Score (10%)", "Inverted: lower risk markets score higher. Includes debt levels, employment concentration, and planning authority track record."],
              ].map(([label, desc]) => (
                <li key={label} className="border-l-2 border-pa-green/30 pl-4">
                  <p className="text-foreground text-sm font-medium">{label}</p>
                  <p className="text-xs mt-0.5">{desc}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Scores are algorithmic estimates derived from public data and are not financial advice.
              See our <Link href="/methodology" className="text-pa-green hover:underline">Methodology</Link> page for full technical documentation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Who we serve</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {[
                { tier: "Explorer", who: "Individual investors and property enthusiasts exploring USA and UK markets. 10 contact reveals/month." },
                { tier: "Analyst", who: "Active investors running live deal pipelines across both markets. Unlimited contacts and full analytics." },
                { tier: "Institutional", who: "Funds, family offices, and developers deploying capital at scale. API access, export, and team seats." },
              ].map(({ tier, who }) => (
                <div key={tier} className="border border-border rounded-xl p-4 bg-card">
                  <p className="text-pa-green font-mono text-xs font-semibold mb-2">{tier}</p>
                  <p className="text-xs">{who}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Our principles</h2>
            <ul className="space-y-2 list-none pl-0">
              {[
                "We publish our methodology openly. Opacity in scoring is a trust liability.",
                "All scores carry a disclaimer: they are algorithmic estimates, not financial advice.",
                "We do not accept payment to influence rankings or signal placement.",
                "We use AI to accelerate analysis, not to fabricate data.",
              ].map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <span className="text-pa-green mt-0.5 flex-shrink-0">→</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">Contact</h2>
            <p>
              For commercial enquiries, partnership requests, or data licensing, contact us via the{" "}
              <Link href="/capital" className="text-pa-green hover:underline">Capital page</Link> or
              email{" "}
              <a href="mailto:hello@prime-atlas.com" className="text-pa-green hover:underline">
                hello@prime-atlas.com
              </a>.
            </p>
            <p className="mt-3">
              prime-atlas is operated by prime-atlas Ltd., registered in England and Wales.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4">
          <Link href="/listings" className="text-sm text-pa-green hover:underline">Listings Terminal →</Link>
          <Link href="/market-feed" className="text-sm text-pa-green hover:underline">Market Feed →</Link>
          <Link href="/pricing" className="text-sm text-pa-green hover:underline">Pricing →</Link>
          <Link href="/auth/signup" className="text-sm text-pa-green hover:underline">Get started free →</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
