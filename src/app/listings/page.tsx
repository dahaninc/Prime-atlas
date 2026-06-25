import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListingsExplorer, type FullListing } from "@/components/listings/ListingsExplorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Investment Listings | Prime Atlas",
  description:
    "Curated development sites, commercial assets, and buy-to-rent opportunities — segmented by investor profile with real yield and margin data.",
};

export default async function ListingsPage() {
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: rawListings },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("listings")
      .select(`
        id, title, address, listing_type,
        deal_type, investor_profile,
        asking_price, currency_code,
        size_sqm, planning_status,
        gross_yield_pct, gdv_margin_pct, annual_income,
        description, date_listed, status, featured,
        postcode,
        municipalities(
          name, slug, country,
          opportunity_score, growth_score, risk_score
        )
      `)
      .in("status", ["active", "under_offer"])
      .order("featured", { ascending: false })
      .order("date_listed", { ascending: false }),
  ]);

  const listings = (rawListings ?? []) as unknown as FullListing[];
  const total    = listings.length;
  const featured = listings.filter((l) => l.featured).length;
  const countries = new Set(listings.map((l) => l.municipalities?.country).filter(Boolean)).size;

  return (
    <>
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <span>Live Listings</span>
        </nav>

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
            <span className="text-[10px] font-bold text-pa-green uppercase tracking-widest">Live Deal Flow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">
            Investment Opportunities
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mb-6">
            Every listing is scored against the Prime Atlas conviction framework — market ROI index, growth trajectory
            and risk profile. Select your investor profile to see deals relevant to your strategy.
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

        {/* Explorer */}
        <ListingsExplorer listings={listings} />

        {/* Browse by market */}
        <div className="mt-10 pt-8 border-t border-border">
          <p className="font-semibold text-sm mb-3">Browse by market</p>
          <div className="flex gap-3 flex-wrap">
            <Link href="/deal-board"               className="text-xs text-pa-green hover:underline">Global Deal Board →</Link>
            <Link href="/opportunities/london"     className="text-xs text-pa-green hover:underline">London →</Link>
            <Link href="/opportunities/manchester" className="text-xs text-pa-green hover:underline">Manchester →</Link>
            <Link href="/opportunities/new-york-ny" className="text-xs text-pa-green hover:underline">New York →</Link>
            <Link href="/opportunities/sydney-nsw"  className="text-xs text-pa-green hover:underline">Sydney →</Link>
            <Link href="/opportunities/toronto-on"  className="text-xs text-pa-green hover:underline">Toronto →</Link>
            <Link href="/opportunities/madrid"      className="text-xs text-pa-green hover:underline">Madrid →</Link>
            <Link href="/opportunities/barcelona"   className="text-xs text-pa-green hover:underline">Barcelona →</Link>
          </div>
        </div>

      </main>

      <Footer />
    </>
  );
}
