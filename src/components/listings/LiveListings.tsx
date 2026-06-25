import Link from "next/link";
import { scoreColor } from "@/lib/utils";

/* ─────────────────────────── types ─────────────────────────── */

export interface Listing {
  id: string;
  title: string;
  address: string;
  listing_type: string;
  asking_price: number;   // stored in pence / cents
  currency_code: string;
  size_sqm: number | null;
  planning_status: string | null;
  description: string | null;
  agent_name: string | null;
  agent_url: string | null;
  source_url: string | null;
  date_listed: string | null;
  status: string;
  featured: boolean;
  // detail fields
  images?: string[] | null;
  features?: string[] | null;
  highlights?: string[] | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  tenure?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  // joined from municipalities
  municipality_id?: string;
  municipalities?: {
    name: string;
    slug: string;
    country: string;
    opportunity_score: number;
    growth_score: number;
    risk_score: number;
  } | null;
}

interface LiveListingsProps {
  listings: Listing[];
  /** pass these when the market is already known (city page context) */
  marketContext?: {
    name: string;
    slug: string;
    country: string;
    opportunity_score: number;
    growth_score: number;
    risk_score: number;
  };
  heading?: string;
  showMarketLink?: boolean;
}

/* ─────────────────────────── helpers ───────────────────────── */

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

const LISTING_TYPE_LABEL: Record<string, string> = {
  "land":             "Land",
  "residential":      "Residential",
  "commercial":       "Commercial",
  "mixed-use":        "Mixed-use",
  "development-site": "Development Site",
  "industrial":       "Industrial",
  "pbsa":             "PBSA",
};

const PLANNING_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  "with-permission":      { label: "Planning Granted",  classes: "text-pa-green border-pa-green/30 bg-pa-green/5" },
  "outline":              { label: "Outline Consent",   classes: "text-pa-amber border-pa-amber/30 bg-pa-amber/5" },
  "unconsented":          { label: "No Consent",        classes: "text-muted-foreground border-border bg-secondary/30" },
  "freehold":             { label: "Freehold",          classes: "text-blue-400 border-blue-400/30 bg-blue-400/5" },
  "permitted-development":{ label: "PD Rights",         classes: "text-purple-400 border-purple-400/30 bg-purple-400/5" },
};

const COUNTRY_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States":  "🇺🇸",
  "Australia":      "🇦🇺",
  "Canada":         "🇨🇦",
  "Spain":          "🇪🇸",
};

/* ─────────────────────────── card ──────────────────────────── */

function ListingCard({ listing, market }: {
  listing: Listing;
  market: { name: string; slug: string; country: string; opportunity_score: number; growth_score: number; risk_score: number };
}) {
  const planningCfg = listing.planning_status
    ? PLANNING_STATUS_CONFIG[listing.planning_status] ?? { label: listing.planning_status, classes: "text-muted-foreground border-border" }
    : null;

  const interestSubject = encodeURIComponent(`Interest in: ${listing.title}`);
  const interestBody    = encodeURIComponent(
    `Hi,\n\nI found this listing on Prime Atlas and would like more information:\n\n${listing.title}\n${listing.address}\n\nPlease share further details.\n\nThank you.`
  );

  return (
    <div className={`border rounded-xl overflow-hidden bg-card flex flex-col transition-colors hover:border-pa-green/40 ${listing.featured ? "border-pa-green/30" : "border-border"}`}>

      {/* Card header: type + planning status */}
      <div className="px-5 pt-4 pb-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground border border-border rounded px-2 py-0.5">
            {LISTING_TYPE_LABEL[listing.listing_type] ?? listing.listing_type}
          </span>
          {planningCfg && (
            <span className={`text-[10px] font-semibold rounded px-2 py-0.5 border ${planningCfg.classes}`}>
              {planningCfg.label}
            </span>
          )}
          {listing.featured && (
            <span className="text-[10px] font-bold text-pa-green">★ Featured</span>
          )}
        </div>
        {listing.status === "under_offer" && (
          <span className="text-[10px] font-bold text-pa-amber border border-pa-amber/30 rounded px-2 py-0.5 bg-pa-amber/5 flex-shrink-0">
            Under Offer
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="px-5 py-4 flex-1 flex flex-col">
        <h3 className="font-bold text-sm leading-snug mb-1.5 line-clamp-2">{listing.title}</h3>
        <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1">
          <span className="mt-0.5 flex-shrink-0">📍</span>
          {listing.address}
        </p>

        {/* Price + size */}
        <div className="flex items-end gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold font-mono text-pa-green leading-none">
              {formatPrice(listing.asking_price, listing.currency_code)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">asking price</p>
          </div>
          {listing.size_sqm && (
            <div className="text-right ml-auto">
              <p className="text-base font-semibold font-mono">{listing.size_sqm.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">sqm</p>
            </div>
          )}
        </div>

        {/* Description */}
        {listing.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4">{listing.description}</p>
        )}

        {/* ── Research overlay ── */}
        <div className="border border-pa-green/20 rounded-lg bg-pa-green/[0.03] p-3 mb-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-pa-green mb-2">
            Prime Atlas Market Context · {COUNTRY_FLAG[market.country] ?? ""} {market.name}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className={`text-lg font-bold font-mono ${scoreColor(market.opportunity_score)}`}>
                {market.opportunity_score}
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight">ROI index</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold font-mono ${scoreColor(market.growth_score)}`}>
                {market.growth_score}
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight">growth</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold font-mono ${market.risk_score <= 40 ? "text-pa-green" : market.risk_score <= 55 ? "text-pa-amber" : "text-red-400"}`}>
                {market.risk_score}
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight">risk</p>
            </div>
          </div>
          <Link
            href={`/opportunities/${market.slug}`}
            className="block text-center text-[9px] text-pa-green hover:underline mt-2"
          >
            Full market analysis →
          </Link>
        </div>

        {/* Agent */}
        {listing.agent_name && (
          <p className="text-[10px] text-muted-foreground mb-3">
            Listed by{" "}
            {listing.agent_url
              ? <a href={listing.agent_url} target="_blank" rel="noopener noreferrer" className="hover:text-pa-green transition-colors">{listing.agent_name}</a>
              : listing.agent_name}
            {listing.date_listed && ` · ${new Date(listing.date_listed).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
          </p>
        )}

        {/* CTAs */}
        <div className="flex gap-2 mt-auto">
          <Link
            href={`/listings/${listing.id}`}
            className="flex-1 text-center text-xs font-semibold bg-pa-green text-pa-navy py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors"
          >
            View listing →
          </Link>
          <a
            href={`mailto:deals@prime-atlas.com?subject=${interestSubject}&body=${interestBody}`}
            className="flex-1 text-center text-xs font-semibold border border-border text-foreground py-2.5 rounded-lg hover:border-pa-green/40 hover:text-pa-green transition-colors"
          >
            Express interest
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── section ───────────────────────── */

export function LiveListings({
  listings,
  marketContext,
  heading = "Live Listings",
  showMarketLink = false,
}: LiveListingsProps) {
  if (!listings || listings.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse" />
            <h2 className="font-semibold text-base">{heading}</h2>
            <span className="text-xs text-muted-foreground font-mono">({listings.length})</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-lg">
            Curated development sites and investment assets — each scored against the Prime Atlas conviction framework.
            {" "}
            <a href="mailto:deals@prime-atlas.com" className="text-pa-green hover:underline">
              Submit a listing
            </a>
            {" "}to feature your deal here.
          </p>
        </div>
        {showMarketLink && (
          <Link href="/listings" className="text-xs text-pa-green hover:underline whitespace-nowrap flex-shrink-0">
            All listings →
          </Link>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {listings.map((listing) => {
          // Resolve market context: from prop or from joined municipalities
          const market = marketContext ?? (listing.municipalities
            ? {
                name:              listing.municipalities.name,
                slug:              listing.municipalities.slug,
                country:           listing.municipalities.country,
                opportunity_score: listing.municipalities.opportunity_score,
                growth_score:      listing.municipalities.growth_score,
                risk_score:        listing.municipalities.risk_score,
              }
            : null);

          if (!market) return null;

          return (
            <ListingCard key={listing.id} listing={listing} market={market} />
          );
        })}
      </div>

      {/* Phase 2 teaser */}
      <div className="mt-5 border border-dashed border-border rounded-xl p-4 text-center">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Agent or developer?</strong>{" "}
          List your deal here and reach investors who already have market conviction.{" "}
          <a href="mailto:deals@prime-atlas.com?subject=List my deal on Prime Atlas" className="text-pa-green hover:underline">
            Get in touch →
          </a>
        </p>
      </div>
    </section>
  );
}
