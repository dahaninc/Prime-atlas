import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ImageGallery } from "@/components/listings/ImageGallery";
import { InquireForm } from "@/components/listings/InquireForm";
import { scoreColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* ─── helpers ─────────────────────────────────────────────────── */

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", AUD: "A$", CAD: "C$",
};

function formatPrice(pence: number, currency: string): string {
  const sym    = CURRENCY_SYMBOL[currency] ?? currency;
  const amount = pence / 100;
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `${sym}${(amount / 1_000).toFixed(0)}K`;
  return `${sym}${amount.toLocaleString()}`;
}

const LISTING_TYPE_LABEL: Record<string, string> = {
  "land":              "Land",
  "residential":       "Residential",
  "commercial":        "Commercial",
  "mixed-use":         "Mixed-use",
  "development-site":  "Development Site",
  "industrial":        "Industrial",
  "pbsa":              "PBSA",
};

const PLANNING_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  "with-permission":       { label: "Planning Granted",  classes: "text-pa-green border-pa-green/30 bg-pa-green/5" },
  "outline":               { label: "Outline Consent",   classes: "text-pa-amber border-pa-amber/30 bg-pa-amber/5" },
  "unconsented":           { label: "No Consent",        classes: "text-muted-foreground border-border bg-secondary/30" },
  "freehold":              { label: "Freehold",          classes: "text-blue-400 border-blue-400/30 bg-blue-400/5" },
  "permitted-development": { label: "PD Rights",         classes: "text-purple-400 border-purple-400/30 bg-purple-400/5" },
};

const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States":  "🇺🇸",
  "Australia":      "🇦🇺",
  "Canada":         "🇨🇦",
  "Spain":          "🇪🇸",
};

/* ─── metadata ─────────────────────────────────────────────────── */

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("title, description, asking_price, currency_code")
    .eq("id", id)
    .single();

  if (!data) return { title: "Listing Not Found | prime-atlas" };

  return {
    title: `${data.title} | prime-atlas`,
    description:
      data.description?.slice(0, 160) ??
      `${formatPrice(data.asking_price, data.currency_code)} — curated listing on Prime Atlas with full market conviction scores.`,
  };
}

/* ─── page ─────────────────────────────────────────────────────── */

export default async function ListingDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: listing },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("listings")
      .select(`
        *,
        municipalities(
          name, slug, country,
          opportunity_score, growth_score, risk_score,
          population
        )
      `)
      .eq("id", id)
      .in("status", ["active", "under_offer"])
      .single(),
  ]);

  if (!listing) notFound();

  const muni       = listing.municipalities as {
    name: string; slug: string; country: string;
    opportunity_score: number; growth_score: number; risk_score: number;
    population?: number;
  } | null;
  const planCfg    = listing.planning_status
    ? PLANNING_STATUS_CONFIG[listing.planning_status] ?? { label: listing.planning_status, classes: "text-muted-foreground border-border" }
    : null;
  const images     = (listing.images as string[] | null) ?? [];
  const features   = (listing.features as string[] | null) ?? [];
  const highlights = (listing.highlights as string[] | null) ?? [];

  return (
    <>
      <Navbar user={user} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <Link href="/listings" className="hover:text-foreground transition-colors">Live Listings</Link>
          {muni && (
            <>
              <span>/</span>
              <Link href={`/opportunities/${muni.slug}`} className="hover:text-foreground transition-colors">
                {muni.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground line-clamp-1">{listing.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left / Main column (2/3) ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Image gallery */}
            <ImageGallery images={images} title={listing.title} />

            {/* Title + badge row */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground border border-border rounded px-2 py-0.5">
                  {LISTING_TYPE_LABEL[listing.listing_type] ?? listing.listing_type}
                </span>
                {planCfg && (
                  <span className={`text-[10px] font-semibold rounded px-2 py-0.5 border ${planCfg.classes}`}>
                    {planCfg.label}
                  </span>
                )}
                {listing.featured && (
                  <span className="text-[10px] font-bold text-pa-green">★ Featured</span>
                )}
                {listing.status === "under_offer" && (
                  <span className="text-[10px] font-bold text-pa-amber border border-pa-amber/30 rounded px-2 py-0.5 bg-pa-amber/5">
                    Under Offer
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2">
                {listing.title}
              </h1>
              <p className="text-sm text-muted-foreground flex items-start gap-1">
                <span className="mt-0.5 flex-shrink-0">📍</span>
                {listing.address}
                {muni && (
                  <span className="ml-1">
                    · {COUNTRY_FLAG[muni.country] ?? ""} {muni.country}
                  </span>
                )}
              </p>
            </div>

            {/* Specs bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-border rounded-xl p-3 bg-card text-center">
                <p className="text-xl font-bold font-mono text-pa-green leading-none">
                  {formatPrice(listing.asking_price, listing.currency_code)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">asking price</p>
              </div>

              {listing.size_sqm && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-xl font-bold font-mono leading-none">
                    {Number(listing.size_sqm).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">sqm</p>
                </div>
              )}

              {listing.bedrooms && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-xl font-bold font-mono leading-none">{listing.bedrooms}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">bedrooms</p>
                </div>
              )}

              {listing.bathrooms && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-xl font-bold font-mono leading-none">{listing.bathrooms}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">bathrooms</p>
                </div>
              )}

              {listing.date_listed && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-sm font-semibold leading-none">
                    {new Date(listing.date_listed).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">listed</p>
                </div>
              )}

              {listing.tenure && (
                <div className="border border-border rounded-xl p-3 bg-card text-center">
                  <p className="text-sm font-semibold leading-none capitalize">{listing.tenure}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">tenure</p>
                </div>
              )}
            </div>

            {/* Full description */}
            {listing.description && (
              <div>
                <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-widest text-[10px]">
                  About this listing
                </h2>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>
              </div>
            )}

            {/* Key features */}
            {features.length > 0 && (
              <div>
                <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Key features
                </h2>
                <div className="flex flex-wrap gap-2">
                  {features.map((feat, i) => (
                    <span
                      key={i}
                      className="text-xs border border-border rounded-full px-3 py-1.5 bg-secondary/30 text-foreground"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Highlights checklist */}
            {highlights.length > 0 && (
              <div className="border border-pa-green/20 rounded-xl p-5 bg-pa-green/[0.03]">
                <h2 className="text-[10px] font-bold text-pa-green uppercase tracking-widest mb-4">
                  Investment highlights
                </h2>
                <ul className="space-y-2.5">
                  {highlights.map((hl, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-pa-green flex-shrink-0 mt-0.5">✓</span>
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Agent info (deemphasised — no external link to listing) */}
            {listing.agent_name && (
              <p className="text-xs text-muted-foreground">
                Listed by {listing.agent_name}
                {listing.date_listed && (
                  <> · {new Date(listing.date_listed).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</>
                )}
              </p>
            )}
          </div>

          {/* ── Right / Sidebar (1/3) ── */}
          <div className="space-y-6">

            {/* Market conviction panel */}
            {muni && (
              <div className="border border-pa-green/20 rounded-xl p-5 bg-card sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-pa-green uppercase tracking-widest">
                      Prime Atlas Market Conviction
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {COUNTRY_FLAG[muni.country] ?? ""} {muni.name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <p className={`text-2xl font-bold font-mono ${scoreColor(muni.opportunity_score)}`}>
                      {muni.opportunity_score}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">ROI index</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold font-mono ${scoreColor(muni.growth_score)}`}>
                      {muni.growth_score}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">growth</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold font-mono ${
                      muni.risk_score <= 40
                        ? "text-pa-green"
                        : muni.risk_score <= 55
                        ? "text-pa-amber"
                        : "text-red-400"
                    }`}>
                      {muni.risk_score}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">risk</p>
                  </div>
                </div>

                <Link
                  href={`/opportunities/${muni.slug}`}
                  className="block text-center text-xs text-pa-green hover:underline mt-1"
                >
                  Full market analysis →
                </Link>
              </div>
            )}

            {/* Inquire form */}
            <InquireForm
              listingTitle={listing.title}
              listingId={listing.id}
              contactEmail={listing.contact_email}
            />

            {/* Back to listings */}
            <Link
              href="/listings"
              className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              ← Back to all listings
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
