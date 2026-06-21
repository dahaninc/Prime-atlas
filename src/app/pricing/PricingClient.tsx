"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  isLoggedIn: boolean;
  currentTier: string;
  hasCustomer: boolean;
  cancelled: boolean;
  upgraded: boolean;
}

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    period: "forever",
    description: "Public rankings, opportunity pages, and basic search. The SEO acquisition layer.",
    cta: "Get started free",
    highlight: false,
    features: [
      "Spain Opportunity Index (public)",
      "Coastal, Development & Infrastructure Indexes",
      "Municipality opportunity pages",
      "Basic search (municipality + opportunity)",
      "Signals feed (48hr delay)",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€149",
    period: "/month",
    description: "For active investors and property professionals who need live intelligence.",
    cta: "Start Pro",
    highlight: true,
    features: [
      "Everything in Free",
      "Opportunity Finder (budget, geography, risk profile)",
      "AI investment theses powered by Claude",
      "Live Signals feed — real-time",
      "Watchlists + email alerts",
      "Score radar + breakdown charts",
      "Weekly intelligence digest",
    ],
  },
  {
    id: "investor",
    name: "Investor",
    price: "€499",
    period: "/month",
    description: "For professional investors managing multiple mandates across Spain.",
    cta: "Start Investor",
    highlight: false,
    features: [
      "Everything in Pro",
      "Multi-region, multi-category filtering",
      "Detailed opportunity reports",
      "Portfolio watchlist with custom alerts",
      "Planning application tracker",
      "Infrastructure project pipeline",
      "Priority support",
    ],
  },
  {
    id: "institutional",
    name: "Institutional",
    price: "Custom",
    period: "",
    description: "API access, bulk intelligence, enterprise dashboards, and prime-atlas Capital.",
    cta: "Contact us",
    highlight: false,
    features: [
      "Everything in Investor",
      "REST API access",
      "Bulk municipality intelligence",
      "Custom datasets on request",
      "Enterprise dashboards",
      "prime-atlas Capital (deal introductions)",
      "SLA + dedicated support",
    ],
  },
];

export function PricingClient({ isLoggedIn, currentTier, hasCustomer, cancelled, upgraded }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(tierId: string) {
    if (tierId === "free") {
      router.push("/auth/signup");
      return;
    }
    if (tierId === "institutional") {
      window.location.href = "mailto:institutional@prime-atlas.com";
      return;
    }
    if (!isLoggedIn) {
      router.push(`/auth/signup?plan=${tierId}`);
      return;
    }

    // If already subscribed to something, open Customer Portal
    if (hasCustomer) {
      setLoading("portal");
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      setLoading(null);
      return;
    }

    // New checkout
    setLoading(tierId);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: tierId }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    setLoading(null);
  }

  function ctaLabel(tier: typeof TIERS[0]) {
    if (tier.id === "institutional") return "Contact us";
    if (tier.id === "free") return isLoggedIn ? "Current plan" : "Get started free";
    if (currentTier === tier.id) return "Manage subscription";
    if (hasCustomer) return "Change plan";
    return tier.cta;
  }

  function isCurrentTier(tierId: string) {
    return isLoggedIn && currentTier === tierId;
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Banners */}
      {upgraded && (
        <div className="mb-8 p-4 border border-pa-green/40 bg-pa-green/5 rounded-xl text-center">
          <p className="text-pa-green font-semibold text-sm">🎉 Subscription activated — welcome to prime-atlas Pro!</p>
          <p className="text-xs text-muted-foreground mt-1">Your access has been upgraded. <Link href="/opportunities/finder" className="text-pa-green hover:underline">Try the Opportunity Finder →</Link></p>
        </div>
      )}
      {cancelled && (
        <div className="mb-8 p-4 border border-border bg-card rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Checkout cancelled — no charge was made. <Link href="/pricing" className="text-pa-green hover:underline">Try again</Link></p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">Pricing</p>
        <h1 className="text-4xl font-bold mb-4">Start free. Upgrade when you find your next deal.</h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          The public indexes are free forever — they&apos;re how you discover prime-atlas.
          Upgrade when you&apos;re ready for live intelligence and the Opportunity Finder.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = isCurrentTier(tier.id);
          const isLoading = loading === tier.id || (loading === "portal" && isCurrentTier(tier.id));

          return (
            <div
              key={tier.id}
              className={`border rounded-xl p-6 flex flex-col relative ${
                tier.highlight
                  ? "border-pa-green/40 bg-pa-green/5"
                  : isCurrent
                  ? "border-pa-green/20 bg-card"
                  : "border-border bg-card"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-pa-green text-pa-navy text-xs font-bold px-3 py-1 rounded-full">
                    Most popular
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-secondary border border-border text-xs font-semibold px-3 py-1 rounded-full text-foreground">
                    Current plan
                  </span>
                </div>
              )}

              <div className="mb-5">
                <p className="font-semibold text-sm mb-1">{tier.name}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold font-mono">{tier.price}</span>
                  <span className="text-muted-foreground text-sm">{tier.period}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{tier.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <svg className="w-3.5 h-3.5 text-pa-green flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(tier.id)}
                disabled={isLoading || (isCurrent && tier.id === "free")}
                className={`w-full text-center text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
                  tier.highlight
                    ? "bg-pa-green text-pa-navy hover:bg-pa-green/90"
                    : isCurrent
                    ? "border border-pa-green/30 text-pa-green hover:bg-pa-green/5"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {isLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {ctaLabel(tier)}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        All prices exclude VAT. Cancel anytime. Institutional pricing on request.
      </p>

      {/* FAQ */}
      <div className="mt-16 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-8 text-center">Frequently asked questions</h2>
        <div className="space-y-6">
          {[
            {
              q: "What's included in the free tier?",
              a: "All public Spain Opportunity Indexes, municipality pages, and our signals feed with a 48-hour delay. Free users can see rankings but not the real-time signals or Opportunity Finder."
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes. Cancel from the Customer Portal at any time — you keep access until the end of your billing period, then revert to free."
            },
            {
              q: "What does 'live signals' mean?",
              a: "Pro subscribers get signals pushed in real-time as our system detects planning applications, infrastructure news, and market events. Free users see the same signals after a 48-hour delay."
            },
            {
              q: "How are opportunity scores calculated?",
              a: "Scores are a weighted composite of growth momentum, infrastructure pipeline, development potential, liquidity, and inverted risk — updated nightly via our scoring engine."
            },
            {
              q: "What is prime-atlas Capital?",
              a: "An Institutional-tier feature that introduces qualified investors to deal sponsors and operators for off-market opportunities in Spain. Contact us for details."
            },
          ].map(({ q, a }) => (
            <div key={q} className="border-b border-border pb-6">
              <p className="font-semibold text-sm mb-2">{q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
