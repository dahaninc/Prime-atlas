import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LiveListings } from "@/components/listings/LiveListings";
import type { Listing } from "@/components/listings/LiveListings";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Live Listings | prime-atlas",
  description:
    "Curated real estate, land, and development sites across UK, US, Australia, Canada, and Spain — each scored against the Prime Atlas conviction framework. Research-backed listings for every investor.",
};

const COUNTRY_CONFIG: Record<string, { flag: string; code: string }> = {
  "United Kingdom": { flag: "🇬🇧", code: "UK" },
  "United States":  { flag: "🇺🇸", code: "US" },
  "Australia":      { flag: "🇦🇺", code: "AU" },
  "Canada":         { flag: "🇨🇦", code: "CA" },
  "Spain":          { flag: "🇪🇸", code: "ES" },
};

const LISTING_TYPE_LABEL: Record<string, string> = {
  "land":             "Land",
  "residential":      "Residential",
  "commercial":       "Commercial",
  "mixed-use":        "Mixed-use",
  "development-site": "Development Site",
  "industrial":       "Industrial",
  "pbsa":             "PBSA",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", AUD: "A$", CAD: "C$",
};

function formatPrice(pence: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const amount = pence / 100;
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `${sym}${(amount / 1_000).toFixed(0)}K`;
  return `${sym}${amount.toLocaleString()}`;
}

export default async function ListingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all active listings with municipality context
  const { data: rawListings } = await supabase
    .from("listings")
    .select("*, municipalities(name, slug, country, opportunity_score, growth_score, risk_score)")
    .in("status", ["active", "under_offer"])
    .order("featured", { ascending: false })
    .order("date_listed", { ascending: false });

  const listings = (rawListings ?? []) as unknown as Listing[];

  // Group by country
  const byCountry: Record<string, Listing[]> = {};
  for (const l of listings) {
    const country = l.municipalities?.country ?? "Other";
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(l);
  }

  const countryOrder = ["United Kingdom", "United States", "Australia", "Canada", "Spain"];
  const total        = listings.length;
  const featured     = listings.filter((l) => l.featured).length;
  const countries    = Object.keys(byCountry).length;

  return (
    <>
      <Navbar user={user} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <span>Live Listings</span>
        </nav>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
            <span className="text-xs text-pa-green font-mono font-semibold uppercase tracking-widest">Live</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
            Real estate listings.<br />
            <span className="text-pa-green">Research-backed conviction on every deal.</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl leading-relaxed mb-6">
            Every listing here is scored against the Prime Atlas conviction framework — ROI index, growth momentum, and
            risk score alongside the asking price. No other portal gives you this context.
          </p>

          {/* Stat strip */}
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-2xl font-bold font-mono text-pa-green">{total}</p>
              <p className="text-xs text-muted-foreground">Active listings</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-pa-green">{countries}</p>
              <p className="text-xs text-muted-foreground">Countries</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-pa-green">{featured}</p>
              <p className="text-xs text-muted-foreground">Featured deals</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-pa-green">100%</p>
              <p className="text-xs text-muted-foreground">Research-scored</p>
            </div>
          </div>
        </div>

        {/* Value prop banner */}
        <div className="border border-pa-green/20 rounded-xl p-5 bg-pa-green/[0.03] mb-10">
          <p className="text-xs font-bold text-pa-green uppercase tracking-widest mb-2">What makes a Prime Atlas listing different</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every listing below includes the market&apos;s ROI Feasibility Index, growth score, and risk score from the Prime Atlas
            research engine — the same data that powers the Deal Board and IC memo. You see not just the price, but whether
            the market justifies the investment. No other portal gives you this.
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            <Link href="/deal-board" className="text-xs text-pa-green hover:underline">Open Deal Board →</Link>
            <a href="mailto:deals@prime-atlas.com?subject=List my deal on Prime Atlas" className="text-xs text-pa-green hover:underline">List your deal →</a>
          </div>
        </div>

        {/* Listings by country */}
        {total === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground mb-2">No active listings right now.</p>
            <a href="mailto:deals@prime-atlas.com?subject=List my deal on Prime Atlas" className="text-sm text-pa-green hover:underline">
              Submit a listing →
            </a>
          </div>
        ) : (
          <div className="space-y-14">
            {countryOrder
              .filter((c) => byCountry[c]?.length)
              .map((country) => {
                const cfg = COUNTRY_CONFIG[country];
                const countryListings = byCountry[country];
                return (
                  <section key={country}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cfg?.flag}</span>
                        <div>
                          <h2 className="font-bold text-lg">{country}</h2>
                          <p className="text-xs text-muted-foreground">{countryListings.length} listing{countryListings.length > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    </div>
                    <LiveListings
                      listings={countryListings}
                      heading=""
                      showMarketLink={false}
                    />
                  </section>
                );
              })}
          </div>
        )}

        {/* Submit a listing CTA */}
        <div className="mt-16 border border-border rounded-xl p-8 text-center bg-card">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">For agents & developers</p>
          <h2 className="text-xl font-bold mb-3">List your deal here</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto leading-relaxed">
            Reach investors who already have conviction in your market. Every Prime Atlas user has reviewed the ROI index,
            growth signals, and risk score for the area — they arrive pre-informed, not cold.
          </p>
          <a
            href="mailto:deals@prime-atlas.com?subject=List my deal on Prime Atlas"
            className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-8 py-3 rounded-lg hover:bg-pa-green/90 transition-colors"
          >
            Submit your listing →
          </a>
        </div>

        {/* Browse by market */}
        <div className="mt-10 pt-8 border-t border-border">
          <h3 className="font-semibold text-sm mb-4">Browse by market</h3>
          <div className="flex gap-3 flex-wrap">
            <Link href="/deal-board"              className="text-xs text-pa-green hover:underline">Global Deal Board →</Link>
            <Link href="/opportunities/london"    className="text-xs text-pa-green hover:underline">London →</Link>
            <Link href="/opportunities/manchester" className="text-xs text-pa-green hover:underline">Manchester →</Link>
            <Link href="/opportunities/new-york-ny" className="text-xs text-pa-green hover:underline">New York →</Link>
            <Link href="/opportunities/sydney-nsw"  className="text-xs text-pa-green hover:underline">Sydney →</Link>
            <Link href="/opportunities/toronto-on"  className="text-xs text-pa-green hover:underline">Toronto →</Link>
            <Link href="/opportunities/madrid"       className="text-xs text-pa-green hover:underline">Madrid →</Link>
            <Link href="/opportunities/barcelona"    className="text-xs text-pa-green hover:underline">Barcelona →</Link>
          </div>
        </div>

      </main>

      <Footer />
    </>
  );
}
