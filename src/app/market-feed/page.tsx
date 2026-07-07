import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MarketFeedExplorer, type ScrapedProperty } from "@/components/market-feed/MarketFeedExplorer";
import { isPaidTier, redactRows } from "@/lib/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Feed | Prime Atlas",
  description:
    "Live property intelligence feed — residential and commercial listings across USA and UK markets, regularly refreshed. Powered by Prime Atlas.",
};

const PROPERTY_COLUMNS = "id, provider, address, price, currency_code, bedrooms, bathrooms, size_sqm, property_type, listing_type, scraped_at, images";

// PostgREST caps every request at 1000 rows (Supabase's db-max-rows) even if
// .limit() asks for more, so a segment above that size must be paged with
// .range() to be fetched in full.
const PAGE_SIZE = 1000;

async function fetchSegment(
  supabase: SupabaseClient<Database>,
  currencyCode: string,
  listingType: string
) {
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("currency_code", currencyCode)
    .eq("listing_type", listingType);

  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from("properties")
        .select(PROPERTY_COLUMNS)
        .eq("status", "active")
        .eq("currency_code", currencyCode)
        .eq("listing_type", listingType)
        .order("scraped_at", { ascending: false })
        .range(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE - 1)
    )
  );
  return results.flatMap((r) => r.data ?? []);
}

export default async function MarketFeedPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();

  // Fetched as separate per-segment queries (not one global recency-ordered
  // limit) so a scrape run skewed toward one country/listing-type can't push
  // another segment out of the window entirely — e.g. a UK-heavy scrape
  // batch previously starved "USA + for sale" down to zero visible listings
  // even though thousands were active in the table.
  const SEGMENTS: Array<{ currency_code: string; listing_type: string }> = [
    { currency_code: "USD", listing_type: "sale" },
    { currency_code: "USD", listing_type: "rent" },
    { currency_code: "GBP", listing_type: "sale" },
    { currency_code: "GBP", listing_type: "rent" },
  ];

  const [{ data: { user } }, ...segmentResults] = await Promise.all([
    supabase.auth.getUser(),
    ...SEGMENTS.map((seg) => fetchSegment(supabase, seg.currency_code, seg.listing_type)),
  ]);
  const rawProperties = segmentResults.flat();

  // Non-members (anonymous or free) get locality-level addresses and no
  // photos — redacted server-side so the data never reaches the browser.
  const { data: profile } = user
    ? await supabase.from("profiles").select("subscription_tier").eq("id", user.id).single()
    : { data: null };
  const isMember = isPaidTier((profile as { subscription_tier?: string } | null)?.subscription_tier);
  const properties = redactRows((rawProperties ?? []) as ScrapedProperty[], isMember);

  const total    = properties.length;
  const forSale  = properties.filter(p => p.listing_type === "sale").length;
  const forRent  = properties.filter(p => p.listing_type === "rent").length;
  const mostRecent = properties.reduce<string | null>(
    (latest, p) => (!latest || p.scraped_at > latest ? p.scraped_at : latest), null
  );
  const lastSync = mostRecent
    ? new Date(mostRecent).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <>
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <span>Market Feed</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
            <span className="text-[10px] font-bold text-pa-green uppercase tracking-widest">Live Market Data</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">
            Market Intelligence Feed
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mb-6">
            Live residential and commercial listings across USA and UK markets — regularly refreshed. Filter by market, type and price.
          </p>

          {/* Stat strip */}
          <div className="flex flex-wrap gap-6 mb-2">
            <div>
              <p className="text-2xl font-bold font-mono text-primary">{total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total listings</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-primary">{forSale.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">For sale</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-primary">{forRent.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">For rent</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-primary">2</p>
              <p className="text-xs text-muted-foreground">Markets</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{lastSync}</p>
              <p className="text-xs text-muted-foreground">Last synced</p>
            </div>
          </div>

          {/* Data freshness badge — no source branding */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
            <span className="text-[9px] text-muted-foreground">
              Last synced {lastSync} · {total.toLocaleString()} active listings · USA + UK
            </span>
          </div>
        </div>

        {/* Explorer */}
        <MarketFeedExplorer properties={properties} initialQuery={q} />

        {/* Bottom CTA */}
        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 items-center justify-between">
          <div>
            <p className="text-sm font-semibold mb-1">Looking for curated investment deals?</p>
            <p className="text-xs text-muted-foreground">Our hand-scored listings include yield, margin and conviction scores.</p>
          </div>
          <Link
            href="/listings"
            className="text-sm font-semibold text-pa-green hover:underline"
          >
            View curated listings →
          </Link>
        </div>

      </main>

      <Footer />
    </>
  );
}
