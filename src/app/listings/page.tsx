import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ListingsExplorer, type FullListing } from "@/components/listings/ListingsExplorer";
import { redactStreet } from "@/lib/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Investment Listings | Prime Atlas",
  description:
    "Curated development sites, commercial assets, and buy-to-rent opportunities — segmented by investor profile with real yield and margin data.",
};

export default async function ListingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: rawListings },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("listings")
      .select(`
        id, title, address, listing_type,
        deal_type, investor_profile,
        asking_price, currency_code,
        size_sqm, planning_status,
        gross_yield_pct, gdv_margin_pct, annual_income,
        description, date_listed, status, featured,
        postcode, bedrooms, images, highlights,
        municipalities(
          name, slug, country,
          opportunity_score, growth_score, risk_score
        )
      `)
      .in("status", ["active", "under_offer"])
      .order("featured", { ascending: false })
      .order("date_listed", { ascending: false }),
    user
      ? supabase.from("profiles").select("subscription_tier").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  const isMember = ["explorer", "professional", "institutional"].includes(
    (profile as { subscription_tier?: string } | null)?.subscription_tier ?? ""
  );
  // Non-members: strip real property photos and street addresses server-side
  // (cards fall back to decorative stock; the card already renders a locality
  // summary — but the full string must never reach the client DOM).
  const listings = ((rawListings ?? []) as unknown as FullListing[]).map((l) =>
    isMember ? l : { ...l, images: [], address: redactStreet(l.address) ?? l.municipalities?.name ?? "Location on file" }
  );
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
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-pa-green uppercase tracking-widest">Live Deal Flow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">
            Investment Listings Terminal
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {total} active listings across {countries} markets · Each scored against the Prime Atlas conviction
            framework — ROI index, growth trajectory, and risk profile.
          </p>
        </div>

        {/* Explorer */}
        <ListingsExplorer listings={listings} isMember={isMember} />

        {/* Browse by market */}
        <div className="mt-10 pt-8 border-t border-border">
          <p className="font-semibold text-sm mb-3">Browse by market</p>
          <div className="flex gap-3 flex-wrap">
            <Link href="/deal-board"                className="text-xs text-pa-green hover:underline">Deal Board →</Link>
            <Link href="/opportunities/london"      className="text-xs text-pa-green hover:underline">London →</Link>
            <Link href="/opportunities/manchester"  className="text-xs text-pa-green hover:underline">Manchester →</Link>
            <Link href="/opportunities/birmingham"  className="text-xs text-pa-green hover:underline">Birmingham →</Link>
            <Link href="/opportunities/new-york-ny" className="text-xs text-pa-green hover:underline">New York →</Link>
            <Link href="/opportunities/los-angeles-ca" className="text-xs text-pa-green hover:underline">Los Angeles →</Link>
            <Link href="/opportunities/chicago-il"  className="text-xs text-pa-green hover:underline">Chicago →</Link>
          </div>
        </div>

      </main>

      <Footer />
    </>
  );
}
