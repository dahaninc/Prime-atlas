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

/** Annual = 30% off, billed yearly. Matches the Stripe prices created with
 * lookup_key prime_atlas_<tier>_annual (see /api/stripe/checkout). */
const TIERS = [
  {
    id: "explorer",
    name: "Explorer",
    monthlyPrice: 29.99,
    annualMonthly: 20.99,
    annualTotal: 251.88,
    annualSavings: 108,
    tagline: "Entry-level access",
    description: "For investors getting started with US and UK deal flow.",
    cta: "Start Explorer",
    highlight: false,
    features: [
      "USA + UK listings terminal",
      "Macro & micro market analysis",
      "Investment thesis on every listing",
      "3-year exit projection",
      "10 contact reveals per month",
      "Standard filters (market, class, sort)",
      "Email support",
    ],
    locked: [
      "Unlimited contact reveals",
      "Full 3/5/10-yr exit architecture",
      "Saved searches & deal alerts",
      "Full comparables data",
      "API access & data export",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 69.99,
    annualMonthly: 48.99,
    annualTotal: 587.88,
    annualSavings: 252,
    tagline: "Recommended",
    description: "For active investors who need full intelligence and unlimited deal access.",
    cta: "Start Professional",
    highlight: true,
    features: [
      "Everything in Explorer",
      "Unlimited contact reveals",
      "Full exit architecture (3/5/10-yr IRR + cash-on-cash)",
      "Full comparables & transaction data",
      "Saved searches + deal alerts",
      "Advanced filters",
      "Conviction score deep-dive",
      "Priority email support",
    ],
    locked: [
      "API data access",
      "Bulk CSV/Excel export",
      "Portfolio tracking",
      "Team seats",
    ],
  },
  {
    id: "institutional",
    name: "Institutional",
    monthlyPrice: 89.99,
    annualMonthly: 62.99,
    annualTotal: 755.88,
    annualSavings: 324,
    tagline: "Full platform",
    description: "For professional investors and teams who need API access, export, and portfolio tools.",
    cta: "Start Institutional",
    highlight: false,
    features: [
      "Everything in Professional",
      "API data access",
      "Bulk CSV & Excel export",
      "Portfolio tracking (up to 50 properties)",
      "3 team seats included",
      "Priority deal flow alerts",
      "Dedicated account manager",
    ],
    locked: [],
  },
] as const;

type TierId = typeof TIERS[number]["id"];
type Billing = "monthly" | "annual";

const COMPARISON_ROWS = [
  { label: "USA + UK listings terminal",          explorer: true,   professional: true,        institutional: true },
  { label: "Macro & micro market analysis",        explorer: true,   professional: true,        institutional: true },
  { label: "Investment thesis per listing",        explorer: true,   professional: true,        institutional: true },
  { label: "Contact reveals",                      explorer: "10/mo", professional: "Unlimited", institutional: "Unlimited" },
  { label: "Exit projections",                     explorer: "3-yr", professional: "3/5/10-yr", institutional: "3/5/10-yr" },
  { label: "Comparables & transaction data",       explorer: false,  professional: true,        institutional: true },
  { label: "Saved searches & deal alerts",         explorer: false,  professional: true,        institutional: true },
  { label: "Advanced filters",                     explorer: false,  professional: true,        institutional: true },
  { label: "API data access",                      explorer: false,  professional: false,       institutional: true },
  { label: "Bulk CSV / Excel export",              explorer: false,  professional: false,       institutional: true },
  { label: "Portfolio tracking",                   explorer: false,  professional: false,       institutional: true },
  { label: "Team seats",                           explorer: false,  professional: false,       institutional: "3 seats" },
  { label: "Support",                              explorer: "Email", professional: "Priority email", institutional: "Dedicated manager" },
];

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CellValue({ val }: { val: boolean | string }) {
  if (val === false) return <span className="text-muted-foreground/30 text-lg font-mono">—</span>;
  if (val === true) return <CheckIcon className="text-pa-green mx-auto" />;
  return <span className="text-[11px] font-mono text-foreground">{val}</span>;
}

export function PricingClient({ isLoggedIn, currentTier, hasCustomer, cancelled, upgraded }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");

  async function handleUpgrade(tierId: TierId) {
    if (!isLoggedIn) {
      router.push(`/auth/signup?plan=${tierId}`);
      return;
    }
    if (hasCustomer) {
      setLoading("portal");
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      setLoading(null);
      return;
    }
    setLoading(tierId);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: tierId, interval: billing }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    setLoading(null);
  }

  function ctaLabel(tierId: TierId, cta: string) {
    if (currentTier === tierId && isLoggedIn) return "Manage subscription";
    if (hasCustomer) return "Change plan";
    return cta;
  }

  function isCurrentTier(tierId: TierId) {
    return isLoggedIn && currentTier === tierId;
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16">

      {/* Banners */}
      {upgraded && (
        <div className="mb-8 p-4 border border-pa-green/40 bg-pa-green/5 rounded-xl text-center">
          <p className="text-pa-green font-semibold text-sm">Subscription activated — welcome to Prime Atlas.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your access is live.{" "}
            <Link href="/listings" className="text-pa-green hover:underline">Open the terminal →</Link>
          </p>
        </div>
      )}
      {cancelled && (
        <div className="mb-8 p-4 border border-border bg-card rounded-xl text-center">
          <p className="text-sm text-muted-foreground">
            Checkout cancelled — no charge was made.{" "}
            <Link href="/pricing" className="text-pa-green hover:underline">Try again</Link>
          </p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-14 relative glow-ambient">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-pa-green animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-pa-green uppercase tracking-widest">
            Prime Atlas · Pricing
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-[1.05] tracking-tight">
          USA + UK Investment Intelligence.<br className="hidden sm:block" />{" "}
          <span className="text-gradient-primary">One Terminal. Three Tiers.</span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
          Every listing enriched with macro and micro analysis, conviction scores, and exit projections.
          Contact details unlocked for members. Priced well below CoStar and Crexi.
        </p>

        {/* Competitor comparison callout */}
        <div className="mt-6 inline-flex items-center gap-6 px-5 py-3 border border-border rounded-xl bg-card font-mono text-[10px] text-muted-foreground">
          <span>CoStar <span className="text-red-400 font-bold">$466/mo</span></span>
          <span className="text-border">|</span>
          <span>Crexi Intelligence <span className="text-red-400 font-bold">$299/mo</span></span>
          <span className="text-border">|</span>
          <span>Mashvisor <span className="text-yellow-400 font-bold">$49/mo</span></span>
          <span className="text-border">|</span>
          <span>Prime Atlas <span className="text-pa-green font-bold">from $29.99/mo</span></span>
        </div>

        {/* Billing toggle */}
        <div className="mt-10 flex flex-col items-center gap-2.5">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                billing === "monthly" ? "bg-foreground text-background shadow-lg" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`relative px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                billing === "annual" ? "bg-foreground text-background shadow-lg" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                billing === "annual" ? "bg-pa-green text-background" : "bg-pa-green/15 text-pa-green"
              }`}>
                −30%
              </span>
            </button>
          </div>
          <p className={`text-xs font-mono transition-opacity ${billing === "annual" ? "text-pa-green opacity-100" : "text-muted-foreground/50 opacity-0"}`}>
            Save up to $324/year on Institutional — billed once, not twelve times
          </p>
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
        {TIERS.map((tier) => {
          const isCurrent = isCurrentTier(tier.id);
          const isLoading = loading === tier.id || (loading === "portal" && isCurrent);

          return (
            <div key={tier.id} className={`relative flex flex-col ${tier.highlight ? "md:-mt-3 md:mb-3" : ""}`}>
              {/* Floating badge — overlaps the top edge, like the reference */}
              {tier.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-[0_4px_16px_rgba(37,99,235,0.5)]">
                  ⭐ Most Popular
                </div>
              )}

              <div
                className={`flex flex-col flex-1 overflow-hidden ${
                  tier.highlight ? "card-spotlight" : "card-premium"
                } ${isCurrent && !tier.highlight ? "border-pa-green/30" : ""}`}
              >
                {/* Terminal title bar */}
                <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                  tier.highlight ? "border-white/10" : "border-border bg-secondary/30"
                }`}>
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${
                    tier.highlight ? "text-white/50" : "text-muted-foreground/50"
                  }`}>
                    {tier.tagline}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {billing === "annual" && (
                      <span className="text-[8px] font-mono font-bold text-pa-green bg-pa-green/10 border border-pa-green/30 rounded px-1.5 py-0.5">
                        −30%
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[8px] font-mono font-bold text-pa-green/70 border border-pa-green/25 rounded px-1.5 py-0.5">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  {/* Price */}
                  <div className="mb-5">
                    <p className={`text-[11px] font-mono font-bold uppercase tracking-widest mb-1.5 ${
                      tier.highlight ? "text-white/60" : "text-muted-foreground/60"
                    }`}>
                      {tier.name}
                    </p>
                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                      {billing === "annual" && (
                        <span className={`text-lg line-through font-mono ${tier.highlight ? "text-white/30" : "text-muted-foreground/50"}`}>
                          ${tier.monthlyPrice.toFixed(2)}
                        </span>
                      )}
                      <span className={`text-4xl font-extrabold font-mono ${tier.highlight ? "text-white" : "text-foreground"}`}>
                        ${(billing === "annual" ? tier.annualMonthly : tier.monthlyPrice).toFixed(2)}
                      </span>
                      <span className={`text-sm ${tier.highlight ? "text-white/50" : "text-muted-foreground"}`}>/month</span>
                      {billing === "annual" && (
                        <span className="text-[10px] font-bold text-pa-green bg-pa-green/15 border border-pa-green/30 rounded-full px-2 py-0.5">
                          −30%
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mb-2 h-4 font-mono ${tier.highlight ? "text-pa-green/90" : "text-muted-foreground/70"}`}>
                      {billing === "annual"
                        ? `Billed $${tier.annualTotal.toFixed(2)}/yr · save $${tier.annualSavings}`
                        : "Billed monthly"}
                    </p>
                    <p className={`text-xs leading-relaxed ${tier.highlight ? "text-white/60" : "text-muted-foreground"}`}>
                      {tier.description}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 flex-1 mb-6">
                    {tier.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2 text-xs ${tier.highlight ? "text-white/85" : "text-foreground/80"}`}>
                        <CheckIcon className="text-pa-green flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                    {"locked" in tier && tier.locked.length > 0 && (
                      <>
                        <li className={`pt-1 pb-0.5 border-t ${tier.highlight ? "border-white/10" : "border-border/40"}`} />
                        {tier.locked.map((f) => (
                          <li key={f} className={`flex items-start gap-2 text-xs ${tier.highlight ? "text-white/25" : "text-muted-foreground/30"}`}>
                            <span className="text-[10px] mt-0.5 flex-shrink-0">—</span>
                            {f}
                          </li>
                        ))}
                      </>
                    )}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={isLoading}
                    className={`w-full text-center text-sm font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                      tier.highlight
                        ? "btn-premium bg-primary text-white hover:bg-primary/90"
                        : "border border-border text-foreground hover:border-pa-green/40 hover:text-pa-green"
                    }`}
                  >
                    {isLoading && (
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                    {ctaLabel(tier.id, tier.cta)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full comparison table */}
      <div className="border border-border rounded-xl overflow-hidden mb-14">
        <div className="px-4 py-3 bg-secondary/30 border-b border-border">
          <span className="text-[9px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest">
            Full Feature Comparison
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/20">
                <th className="text-left px-4 py-3 text-[10px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest w-1/2">Feature</th>
                <th className="text-center px-4 py-3 text-[10px] font-mono font-bold text-muted-foreground/70 uppercase tracking-widest">Explorer</th>
                <th className="text-center px-4 py-3 text-[10px] font-mono font-bold text-pa-green uppercase tracking-widest">Professional</th>
                <th className="text-center px-4 py-3 text-[10px] font-mono font-bold text-muted-foreground/70 uppercase tracking-widest">Institutional</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={row.label} className={`border-b border-border/40 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.label}</td>
                  <td className="px-4 py-3 text-center"><CellValue val={row.explorer} /></td>
                  <td className="px-4 py-3 text-center bg-pa-green/[0.02]"><CellValue val={row.professional} /></td>
                  <td className="px-4 py-3 text-center"><CellValue val={row.institutional} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-[10px] font-mono text-muted-foreground/40 mb-14">
        All prices in USD. Cancel anytime. No setup fees. Annual plans billed in full upfront, 30% off the monthly rate.
      </p>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-bold mb-6 font-mono text-center uppercase tracking-widest text-muted-foreground">FAQ</h2>
        <div className="space-y-5">
          {[
            {
              q: "Where does the listing data come from?",
              a: "Prime Atlas runs proprietary data pipelines across USA and UK markets. Every listing is enriched with our own macro and micro analysis before it's presented — you're seeing Prime Atlas intelligence, curated and conviction-graded for investors.",
            },
            {
              q: "What is a 'contact reveal'?",
              a: "When you want the seller's or agent's contact details for a listing, that counts as one reveal. Explorer members get 10 per month. Professional and Institutional members have unlimited reveals.",
            },
            {
              q: "How does Prime Atlas compare to CoStar or Crexi?",
              a: "CoStar starts at $466/month and is US-only commercial. Crexi Intelligence is $299/month, also US-focused. Prime Atlas covers both USA and UK residential and commercial at a fraction of the cost, with the same conviction-framework approach.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes. Cancel from the member portal at any time — you keep access until the end of your billing period.",
            },
            {
              q: "How does annual billing work?",
              a: "Switch to Yearly and every tier drops 30% versus paying monthly — charged as one upfront annual payment rather than 12 separate charges. You can still cancel anytime from the member portal; you keep access through the end of the paid year.",
            },
            {
              q: "Do you offer team plans?",
              a: "Institutional ($89.99/mo) includes 3 team seats. For larger teams, contact us at institutional@prime-atlas.com.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="border-b border-border/40 pb-5">
              <p className="font-semibold text-sm mb-1.5">{q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}
