import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "About prime-atlas | Spain Property Intelligence Platform",
  description:
    "prime-atlas is an AI-powered property intelligence platform ranking Spain's highest-conviction investment municipalities. Built for investors, developers, and capital allocators.",
};

export default async function AboutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <Navbar user={user} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <nav className="text-xs text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>About</span>
        </nav>

        <h1 className="text-4xl font-bold mb-4">About prime-atlas</h1>
        <p className="text-pa-green font-mono text-sm mb-10">
          The Bloomberg for Future Investment Opportunities in Spain.
        </p>

        <div className="prose prose-sm prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">What we do</h2>
            <p>
              prime-atlas is a property intelligence platform that identifies, scores, and ranks Spain&apos;s
              highest-conviction investment municipalities before the mainstream market recognises them.
              We aggregate public data — infrastructure approvals, planning applications, population
              trends, and economic signals — and process it through a proprietary scoring engine to
              produce weekly-updated Opportunity Scores for every tracked municipality.
            </p>
            <p className="mt-3">
              The result is a ranked, real-time index of where in Spain capital is most likely to
              appreciate over a 12–36 month investment horizon — before institutional capital
              deployment drives prices to market rate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">The problem we solve</h2>
            <p>
              Professional investors and property developers operating in Spain spend significant
              resource identifying opportunities that are already public knowledge. By the time a
              location appears in mainstream media, property portals, or sell-side research, the
              alpha is gone.
            </p>
            <p className="mt-3">
              prime-atlas inverts this dynamic. Our signal detection layer monitors planning
              registers, infrastructure procurement notices, population data, and economic indicators
              continuously — surfacing investment signals weeks or months before they reach the
              market.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">How our scoring works</h2>
            <p>
              Every municipality tracked by prime-atlas receives a weekly composite Opportunity Score
              (0–100) derived from five weighted sub-scores:
            </p>
            <ul className="mt-3 space-y-2 list-none pl-0">
              {[
                ["Growth Score (25%)", "Population growth rate, net migration, and residential transaction velocity."],
                ["Infrastructure Score (25%)", "Quantum and quality of approved and under-construction public infrastructure — roads, rail, ports, utilities."],
                ["Development Score (25%)", "Planning application volume, permit approvals, and developer activity."],
                ["Liquidity Score (15%)", "Transaction volume, price stability, and depth of buyer demand."],
                ["Risk Score (10%)", "Inverted: lower risk municipalities score higher. Includes debt levels, employment concentration, and planning authority track record."],
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
                { tier: "Free", who: "Individual investors, researchers, and property enthusiasts exploring Spain." },
                { tier: "Pro", who: "Active investors and property professionals running live deal pipelines in Spain." },
                { tier: "Institutional", who: "Funds, family offices, and developers deploying capital across multiple Spanish regions." },
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
          <Link href="/rankings" className="text-sm text-pa-green hover:underline">Spain Opportunity Index →</Link>
          <Link href="/methodology" className="text-sm text-pa-green hover:underline">Methodology →</Link>
          <Link href="/pricing" className="text-sm text-pa-green hover:underline">Pricing →</Link>
          <Link href="/auth/signup" className="text-sm text-pa-green hover:underline">Get started free →</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
