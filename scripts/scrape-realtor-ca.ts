#!/usr/bin/env tsx
/**
 * scripts/scrape-realtor-ca.ts
 *
 * Standalone Realtor.ca scraper — intended to run from GitHub Actions
 * (Azure IP space) to bypass the IP block that affects Vercel's Lambda
 * egress addresses.
 *
 * Required environment variables (set as GitHub repo secrets):
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Supabase service role key (server-side only)
 *
 * Run manually:
 *   npx tsx scripts/scrape-realtor-ca.ts
 */

import { createClient } from "@supabase/supabase-js";

/* ── Config ─────────────────────────────────────────────────────────────────── */

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? "";
const REQUEST_TIMEOUT  = 90_000;
const SUPABASE_BATCH   = 100;
const MIN_RECORDS      = 3;   // warn if fewer listings returned per city

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
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

interface BBox { latMax: number; latMin: number; lonMax: number; lonMin: number; }

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function safeInt(n: number, max = 99): number | null {
  return isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "apartment": "Apartment", "flat": "Apartment", "studio": "Apartment",
  "penthouse": "Apartment", "condo": "Condo", "condominium": "Condo",
  "house": "House", "detached": "House", "semi-detached": "House",
  "townhouse": "House", "villa": "House", "bungalow": "House",
  "multi family": "Multi-family", "multi-family": "Multi-family",
  "land": "Land", "lot": "Land", "commercial": "Commercial",
};

function normalisePropertyType(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return PROPERTY_TYPE_MAP[key] ?? raw.trim();
}

/* ── Bounding boxes (Greater Toronto + Metro Vancouver) ─────────────────────── */

const BBOXES: Record<string, BBox> = {
  toronto:   { latMax: 43.8556, latMin: 43.5799, lonMax: -79.1191, lonMin: -79.6395 },
  vancouver: { latMax: 49.3147, latMin: 49.0127, lonMax: -122.9987, lonMin: -123.2780 },
};

/* ── Realtor.ca API caller ──────────────────────────────────────────────────── */

async function scrapeCity(
  city:        string,
  bbox:        BBox,
  listingType: "sale" | "rent",
): Promise<Property[]> {
  const txType = listingType === "sale" ? "2" : "3";
  const body   = new URLSearchParams({
    ZoomLevel:            "11",
    LatitudeMax:          String(bbox.latMax),
    LatitudeMin:          String(bbox.latMin),
    LongitudeMax:         String(bbox.lonMax),
    LongitudeMin:         String(bbox.lonMin),
    CurrentPage:          "1",
    RecordsPerPage:       "50",
    MaximumResults:       "200",
    PropertySearchTypeId: "1",
    TransactionTypeId:    txType,
    ApplicationId:        "1",
    CultureId:            "1",
    Version:              "7.0",
  });

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(
      "https://api2.realtor.ca/Listing.svc/PropertySearch_Post",
      {
        method: "POST",
        headers: {
          "Content-Type":    "application/x-www-form-urlencoded; charset=UTF-8",
          "Accept":          "application/json, text/javascript, */*; q=0.01",
          "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Origin":          "https://www.realtor.ca",
          "Referer":         "https://www.realtor.ca/map",
          "X-Requested-With": "XMLHttpRequest",
        },
        body:   body.toString(),
        signal: ctrl.signal,
      },
    );

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data    = await res.json() as any;
    const items   = (data?.Results ?? []) as unknown[];
    const now     = new Date().toISOString();
    const results: Property[] = [];

    for (const item of items) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r          = item as any;
        const mlsNumber  = String(r.MlsNumber ?? "").trim();
        if (!mlsNumber) continue;

        const rawPrice   = Number(r.Price?.Value ?? 0);
        const price      = rawPrice > 0 ? Math.round(rawPrice * 100) : null;
        const address    = String(r.Property?.Address?.AddressText ?? "").trim() || null;

        const bedsStr    = String(r.Building?.Bedrooms ?? "");
        const bedrooms   = bedsStr ? safeInt(parseInt(bedsStr.replace(/\+.*$/, ""), 10)) : null;
        const bathrooms  = r.Building?.BathroomTotal != null
          ? safeInt(parseInt(String(r.Building.BathroomTotal), 10)) : null;

        const sizeRaw    = String(r.Building?.SizeInterior ?? "");
        const sizeMatch  = sizeRaw.match(/[\d,]+/);
        let   sqm: number | null = null;
        if (sizeMatch) {
          const sizeNum = parseInt(sizeMatch[0].replace(/,/g, ""), 10);
          if (isFinite(sizeNum) && sizeNum > 0) sqm = Math.round(sizeNum * 0.0929);
        }

        const typeRaw    = String(r.Building?.Type ?? r.Property?.Type ?? "").toLowerCase().trim() || null;
        const detailUrl  = r.RelativeDetailsURL ?? `/real-estate/${mlsNumber}/listing`;
        const listingUrl = detailUrl.startsWith("http")
          ? detailUrl : `https://www.realtor.ca${detailUrl}`;

        results.push({
          provider:             "realtor_ca",
          external_property_id: mlsNumber,
          title:                address,
          address,
          price,
          currency_code:        "CAD",
          country_iso2:         "CA",
          bedrooms,
          bathrooms,
          size_sqm:             sqm,
          property_type_raw:    typeRaw,
          property_type:        normalisePropertyType(typeRaw),
          listing_type:         listingType,
          listing_url:          listingUrl,
          scraped_at:           now,
        });
      } catch (e) {
        console.error(`[Realtor.ca/${city}] item parse error:`, e);
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
  startedAt: string;
  scraped:   number;
  upserted:  number;
  failed:    number;
  errors:    string[];
  durationMs: number;
}): Promise<void> {
  const exitStatus = opts.errors.length === 0 ? "success"
    : opts.upserted > 0 ? "partial" : "failure";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("scraper_runs").insert({
      provider:         "realtor_ca",
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
  const startedAt  = new Date().toISOString();
  const t0         = Date.now();
  const allProps:  Property[] = [];
  const errors:    string[]   = [];
  let   failedCount = 0;

  const targets: Array<{ city: string; bbox: BBox; listingType: "sale" | "rent" }> = [
    { city: "toronto",   bbox: BBOXES.toronto,   listingType: "sale" },
    { city: "vancouver", bbox: BBOXES.vancouver,  listingType: "sale" },
  ];

  for (const { city, bbox, listingType } of targets) {
    try {
      console.log(`[Realtor.ca] ↗ API → ${city} (${listingType})`);
      const results = await scrapeCity(city, bbox, listingType);
      console.log(`[Realtor.ca] ✓ ${results.length} listings from ${city}`);

      if (results.length < MIN_RECORDS) {
        const msg = `Low record count for ${city}: ${results.length} < ${MIN_RECORDS}`;
        console.warn(`[Realtor.ca] ⚠ ${msg}`);
        errors.push(msg);
      }

      allProps.push(...results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Realtor.ca] ✗ ${city} failed:`, msg);
      errors.push(`${city}: ${msg}`);
    }

    // brief inter-city pause
    await new Promise((r) => setTimeout(r, 2_000));
  }

  // deduplicate by MLS number
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
      console.log(`[Realtor.ca] ✓ upserted ${upserted}/${unique.length} rows`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Realtor.ca] ✗ upsert error:", msg);
      errors.push(`Supabase upsert: ${msg}`);
    }
  }

  await logRun({
    startedAt,
    scraped:    unique.length,
    upserted,
    failed:     failedCount,
    errors,
    durationMs: Date.now() - t0,
  });

  const exitCode = errors.length > 0 && upserted === 0 ? 1 : 0;
  console.log(
    `[Realtor.ca] done — ${upserted} upserted, ${errors.length} error(s), ` +
    `${Date.now() - t0}ms`,
  );
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("[Realtor.ca] fatal:", err);
  process.exit(1);
});
