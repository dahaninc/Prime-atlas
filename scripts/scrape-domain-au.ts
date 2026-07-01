#!/usr/bin/env tsx
/**
 * scripts/scrape-domain-au.ts
 *
 * Standalone Domain.com.au scraper — runs from GitHub Actions (Azure IP space).
 * Uses API Key authentication (X-API-Key header) — no OAuth2 token step needed.
 *
 * Required environment variables (set as GitHub repo secrets):
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Supabase service role key (server-side only)
 *   DOMAIN_AU_API_KEY           — from https://developer.domain.com.au/ (project credentials)
 *
 * Run manually:
 *   npx tsx scripts/scrape-domain-au.ts
 */

import { createClient } from "@supabase/supabase-js";

/* ── Config ─────────────────────────────────────────────────────────────────── */

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const API_KEY          = process.env.DOMAIN_AU_API_KEY         ?? "";
const REQUEST_TIMEOUT  = 90_000;
const SUPABASE_BATCH   = 100;
const MIN_RECORDS      = 3;

for (const [k, v] of [
  ["NEXT_PUBLIC_SUPABASE_URL",  SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
  ["DOMAIN_AU_API_KEY",         API_KEY],
] as const) {
  if (!v) { console.error(`❌  Missing ${k}`); process.exit(1); }
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface Property {
  provider:             string;
  external_property_id: string;
  title:                string | null;
  address:              string | null;
  price:                number | null;
  currency_code:        string;
  country_iso2:         string;
  bedrooms:             number | null;
  bathrooms:            number | null;
  size_sqm:             number | null;
  property_type_raw:    string | null;
  property_type:        string | null;
  listing_type:         "sale" | "rent";
  listing_url:          string | null;
  scraped_at:           string;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function safeInt(n: number, max = 99): number | null {
  return isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
}

function parsePrice(raw: string): number | null {
  const stripped = raw.replace(/[^\d.,]/g, "").trim();
  if (!stripped) return null;
  const n = parseFloat(stripped.replace(/,/g, ""));
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "apartment unit flat": "Apartment",
  "apartment":           "Apartment",
  "unit":                "Apartment",
  "flat":                "Apartment",
  "studio":              "Apartment",
  "penthouse":           "Apartment",
  "house":               "House",
  "townhouse":           "House",
  "villa":               "House",
  "terrace":             "House",
  "semi":                "House",
  "duplex":              "Apartment",
  "block of units":      "Multi-family",
  "land":                "Land",
  "acreage":             "Farm",
  "rural":               "Farm",
  "retirement":          "Other",
};

function normalisePropertyType(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return PROPERTY_TYPE_MAP[key] ?? raw.trim();
}

/* ── Search listings via API Key ────────────────────────────────────────────── */

interface SearchTarget {
  suburb:      string;
  state:       string;
  listingType: "sale" | "rent";
}

async function searchListings(target: SearchTarget): Promise<Property[]> {
  const listingType = target.listingType === "sale" ? "Sale" : "Rental";

  const searchBody = {
    listingType,
    locations: [{
      state:                     target.state,
      suburb:                    target.suburb,
      includeSurroundingSuburbs: true,
    }],
    pageSize:   100,
    pageNumber: 1,
  };

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(
      "https://api.domain.com.au/v1/listings/residential/_search",
      {
        method:  "POST",
        headers: {
          "X-API-Key":    API_KEY,
          "Content-Type": "application/json",
          Accept:         "application/json",
        },
        body:   JSON.stringify(searchBody),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Domain search HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await res.json() as any[];
    const now   = new Date().toISOString();
    const results: Property[] = [];

    for (const item of items) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const listing = (item as any)?.listing as any;
        if (!listing) continue;

        const id = String(listing.id ?? "").trim();
        if (!id) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pd      = (listing.propertyDetails ?? {}) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pricing = (listing.priceDetails    ?? {}) as any;
        const slug    = String(listing.listingSlug ?? "");
        const fullUrl = slug
          ? `https://www.domain.com.au/${slug}`
          : `https://www.domain.com.au/property-detail/${id}`;

        const rawPrice = typeof pricing.price === "number" && pricing.price > 0
          ? Math.round(pricing.price * 100)
          : parsePrice(String(pricing.displayPrice ?? ""));

        const floorArea = Number(pd.floorArea ?? NaN);
        const typeRaw   = String(pd.propertyType ?? "")
          .replace(/([A-Z])/g, " $1").trim().toLowerCase();

        results.push({
          provider:             "domain_au",
          external_property_id: id,
          title:                pd.displayableAddress ?? null,
          address:              pd.displayableAddress ?? null,
          price:                rawPrice,
          currency_code:        "AUD",
          country_iso2:         "AU",
          bedrooms:             safeInt(Number(pd.bedrooms  ?? NaN)),
          bathrooms:            safeInt(Number(pd.bathrooms ?? NaN)),
          size_sqm:             isFinite(floorArea) && floorArea > 0 ? floorArea : null,
          property_type_raw:    typeRaw || null,
          property_type:        normalisePropertyType(typeRaw),
          listing_type:         target.listingType,
          listing_url:          fullUrl,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[Domain.com.au] item parse error:", e);
      }
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Supabase upsert ────────────────────────────────────────────────────────── */

async function upsertProperties(rows: Property[]): Promise<number> {
  if (!rows.length) return 0;
  let total = 0;

  for (let i = 0; i < rows.length; i += SUPABASE_BATCH) {
    const batch = rows.slice(i, i + SUPABASE_BATCH).map((r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("properties")
      .upsert(batch, {
        onConflict:       "provider,external_property_id",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) throw new Error(`Supabase upsert error: ${error.message}`);
    total += data?.length ?? 0;
  }

  return total;
}

/* ── Audit log ──────────────────────────────────────────────────────────────── */

async function logRun(opts: {
  startedAt:  string;
  scraped:    number;
  upserted:   number;
  failed:     number;
  errors:     string[];
  durationMs: number;
}): Promise<void> {
  const exitStatus = opts.errors.length === 0 ? "success"
    : opts.upserted > 0 ? "partial" : "failure";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("scraper_runs").insert({
      provider:         "domain_au",
      started_at:       opts.startedAt,
      finished_at:      new Date().toISOString(),
      records_scraped:  opts.scraped,
      records_upserted: opts.upserted,
      records_failed:   opts.failed,
      errors:           opts.errors,
      exit_status:      exitStatus,
      duration_ms:      opts.durationMs,
    });
  } catch (e) {
    console.error("[scraper_runs] audit write failed:", e);
  }
}

/* ── Main ───────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const t0        = Date.now();
  const allProps: Property[] = [];
  const errors:   string[]   = [];

  const targets: SearchTarget[] = [
    { suburb: "Sydney",    state: "NSW", listingType: "sale" },
    { suburb: "Sydney",    state: "NSW", listingType: "rent" },
    { suburb: "Melbourne", state: "VIC", listingType: "sale" },
    { suburb: "Melbourne", state: "VIC", listingType: "rent" },
  ];

  for (const target of targets) {
    const label = `${target.suburb} (${target.listingType})`;
    try {
      console.log(`[Domain.com.au] ↗ API → ${label}`);
      const results = await searchListings(target);
      console.log(`[Domain.com.au] ✓ ${results.length} listings from ${label}`);

      if (results.length < MIN_RECORDS) {
        const msg = `Low record count for ${label}: ${results.length} < ${MIN_RECORDS}`;
        console.warn(`[Domain.com.au] ⚠ ${msg}`);
        errors.push(msg);
      }

      allProps.push(...results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Domain.com.au] ✗ ${label} failed:`, msg);
      errors.push(`${label}: ${msg}`);
    }

    await new Promise((r) => setTimeout(r, 1_500));
  }

  const seen   = new Set<string>();
  const unique = allProps.filter(({ external_property_id: id }) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  let upserted = 0;
  if (unique.length > 0) {
    try {
      upserted = await upsertProperties(unique);
      console.log(`[Domain.com.au] ✓ upserted ${upserted}/${unique.length} rows`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Domain.com.au] ✗ upsert error:", msg);
      errors.push(`Supabase upsert: ${msg}`);
    }
  }

  await logRun({
    startedAt,
    scraped:    unique.length,
    upserted,
    failed:     0,
    errors,
    durationMs: Date.now() - t0,
  });

  console.log(`[Domain.com.au] done — ${upserted} upserted, ${errors.length} error(s), ${Date.now() - t0}ms`);
  process.exit(errors.length > 0 && upserted === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[Domain.com.au] fatal:", err);
  process.exit(1);
});
