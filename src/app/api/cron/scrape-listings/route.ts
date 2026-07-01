/**
 * src/app/api/cron/scrape-listings/route.ts
 *
 * Enterprise real-estate listing scraper — five platforms, one route.
 *
 * All target URLs (except Realtor.ca, which uses a direct JSON API) are proxied
 * through the ScrapeOps Proxy API Gateway, which handles JS rendering (headless
 * Chromium), residential IP rotation, and Akamai / Cloudflare / Kasada anti-bot
 * bypasses entirely on its own infrastructure.
 *
 * ─── QUICK SETUP ─────────────────────────────────────────────────────────────
 *
 *  1. Install Cheerio:
 *       npm install cheerio
 *
 *  2. Add to .env.local (and Vercel project env):
 *       SCRAPEOPS_API_KEY=<your ScrapeOps key>
 *       CRON_SECRET=<random 32-char secret>
 *       SUPABASE_SERVICE_ROLE_KEY=<service role key>
 *       NEXT_PUBLIC_SUPABASE_URL=<already set>
 *       SLACK_WEBHOOK_URL=<optional — Incoming Webhook URL for alerts>
 *
 *  3. Run the Supabase migration (already applied via MCP):
 *       add_etl_columns_and_scraper_runs
 *
 *  4. Invoke per-provider:
 *       GET /api/cron/scrape-listings?provider=zillow
 *       Authorization: Bearer <CRON_SECRET>
 *
 *  5. Schedule with vercel.json:
 *       {
 *         "crons": [
 *           { "path": "/api/cron/scrape-listings?provider=zoopla",        "schedule": "0 2 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=zillow",        "schedule": "0 3 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=realtor_ca",    "schedule": "0 4 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=realestate_au", "schedule": "0 5 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=idealista",     "schedule": "0 6 * * *" }
 *         ]
 *       }
 *
 * ─── SUPABASE SCHEMA (current) ───────────────────────────────────────────────
 *
 *   -- Core listings table
 *   CREATE TABLE IF NOT EXISTS public.properties (
 *     id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     provider             TEXT        NOT NULL,
 *     external_property_id TEXT        NOT NULL,
 *     title                TEXT,
 *     address              TEXT,
 *     city                 TEXT,
 *     state_region         TEXT,
 *     postcode             TEXT,
 *     country_iso2         CHAR(2),
 *     price                BIGINT,
 *     currency_code        TEXT        NOT NULL DEFAULT 'GBP',
 *     bedrooms             INTEGER,
 *     bathrooms            INTEGER,
 *     size_sqm             NUMERIC,
 *     property_type_raw    TEXT,
 *     property_type        TEXT,
 *     listing_type         TEXT        NOT NULL DEFAULT 'sale',
 *     listing_url          TEXT,
 *     status               TEXT        NOT NULL DEFAULT 'active',
 *     scraped_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     CONSTRAINT uq_provider_external_id UNIQUE (provider, external_property_id)
 *   );
 *
 *   -- Scraper audit log
 *   CREATE TABLE IF NOT EXISTS public.scraper_runs (
 *     id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     provider         TEXT        NOT NULL,
 *     started_at       TIMESTAMPTZ NOT NULL,
 *     finished_at      TIMESTAMPTZ NOT NULL,
 *     records_scraped  INTEGER     NOT NULL DEFAULT 0,
 *     records_upserted INTEGER     NOT NULL DEFAULT 0,
 *     records_failed   INTEGER     NOT NULL DEFAULT 0,
 *     errors           JSONB       NOT NULL DEFAULT '[]',
 *     exit_status      TEXT        NOT NULL,
 *     duration_ms      INTEGER     NOT NULL DEFAULT 0,
 *     created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */

import { NextResponse } from "next/server";
import { load }         from "cheerio";
import { createClient } from "@supabase/supabase-js";

/* ─────────────────────────────────────────────────────────────────────────────
   RUNTIME CONFIG
───────────────────────────────────────────────────────────────────────────── */

export const maxDuration = 300;   // Vercel Pro / Enterprise only
export const dynamic     = "force-dynamic";

const SCRAPEOPS_BASE      = "https://proxy.scrapeops.io/v1/";
const REQUEST_TIMEOUT_MS  = 90_000;   // raised — Idealista / REA pages need more headroom
const RETRY_BASE_DELAY_MS = 2_000;
const INTER_URL_DELAY_MS  = 2_500;
const SUPABASE_BATCH_SIZE = 100;

/** Minimum listings expected per URL — fire Slack alert if below this. */
const MIN_RECORDS_PER_URL = 3;

/* ─────────────────────────────────────────────────────────────────────────────
   PROPERTY TYPE TAXONOMY MAP
   Maps raw scraped strings → RESO-aligned canonical labels.
   Key: lower-case, underscores replaced with spaces.
───────────────────────────────────────────────────────────────────────────── */

const PROPERTY_TYPE_MAP: Record<string, string> = {
  // ── Apartment / Flat ────────────────────────────────────────────────────────
  "apartment":                 "Apartment",
  "apartments":                "Apartment",
  "flat":                      "Apartment",
  "flats":                     "Apartment",
  "piso":                      "Apartment",
  "appartement":               "Apartment",
  "studio":                    "Apartment",
  "studio apartment":          "Apartment",
  "studio flat":               "Apartment",
  "penthouse":                 "Apartment",
  "atico":                     "Apartment",
  "ático":                     "Apartment",
  "duplex":                    "Apartment",
  "dúplex":                    "Apartment",
  "maisonette":                "Apartment",
  "ground floor flat":         "Apartment",
  "upper floor flat":          "Apartment",
  "lower floor flat":          "Apartment",
  // ── House ────────────────────────────────────────────────────────────────────
  "house":                     "House",
  "houses":                    "House",
  "single family home":        "House",
  "single family residence":   "House",
  "single family":             "House",
  "detached":                  "House",
  "detached house":            "House",
  "semi-detached":             "House",
  "semi detached":             "House",
  "semi-detached house":       "House",
  "terraced":                  "House",
  "terraced house":            "House",
  "end of terrace":            "House",
  "end-of-terrace":            "House",
  "link detached house":       "House",
  "mews house":                "House",
  "villa":                     "House",
  "villas":                    "House",
  "casa":                      "House",
  "chalet":                    "House",
  "bungalow":                  "House",
  "townhouse":                 "House",
  "town house":                "House",
  "cottage":                   "House",
  "farmhouse":                 "House",
  "country house":             "House",
  // ── Condo ────────────────────────────────────────────────────────────────────
  "condo":                     "Condo",
  "condominium":               "Condo",
  "condos":                    "Condo",
  "strata":                    "Condo",
  // ── Multi-family ─────────────────────────────────────────────────────────────
  "multi family":              "Multi-family",
  "multi-family":              "Multi-family",
  "multifamily":               "Multi-family",
  "apartment building":        "Multi-family",
  "block of flats":            "Multi-family",
  // ── Land ─────────────────────────────────────────────────────────────────────
  "land":                      "Land",
  "solar":                     "Land",
  "plot":                      "Land",
  "plots":                     "Land",
  "building plot":             "Land",
  "parcela":                   "Land",
  "terrain":                   "Land",
  "development land":          "Land",
  // ── Commercial ───────────────────────────────────────────────────────────────
  "commercial":                "Commercial",
  "office":                    "Commercial",
  "retail":                    "Commercial",
  "shop":                      "Commercial",
  "industrial":                "Commercial",
  "warehouse":                 "Commercial",
  "local":                     "Commercial",
  "negocio":                   "Commercial",
  "business":                  "Commercial",
  // ── Parking / Garage ─────────────────────────────────────────────────────────
  "garage":                    "Parking",
  "parking":                   "Parking",
  "garaje":                    "Parking",
  // ── Other ────────────────────────────────────────────────────────────────────
  "mobile home":               "Mobile Home",
  "manufactured":              "Mobile Home",
  "manufactured home":         "Mobile Home",
  "farm":                      "Farm",
  "rural":                     "Farm",
  "finca":                     "Farm",
  "acreage":                   "Farm",
  "room":                      "Room",
  "rooms":                     "Room",
};

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

type Provider    = "zoopla" | "zillow" | "realtor_ca" | "realestate_au" | "idealista" | "rightmove" | "onthemarket";
type ListingType = "sale" | "rent";

/**
 * Raw output from individual extractor functions.
 * Does not yet include country_iso2 / property_type_raw — those are injected
 * by scrapeProvider's post-processing step.
 */
interface ExtractedProperty {
  provider:              Provider;
  external_property_id:  string;
  title:                 string | null;
  address:               string | null;
  /** Minor currency units (pence / cents / eurocents) */
  price:                 number | null;
  currency_code:         string;
  bedrooms:              number | null;
  bathrooms:             number | null;
  size_sqm:              number | null;
  /** Raw string from the source — normalised to ParsedProperty.property_type in post-processing */
  property_type:         string | null;
  listing_type:          ListingType;
  listing_url:           string | null;
  scraped_at:            string;
}

/**
 * Fully enriched property ready to upsert into public.properties.
 */
interface ParsedProperty extends ExtractedProperty {
  country_iso2:      string;       // ISO 3166-1 alpha-2, from provider config
  property_type_raw: string | null; // original scraped value preserved for debug
  // property_type is overwritten with canonical label during enrichment
}

interface SearchTarget {
  url:         string;
  listingType: ListingType;
}

interface ProviderConfig {
  name:          Provider;
  currency:      string;
  proxyCountry:  string;
  europeanPrice: boolean;
  renderJs:      boolean;
  /**
   * CSS selector passed as wait_for_selector to ScrapeOps (render_js=true only).
   * ScrapeOps returns as soon as this element appears in the DOM.
   * NOTE: removed from all active configs — causes premature returns on some sites.
   * Kept in the interface for future per-provider experimentation.
   */
  waitFor?: string;
  baseUrl:       string;
  /** ISO 3166-1 alpha-2 country code for all listings from this provider */
  countryIso2:   string;
  searchTargets: SearchTarget[];
  extract:       (html: string, baseUrl: string, listingType: ListingType) => ExtractedProperty[];
  /**
   * Optional: if defined, replaces the ScrapeOps fetch → extract pipeline
   * with a direct call (e.g. a JSON API). Receives the SearchTarget and
   * returns enriched ParsedProperty[] directly (country_iso2 already set).
   */
  directScraper?: (target: SearchTarget) => Promise<ParsedProperty[]>;
}

interface ScrapeReport {
  provider:       Provider;
  scrapedCount:   number;
  upsertedCount:  number;
  failedCount:    number;
  errors:         string[];
  durationMs:     number;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED UTILITIES
───────────────────────────────────────────────────────────────────────────── */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Convert a localised price string to a minor-unit integer.
 * English  (en):  "£1,250,000" → 125_000_000 pence
 * European (es):  "250.000 €"  →  25_000_000 eurocents
 */
function parsePrice(raw: string, european = false): number | null {
  const stripped = raw.replace(/[^\d.,]/g, "").trim();
  if (!stripped) return null;

  const normalised = european
    ? stripped.replace(/\./g, "").replace(",", ".")
    : stripped.replace(/,/g, "");

  const n = parseFloat(normalised);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Return the last non-empty path segment of a URL. */
function idFromUrl(url: string): string {
  return (
    url.split("?")[0].replace(/\/$/, "").split("/").filter(Boolean).pop() ?? ""
  );
}

/** Clamp a parsed integer to a sensible range, returning null for out-of-range values. */
function safeInt(n: number, max = 99): number | null {
  return isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
}

/**
 * Normalise a raw property type string to a canonical RESO-aligned label.
 * Falls back to the original value (trimmed) if no map entry exists.
 */
function normalisePropertyType(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim().replace(/_/g, " ");
  return PROPERTY_TYPE_MAP[key] ?? raw.trim();
}

/**
 * Critical-field validation. Returns false (skip record) only when both
 * price AND address are null — a record with neither is un-displayable.
 */
function validateRecord(p: ExtractedProperty): boolean {
  return !(p.price === null && p.address === null);
}

/**
 * Fire a Slack Incoming Webhook alert. Silent no-op if SLACK_WEBHOOK_URL
 * is not configured — never throws.
 */
async function sendSlackAlert(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[Slack] alert dispatch failed:", (err as Error).message);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCRAPEOPS PROXY GATEWAY
───────────────────────────────────────────────────────────────────────────── */

async function fetchViaScrapeOps(
  targetUrl:    string,
  proxyCountry: string,
  renderJs     = true,
  retries      = 0,
  waitFor?:     string,
): Promise<string> {
  const apiKey = process.env.SCRAPEOPS_API_KEY;
  if (!apiKey) throw new Error("SCRAPEOPS_API_KEY is not configured");

  const params: Record<string, string> = {
    api_key:     apiKey,
    url:         targetUrl,
    render_js:   renderJs ? "true" : "false",
    residential: "true",
    country:     proxyCountry,
  };
  if (waitFor) params.wait_for_selector = waitFor;

  const qs = new URLSearchParams(params);

  const proxyUrl = `${SCRAPEOPS_BASE}?${qs.toString()}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(proxyUrl, {
        headers: { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
        signal:  controller.signal,
      });

      if (!res.ok) throw new Error(`ScrapeOps HTTP ${res.status} for ${targetUrl}`);

      const html = await res.text();
      if (html.length < 500) throw new Error("ScrapeOps returned unexpectedly short HTML");

      return html;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
      console.warn(
        `[ScrapeOps] attempt ${attempt + 1}/${retries + 1} failed — retrying in ${delay}ms`,
        (err as Error).message,
      );
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("fetchViaScrapeOps: all retries exhausted");
}

/* ─────────────────────────────────────────────────────────────────────────────
   PLATFORM EXTRACTORS
───────────────────────────────────────────────────────────────────────────── */

// ─── 1. ZOOPLA (UK) ──────────────────────────────────────────────────────────

function extractZoopla(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const $       = load(html);
  const results: ExtractedProperty[] = [];
  const now     = new Date().toISOString();

  $(
    '[data-testid="regular-listings"] li, [data-testid="listing-results-list"] li',
  ).each((_, el) => {
    try {
      const card = $(el);

      const linkEl = card.find('a[data-testid="listing-details-link"]').first();
      const href   = linkEl.attr("href") ?? "";
      if (!href) return;

      const fullUrl = href.startsWith("http") ? href : `https://www.zoopla.co.uk${href}`;
      const extId   = idFromUrl(href);
      if (!extId) return;

      const priceText = card.find('[data-testid="listing-price"]').first().text().trim();
      const address   = (
        card.find('[data-testid="listing-description"] address').first().text() ||
        card.find('[data-testid="listing-title"]').first().text()
      ).replace(/\s+/g, " ").trim();
      const title = card.find("h2, h3").first().text().replace(/\s+/g, " ").trim() || address;

      const bedsRaw  = card.find('[data-testid="beds-label"]').first().text().trim();
      const bathsRaw = card.find('[data-testid="baths-label"]').first().text().trim();
      const typeRaw  = card.find('[data-testid="listing-property-type"]').first().text().trim().toLowerCase();

      results.push({
        provider:             "zoopla",
        external_property_id: extId,
        title:                title   || null,
        address:              address || null,
        price:                parsePrice(priceText),
        currency_code:        "GBP",
        bedrooms:             safeInt(parseInt(bedsRaw, 10)),
        bathrooms:            safeInt(parseInt(bathsRaw, 10)),
        size_sqm:             null,
        property_type:        typeRaw || null,
        listing_type:         listingType,
        listing_url:          fullUrl,
        scraped_at:           now,
      });
    } catch (e) {
      console.error("[Zoopla] card parse error:", e);
    }
  });

  // ── Link-based fallback ────────────────────────────────────────────────────
  // Zoopla individual listing URLs contain /details/{numeric-id}/.
  // If the primary selectors above found nothing (bot-detection page, A/B variant,
  // or changed testids), harvest links as a minimum-viable fallback.
  if (results.length === 0) {
    const seen = new Set<string>();

    $('a[href*="/details/"]').each((_, el) => {
      try {
        const href    = $(el).attr("href") ?? "";
        const idMatch = href.match(/\/details\/(\d{6,})/);
        const id      = idMatch?.[1];
        if (!id || seen.has(id)) return;
        seen.add(id);

        const fullUrl   = href.startsWith("http") ? href : `https://www.zoopla.co.uk${href}`;
        const container = $(el).closest("li, article, [class*='listing'], [class*='card']");
        const priceText = (
          container.find('[data-testid*="price"], [class*="price"], [class*="Price"]').first().text() ||
          container.text().match(/£[\d,]+/)?.[0] || ""
        ).trim();
        const address   = (
          $(el).attr("aria-label") ||
          container.find('address, [class*="address"], [class*="Address"]').first().text()
        ).replace(/\s+/g, " ").trim();

        results.push({
          provider:             "zoopla",
          external_property_id: id,
          title:                address || null,
          address:              address || null,
          price:                parsePrice(priceText),
          currency_code:        "GBP",
          bedrooms:             null,
          bathrooms:            null,
          size_sqm:             null,
          property_type:        null,
          listing_type:         listingType,
          listing_url:          fullUrl,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[Zoopla] link fallback parse error:", e);
      }
    });
  }

  return results;
}

// ─── 2. ZILLOW (US) ──────────────────────────────────────────────────────────

function extractZillow(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const results: ExtractedProperty[] = [];
  const now = new Date().toISOString();

  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
      console.warn("[Zillow] __NEXT_DATA__ not found in HTML");
      return results;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data       = JSON.parse(match[1]) as any;
    const sr         = data?.props?.pageProps?.searchPageState?.cat1?.searchResults;
    const listResults: unknown[] = sr?.listResults ?? sr?.mapResults ?? [];

    for (const item of listResults) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = item as any;

        const zpid = r.zpid ? String(r.zpid) : null;
        if (!zpid) continue;

        const detailPath = r.detailUrl ?? `/homedetails/${zpid}_zpid/`;
        const fullUrl    = detailPath.startsWith("http")
          ? detailPath
          : `https://www.zillow.com${detailPath}`;

        const rawPrice = r.unformattedPrice ?? r.price ?? null;
        const price    = typeof rawPrice === "number"
          ? Math.round(rawPrice * 100)
          : parsePrice(String(rawPrice ?? ""));

        const addr = r.address
          ? typeof r.address === "string"
            ? r.address
            : [r.address.streetAddress, r.address.city, r.address.state].filter(Boolean).join(", ")
          : null;

        const sqft     = r.area ? parseInt(String(r.area).replace(/,/g, ""), 10) : null;
        const homeType = (r.hdpData?.homeInfo?.homeType ?? r.homeType ?? "").toLowerCase().replace(/_/g, " ");

        results.push({
          provider:             "zillow",
          external_property_id: zpid,
          title:                addr || null,
          address:              addr || null,
          price,
          currency_code:        "USD",
          bedrooms:             safeInt(r.beds ?? r.bedrooms ?? NaN),
          bathrooms:            safeInt(r.baths ?? r.bathrooms ?? NaN),
          size_sqm:             sqft != null && isFinite(sqft) ? Math.round(sqft * 0.0929) : null,
          property_type:        homeType || null,
          listing_type:         listingType,
          listing_url:          fullUrl,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[Zillow] item parse error:", e);
      }
    }
  } catch (e) {
    console.error("[Zillow] __NEXT_DATA__ parse error:", e);
  }

  return results;
}

// ─── 3. REALESTATE.COM.AU (Australia) ────────────────────────────────────────
//
// renderJs is now false — REA Group pages are server-side rendered (Kotlin/React
// SSR). Removing headless Chromium cuts ~30s timeout risk per URL.

function extractRealestateAu(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const $       = load(html);
  const results: ExtractedProperty[] = [];
  const now     = new Date().toISOString();

  $('[data-testid*="listing-card-wrapper"], article[class*="residential-card"]').each((_, el) => {
    try {
      const card   = $(el);
      const linkEl = card.find('a[data-testid*="listing-card-tag-link"], a[href*="/property-"]').first();
      const href   = linkEl.attr("href") ?? "";
      if (!href) return;

      const fullUrl = href.startsWith("http") ? href : `https://www.realestate.com.au${href}`;
      const idMatch = href.match(/-(\d{7,})(?:\/|$)/);
      const extId   = idMatch?.[1] || idFromUrl(href);
      if (!extId) return;

      const priceText = (
        card.find('[data-testid="listing-card-price"]').first().text() ||
        card.find('[class*="price"]').first().text()
      ).trim();

      const address = (
        card.find('[data-testid="residential-card__address-heading"]').first().text() ||
        card.find('h2[class*="address"]').first().text()
      ).replace(/\s+/g, " ").trim();

      const title = card.find("h2, h3").first().text().replace(/\s+/g, " ").trim() || address;

      let beds: number | null  = null;
      let baths: number | null = null;
      let sqm: number | null   = null;

      card.find('[data-testid*="features"] span, [class*="propertyFeature"] span').each((_, span) => {
        const value = $(span).text().trim();
        const label = $(span).next("span").text().toLowerCase().trim();
        const n     = parseInt(value, 10);

        if (label.startsWith("bed") || label === "br")            beds  = safeInt(n);
        else if (label.startsWith("bath"))                        baths = safeInt(n);
        else if (label.includes("m²") || label.includes("sqm"))  sqm   = isFinite(n) ? n : null;
      });

      const typeRaw = card
        .find('[data-testid*="property-type"], [class*="propertyType"]')
        .first().text().trim().toLowerCase();

      results.push({
        provider:             "realestate_au",
        external_property_id: extId,
        title:                title   || null,
        address:              address || null,
        price:                parsePrice(priceText),
        currency_code:        "AUD",
        bedrooms:             beds,
        bathrooms:            baths,
        size_sqm:             sqm,
        property_type:        typeRaw || null,
        listing_type:         listingType,
        listing_url:          fullUrl,
        scraped_at:           now,
      });
    } catch (e) {
      console.error("[RealEstate.com.au] card parse error:", e);
    }
  });

  return results;
}

// ─── 4. IDEALISTA (Spain / Italy / Portugal) ─────────────────────────────────

function extractIdealista(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const $       = load(html);
  const results: ExtractedProperty[] = [];
  const now     = new Date().toISOString();

  $("article.item").each((_, el) => {
    try {
      const card   = $(el);
      const extId  = card.attr("data-element-id") ?? "";

      const linkEl  = card.find("a.item-link").first();
      const href    = linkEl.attr("href") ?? "";
      const fullUrl = href.startsWith("http") ? href : `https://www.idealista.com${href}`;

      const resolvedId = extId || idFromUrl(href);
      if (!resolvedId) return;

      const priceText = card.find(".item-price").first().text().trim();
      const address   = (
        linkEl.text() ||
        card.find(".item-address").first().text()
      ).replace(/\s+/g, " ").trim();

      let beds: number | null  = null;
      let baths: number | null = null;
      let sqm: number | null   = null;

      card.find(".item-detail-char li, .item-detail").each((_, li) => {
        const text = $(li).text().toLowerCase().trim();
        const n    = parseInt(text, 10);

        if ((text.includes("hab") || text.includes("dorm")) && isFinite(n))      beds  = safeInt(n);
        else if ((text.includes("baño") || text.includes("aseo")) && isFinite(n)) baths = safeInt(n);
        else if ((text.includes("m²") || text.includes("m2")) && isFinite(n))    sqm   = n;
      });

      const typeRaw = card.find(".item-detail-char li").first().text().trim().toLowerCase() || null;

      results.push({
        provider:             "idealista",
        external_property_id: String(resolvedId),
        title:                address || null,
        address:              address || null,
        price:                parsePrice(priceText, true),
        currency_code:        "EUR",
        bedrooms:             beds,
        bathrooms:            baths,
        size_sqm:             sqm,
        property_type:        typeRaw,
        listing_type:         listingType,
        listing_url:          fullUrl || null,
        scraped_at:           now,
      });
    } catch (e) {
      console.error("[Idealista] card parse error:", e);
    }
  });

  return results;
}

// ─── 5. RIGHTMOVE (UK) ───────────────────────────────────────────────────────
//
// Rightmove is a Next.js app that embeds all listing data inside
// <script id="__NEXT_DATA__">. The canonical path is:
//   props.pageProps.properties[]
// Each entry carries: id, price.amount (major units), displayAddress,
// bedrooms, bathrooms, propertySubType, propertyUrl.
//
// URL uses Rightmove region codes: REGION%5E87490 = London.

function extractRightmove(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const results: ExtractedProperty[] = [];
  const now = new Date().toISOString();

  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
      console.warn("[Rightmove] __NEXT_DATA__ not found in HTML");
      return results;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = JSON.parse(match[1]) as any;

    // Try all known __NEXT_DATA__ path variants (Rightmove has changed this several times)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pp = data?.props?.pageProps;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any[] =
      pp?.properties ??
      pp?.searchProductResponse?.properties ??
      pp?.searchResult?.properties ??
      pp?.result?.properties ??
      pp?.l1Props?.searchProductResponse?.properties ??
      pp?.initialProps?.searchResult?.properties ??
      pp?.searchResults?.properties ??
      pp?.results ??
      [];

    if (properties.length > 0) {
      for (const r of properties) {
        try {
          const id = r.id ? String(r.id) : null;
          if (!id) continue;

          // propertyUrl includes an anchor fragment — strip it for a clean URL
          const rawPath = (r.propertyUrl ?? `/properties/${id}`).split("#")[0];
          const fullUrl = rawPath.startsWith("http")
            ? rawPath
            : `https://www.rightmove.co.uk${rawPath}`;

          // price.amount is already in major units (£450000) — convert to pence
          const rawPrice = r.price?.amount ?? r.price?.value ?? null;
          const price    = typeof rawPrice === "number" && rawPrice > 0
            ? Math.round(rawPrice * 100)
            : null;

          const address  = r.displayAddress ?? null;
          const typeRaw  = (r.propertySubType ?? r.propertyType ?? "").toLowerCase().trim();

          results.push({
            provider:             "rightmove",
            external_property_id: id,
            title:                address,
            address,
            price,
            currency_code:        "GBP",
            bedrooms:             safeInt(r.bedrooms ?? NaN),
            bathrooms:            safeInt(r.bathrooms ?? NaN),
            size_sqm:             null,
            property_type:        typeRaw || null,
            listing_type:         listingType,
            listing_url:          fullUrl,
            scraped_at:           now,
          });
        } catch (e) {
          console.error("[Rightmove] item parse error:", e);
        }
      }
    }
  } catch (e) {
    console.error("[Rightmove] __NEXT_DATA__ parse error:", e);
  }

  // ── HTML Cheerio fallback (when __NEXT_DATA__ path has changed) ────────────
  if (results.length === 0) {
    const $    = load(html);
    const seen = new Set<string>();

    // Rightmove property IDs appear in links: /properties/12345678#/
    $('a[href*="/properties/"]').each((_, el) => {
      try {
        const href    = $(el).attr("href") ?? "";
        const idMatch = href.match(/\/properties\/(\d{6,})/);
        const id      = idMatch?.[1];
        if (!id || seen.has(id)) return;
        seen.add(id);

        const cleanPath = href.split("#")[0];
        const fullUrl   = cleanPath.startsWith("http")
          ? cleanPath
          : `https://www.rightmove.co.uk${cleanPath}`;

        // Walk up to enclosing card element
        const card      = $(el).closest("article, [class*='propertyCard'], [class*='property-card'], li");
        const priceText = (
          card.find('[class*="price"], [class*="Price"]').first().text() ||
          card.text().match(/£[\d,]+/)?.[0] || ""
        ).trim();
        const address   = (
          card.find('address, [class*="address"], [class*="Address"]').first().text() ||
          $(el).attr("aria-label") || ""
        ).replace(/\s+/g, " ").trim();
        const typeRaw   = card.find('[class*="type"], [class*="Type"]').first().text().trim().toLowerCase();

        results.push({
          provider:             "rightmove",
          external_property_id: id,
          title:                address || null,
          address:              address || null,
          price:                parsePrice(priceText),
          currency_code:        "GBP",
          bedrooms:             null,
          bathrooms:            null,
          size_sqm:             null,
          property_type:        typeRaw || null,
          listing_type:         listingType,
          listing_url:          fullUrl,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[Rightmove] HTML fallback parse error:", e);
      }
    });
  }

  return results;
}

// ─── 6. ONTHEMARKET (UK) ─────────────────────────────────────────────────────
//
// OnTheMarket is a Next.js app. Strategy: try __NEXT_DATA__ first (faster,
// structured), fall back to Cheerio HTML parsing if the JSON path changes.

function extractOnTheMarket(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const results: ExtractedProperty[] = [];
  const now = new Date().toISOString();

  // ── Attempt 1: __NEXT_DATA__ JSON ─────────────────────────────────────────
  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (match?.[1]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = JSON.parse(match[1]) as any;
      const pp   = data?.props?.pageProps;

      // OTM has changed path several times — try all known variants
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listings: any[] =
        pp?.searchResults?.results ??
        pp?.searchResults?.listings ??
        pp?.searchResults?.properties ??
        pp?.results ??
        pp?.listings ??
        pp?.properties ??
        pp?.search?.results ??
        pp?.data?.listings ??
        pp?.initialState?.listings?.results ??
        [];

      if (listings.length > 0) {
        for (const r of listings) {
          try {
            const id = String(r.id ?? r.listingId ?? "").trim();
            if (!id) continue;

            const rawHref = r.detailUrl ?? r.propertyUrl ?? r.url ?? `/property/${id}`;
            const fullUrl = rawHref.startsWith("http")
              ? rawHref
              : `https://www.onthemarket.com${rawHref}`;

            const rawPrice = r.price?.value ?? r.pricing?.value ?? r.price ?? null;
            const price    = typeof rawPrice === "number" && rawPrice > 0
              ? Math.round(rawPrice * 100)
              : typeof rawPrice === "string"
                ? parsePrice(rawPrice)
                : null;

            const address = r.displayAddress ?? r.address?.displayAddress ?? r.address ?? null;
            const typeRaw = (r.propertyType ?? r.type ?? "").toLowerCase().trim();
            const sqm     = r.floorArea?.value != null ? Number(r.floorArea.value) : null;

            results.push({
              provider:             "onthemarket",
              external_property_id: id,
              title:                address,
              address,
              price,
              currency_code:        "GBP",
              bedrooms:             safeInt(r.bedrooms ?? NaN),
              bathrooms:            safeInt(r.bathrooms ?? NaN),
              size_sqm:             sqm && isFinite(sqm) ? sqm : null,
              property_type:        typeRaw || null,
              listing_type:         listingType,
              listing_url:          fullUrl,
              scraped_at:           now,
            });
          } catch (e) {
            console.error("[OnTheMarket] JSON item parse error:", e);
          }
        }
        return results;
      }
    }
  } catch {
    // Fall through to HTML parsing
  }

  // ── Attempt 2: HTML Cheerio fallback ──────────────────────────────────────
  const $ = load(html);

  // Broad selector set — OTM has used many class name patterns across versions
  $(
    '[class*="property-card"], [class*="PropertyCard"], [class*="otm-PropertyCard"],' +
    '[data-testid*="property-result"], [data-testid*="PropertyCard"], [data-testid*="olt-PropertyCard"],' +
    'li[class*="result-"], li[class*="otm-item"], article[class*="property"]',
  ).each((_, el) => {
    try {
      const card   = $(el);
      const linkEl = card.find('a[href*="/property/"]').first();
      const href   = linkEl.attr("href") ?? "";
      if (!href) return;

      const fullUrl = href.startsWith("http") ? href : `https://www.onthemarket.com${href}`;
      const extId   = idFromUrl(href);
      if (!extId) return;

      const priceText = card.find('[class*="price"], [class*="Price"]').first().text().trim();
      const address   = (
        card.find('[data-testid*="address"], [data-testid*="Address"]').first().text() ||
        card.find('[class*="address"], [class*="Address"], [class*="title"]').first().text()
      ).replace(/\s+/g, " ").trim();
      const typeRaw   = card.find('[class*="type"], [class*="property-type"]')
        .first().text().trim().toLowerCase();

      const bedsRaw  = card.find('[class*="bed"], [class*="Bed"]').first().text().trim();
      const bathsRaw = card.find('[class*="bath"], [class*="Bath"]').first().text().trim();

      results.push({
        provider:             "onthemarket",
        external_property_id: extId,
        title:                address || null,
        address:              address || null,
        price:                parsePrice(priceText),
        currency_code:        "GBP",
        bedrooms:             safeInt(parseInt(bedsRaw, 10)),
        bathrooms:            safeInt(parseInt(bathsRaw, 10)),
        size_sqm:             null,
        property_type:        typeRaw || null,
        listing_type:         listingType,
        listing_url:          fullUrl,
        scraped_at:           now,
      });
    } catch (e) {
      console.error("[OnTheMarket] HTML card parse error:", e);
    }
  });

  // If card-level selectors found nothing, fall back to link harvesting
  if (results.length === 0) {
    const seen = new Set<string>();
    $('a[href*="/property/"]').each((_, el) => {
      try {
        const href  = $(el).attr("href") ?? "";
        const extId = idFromUrl(href);
        if (!extId || seen.has(extId) || extId.length < 4) return;
        seen.add(extId);

        const fullUrl   = href.startsWith("http") ? href : `https://www.onthemarket.com${href}`;
        const container = $(el).closest("li, article, section, div[class]");
        const priceText = container.find('[class*="price"], [class*="Price"]').first().text().trim();
        const address   = $(el).text().replace(/\s+/g, " ").trim() || null;

        results.push({
          provider:             "onthemarket",
          external_property_id: extId,
          title:                address,
          address,
          price:                parsePrice(priceText),
          currency_code:        "GBP",
          bedrooms:             null,
          bathrooms:            null,
          size_sqm:             null,
          property_type:        null,
          listing_type:         listingType,
          listing_url:          fullUrl,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[OnTheMarket] link fallback parse error:", e);
      }
    });
  }

  return results;
}

// ─── 7. REALTOR.CA — HTML fallback (used when direct API is blocked) ─────────
//
// Renders the Next.js SPA via ScrapeOps premium proxy and extracts listings.
// Strategy 1: find serialised Results[] in an inline <script> tag.
// Strategy 2: link-based extraction from rendered card HTML.

function extractRealtorCaHtml(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const results: ExtractedProperty[] = [];
  const $   = load(html);
  const now = new Date().toISOString();

  // ── Strategy 0: __NEXT_DATA__ JSON ────────────────────────────────────────
  try {
    const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (ndMatch?.[1]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ndData  = JSON.parse(ndMatch[1]) as any;
      const pp      = ndData?.props?.pageProps;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ndItems: any[] =
        pp?.results ?? pp?.listings ?? pp?.searchResults ??
        pp?.data?.results ?? pp?.data?.listings ?? [];

      for (const r of ndItems) {
        try {
          const mlsNumber = String(r.MlsNumber ?? r.mlsNumber ?? r.id ?? "").trim();
          if (!mlsNumber) continue;
          const rawPrice  = Number(r.Price?.Value ?? r.price?.value ?? r.price ?? 0);
          const price     = rawPrice > 0 ? Math.round(rawPrice * 100) : null;
          const address   = String(r.Property?.Address?.AddressText ?? r.address ?? "").trim() || null;
          const detailUrl = r.RelativeDetailsURL ?? `/real-estate/${mlsNumber}/listing`;
          const fullUrl   = detailUrl.startsWith("http") ? detailUrl : `https://www.realtor.ca${detailUrl}`;
          results.push({
            provider: "realtor_ca", external_property_id: mlsNumber,
            title: address, address, price, currency_code: "CAD",
            bedrooms: null, bathrooms: null, size_sqm: null,
            property_type: String(r.Building?.Type ?? r.Property?.Type ?? "").toLowerCase() || null,
            listing_type: listingType, listing_url: fullUrl, scraped_at: now,
          });
        } catch { /* skip */ }
      }
    }
  } catch { /* fall through */ }

  if (results.length > 0) return results;

  // ── Strategy 1: embedded JSON in <script> tags ─────────────────────────────
  $("script:not([src])").each((_, script) => {
    if (results.length > 0) return; // already found via previous script
    const src = $(script).html() ?? "";

    // Match serialised Results array (e.g. "Results":[...], "Paging":...)
    const resultPattern = /"Results"\s*:\s*(\[[\s\S]*?\])\s*,?\s*"(?:Paging|Total)/;
    const m = src.match(resultPattern);
    if (!m) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = JSON.parse(m[1]);
      for (const r of items) {
        try {
          const mlsNumber = String(r.MlsNumber ?? r.mlsNumber ?? "").trim();
          if (!mlsNumber) continue;

          const rawPrice = Number(r.Price?.Value ?? r.price?.value ?? 0);
          const price    = rawPrice > 0 ? Math.round(rawPrice * 100) : null;
          const address  = String(r.Property?.Address?.AddressText ?? r.address ?? "").trim() || null;
          const detailUrl = r.RelativeDetailsURL ?? `/real-estate/${mlsNumber}/listing`;
          const fullUrl   = detailUrl.startsWith("http") ? detailUrl : `https://www.realtor.ca${detailUrl}`;
          const typeRaw   = String(r.Building?.Type ?? r.Property?.Type ?? "").toLowerCase().trim() || null;

          const bedsStr  = String(r.Building?.Bedrooms ?? "");
          const beds     = bedsStr ? safeInt(parseInt(bedsStr.replace(/\+.*$/, ""), 10)) : null;
          const baths    = r.Building?.BathroomTotal != null
            ? safeInt(parseInt(String(r.Building.BathroomTotal), 10))
            : null;

          results.push({
            provider: "realtor_ca", external_property_id: mlsNumber,
            title: address, address, price, currency_code: "CAD",
            bedrooms: beds, bathrooms: baths,
            size_sqm: null, property_type: typeRaw,
            listing_type: listingType, listing_url: fullUrl, scraped_at: now,
          });
        } catch { /* skip individual item */ }
      }
    } catch { /* JSON parse failed */ }
  });

  if (results.length > 0) return results;

  // ── Strategy 2: link-based extraction from rendered SPA HTML ──────────────
  // Realtor.ca listing URLs can be:
  //   /real-estate/on/toronto/address-slug/18879797/
  //   /en/real-estate/on/toronto/address-slug/18879797/
  //   /real-estate/18879797/address-slug/
  const seen = new Set<string>();

  $('a[href*="/real-estate/"]').each((_, el) => {
    try {
      const href = $(el).attr("href") ?? "";
      // Match standard listing URLs (province/city/slug) OR numeric-ID-first format,
      // with optional /en/ language prefix
      if (!href.match(/(?:\/en)?\/real-estate\/(?:[a-z]{2}\/[^/]+\/[^/]+|\d{6,})/i)) return;

      const fullUrl  = href.startsWith("http") ? href : `https://www.realtor.ca${href}`;
      // Prefer the trailing numeric MLS ID segment when present
      const idMatch  = href.match(/\/(\d{6,})\/?(?:[?#]|$)/);
      const segments = href.split("/").filter(Boolean);
      const extId    = idMatch?.[1] || segments.at(-1) || segments.at(-2) || "";
      if (!extId || seen.has(extId)) return;
      seen.add(extId);

      // Walk up DOM to find card container with price/address data
      const card       = $(el).closest('[class*="Card"], [class*="card"], [class*="listing"], li, article');
      const cardText   = card.text();
      const priceMatch = cardText.match(/\$[\d,]+/);
      const priceText  = priceMatch?.[0] ?? "";
      const address    = $(el).text().replace(/\s+/g, " ").trim() || null;

      results.push({
        provider: "realtor_ca", external_property_id: extId,
        title: address, address, price: parsePrice(priceText),
        currency_code: "CAD", bedrooms: null, bathrooms: null,
        size_sqm: null, property_type: null, listing_type: listingType,
        listing_url: fullUrl, scraped_at: now,
      });
    } catch { /* skip */ }
  });

  return results;
}

/* ─────────────────────────────────────────────────────────────────────────────
   REALTOR.CA — DIRECT JSON API  (falls back to ScrapeOps HTML on 403)
   Primary: POST to api2.realtor.ca/Listing.svc/PropertySearch_Post.
   Fallback: ScrapeOps premium proxy (renderJs=true) + extractRealtorCaHtml().
   Bounding boxes cover Greater Toronto and Metro Vancouver respectively.
───────────────────────────────────────────────────────────────────────────── */

interface RealtorCaBbox {
  latMax: number; latMin: number; lonMax: number; lonMin: number;
}

const REALTOR_CA_BBOXES: Record<string, RealtorCaBbox> = {
  toronto:   { latMax: 43.8556, latMin: 43.5799, lonMax: -79.1191, lonMin: -79.6395 },
  vancouver: { latMax: 49.3147, latMin: 49.0127, lonMax: -122.9987, lonMin: -123.2780 },
};

async function scrapeRealtorCaViaApi(target: SearchTarget): Promise<ParsedProperty[]> {
  // Determine bounding box from target URL
  const cityKey   = target.url.includes("vancouver") ? "vancouver" : "toronto";
  const bbox      = REALTOR_CA_BBOXES[cityKey];
  const txType    = target.listingType === "sale" ? "2" : "3";
  const now       = new Date().toISOString();

  const body = new URLSearchParams({
    ZoomLevel:              "11",
    LatitudeMax:            String(bbox.latMax),
    LatitudeMin:            String(bbox.latMin),
    LongitudeMax:           String(bbox.lonMax),
    LongitudeMin:           String(bbox.lonMin),
    CurrentPage:            "1",
    RecordsPerPage:         "50",
    MaximumResults:         "200",
    PropertySearchTypeId:   "1",
    TransactionTypeId:      txType,
    ApplicationId:          "1",
    CultureId:              "1",
    Version:                "7.0",
  });

  // ── Step 0: prefetch main page to get session cookies ─────────────────────
  // api2.realtor.ca may require a valid Realtor.ca session cookie to allow
  // API POST requests. We fetch the homepage first (accessible from Vercel)
  // and forward the resulting Set-Cookie values with the API call.
  let sessionCookies = "";
  try {
    const cookieCtrl  = new AbortController();
    const cookieTimer = setTimeout(() => cookieCtrl.abort(), 10_000);
    try {
      const cookieRes = await fetch("https://www.realtor.ca/", {
        headers: {
          "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-CA,en;q=0.9",
        },
        signal: cookieCtrl.signal,
      });
      const setCookie = cookieRes.headers.get("set-cookie");
      if (setCookie) {
        sessionCookies = setCookie
          .split(/,(?=\s*\w+=)/)          // split on cookie boundaries
          .map((c) => c.split(";")[0].trim())
          .filter(Boolean)
          .join("; ");
        console.log(`[Realtor.ca] prefetched ${sessionCookies.split(";").length} cookie(s)`);
      }
    } finally {
      clearTimeout(cookieTimer);
    }
  } catch (e) {
    console.warn("[Realtor.ca] cookie prefetch failed:", (e as Error).message);
  }

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const apiHeaders: Record<string, string> = {
    "Content-Type":    "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept":          "application/json, text/javascript, */*; q=0.01",
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Origin":          "https://www.realtor.ca",
    "Referer":         "https://www.realtor.ca/map",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (sessionCookies) apiHeaders["Cookie"] = sessionCookies;

  try {
    const res = await fetch(
      "https://api2.realtor.ca/Listing.svc/PropertySearch_Post",
      { method: "POST", headers: apiHeaders, body: body.toString(), signal: controller.signal },
    );

    if (!res.ok) {
      if (res.status === 403 || res.status === 401 || res.status === 429) {
        // Cookie approach didn't help — IP is blocked regardless.
        // Fall back to HTML scrape as last resort (map SPA, rarely yields data).
        console.warn(`[Realtor.ca] API HTTP ${res.status} after cookie prefetch — falling back to ScrapeOps HTML`);
        const html      = await fetchViaScrapeOps(target.url, "ca", true, 0);
        const extracted = extractRealtorCaHtml(html, "https://www.realtor.ca", target.listingType);
        return extracted.map((p) => ({
          ...p,
          country_iso2:      "CA",
          property_type_raw: p.property_type,
          property_type:     normalisePropertyType(p.property_type),
        }));
      }
      throw new Error(`Realtor.ca API HTTP ${res.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data    = (await res.json()) as any;
    const listings: unknown[] = data?.Results ?? [];

    const results: ParsedProperty[] = [];

    for (const item of listings) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = item as any;

        const mlsNumber = String(r.MlsNumber ?? "").trim();
        if (!mlsNumber) continue;

        const rawPrice  = Number(r.Price?.Value ?? 0);
        const price     = rawPrice > 0 ? Math.round(rawPrice * 100) : null;
        const address   = String(r.Property?.Address?.AddressText ?? "").trim() || null;

        // Bedrooms: Realtor.ca returns "3" or "3+" — take the numeric part
        const bedsStr   = String(r.Building?.Bedrooms ?? "");
        const bedrooms  = bedsStr ? safeInt(parseInt(bedsStr.replace(/\+.*$/, ""), 10)) : null;
        const bathrooms = r.Building?.BathroomTotal != null
          ? safeInt(parseInt(String(r.Building.BathroomTotal), 10))
          : null;

        // Size: "900 sqft" or "84 m²" — extract numeric portion
        const sizeRaw   = String(r.Building?.SizeInterior ?? "");
        const sizeMatch = sizeRaw.match(/[\d,]+/);
        let   sqm: number | null = null;
        if (sizeMatch) {
          const sizeNum = parseInt(sizeMatch[0].replace(/,/g, ""), 10);
          if (isFinite(sizeNum) && sizeNum > 0) {
            // Realtor.ca typically returns sqft — convert to sqm
            sqm = Math.round(sizeNum * 0.0929);
          }
        }

        const typeRaw   = String(r.Building?.Type ?? r.Property?.Type ?? "").toLowerCase().trim() || null;
        const detailUrl = r.RelativeDetailsURL ?? `/real-estate/${mlsNumber}/listing`;
        const listingUrl = detailUrl.startsWith("http")
          ? detailUrl
          : `https://www.realtor.ca${detailUrl}`;

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
          listing_type:         target.listingType,
          listing_url:          listingUrl,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[Realtor.ca API] item parse error:", e);
      }
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROVIDER REGISTRY
───────────────────────────────────────────────────────────────────────────── */

const PROVIDERS: Record<Provider, ProviderConfig> = {

  zoopla: {
    name:          "zoopla",
    currency:      "GBP",
    proxyCountry:  "gb",
    europeanPrice: false,
    renderJs:      true,          // Zoopla is CSR — listings loaded by client-side JS
    baseUrl:       "https://www.zoopla.co.uk",
    countryIso2:   "GB",
    searchTargets: [
      { url: "https://www.zoopla.co.uk/for-sale/property/london/", listingType: "sale" },
      { url: "https://www.zoopla.co.uk/to-rent/property/london/",  listingType: "rent" },
    ],
    extract: extractZoopla,
  },

  zillow: {
    name:          "zillow",
    currency:      "USD",
    proxyCountry:  "us",
    europeanPrice: false,
    renderJs:      true,
    baseUrl:       "https://www.zillow.com",
    countryIso2:   "US",
    searchTargets: [
      // ── For sale — 30 major US cities ──────────────────────────────────────
      { url: "https://www.zillow.com/homes/for_sale/New-York-NY_rb/",         listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Los-Angeles-CA_rb/",      listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Chicago-IL_rb/",          listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Houston-TX_rb/",          listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Phoenix-AZ_rb/",          listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Philadelphia-PA_rb/",     listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/San-Antonio-TX_rb/",      listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/San-Diego-CA_rb/",        listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Dallas-TX_rb/",           listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/San-Francisco-CA_rb/",    listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Austin-TX_rb/",           listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Jacksonville-FL_rb/",     listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Columbus-OH_rb/",         listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Charlotte-NC_rb/",        listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Indianapolis-IN_rb/",     listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Seattle-WA_rb/",          listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Denver-CO_rb/",           listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Nashville-TN_rb/",        listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Oklahoma-City-OK_rb/",    listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Atlanta-GA_rb/",          listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Baltimore-MD_rb/",        listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Miami-FL_rb/",            listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Louisville-KY_rb/",       listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Portland-OR_rb/",         listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Milwaukee-WI_rb/",        listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Las-Vegas-NV_rb/",        listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Albuquerque-NM_rb/",      listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Minneapolis-MN_rb/",      listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Boston-MA_rb/",           listingType: "sale" },
      { url: "https://www.zillow.com/homes/for_sale/Detroit-MI_rb/",          listingType: "sale" },
      // ── For rent — top 10 metro rental markets ─────────────────────────────
      { url: "https://www.zillow.com/homes/for_rent/New-York-NY_rb/",         listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Los-Angeles-CA_rb/",      listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Chicago-IL_rb/",          listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Houston-TX_rb/",          listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Miami-FL_rb/",            listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/San-Francisco-CA_rb/",    listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Seattle-WA_rb/",          listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Boston-MA_rb/",           listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Denver-CO_rb/",           listingType: "rent" },
      { url: "https://www.zillow.com/homes/for_rent/Atlanta-GA_rb/",          listingType: "rent" },
    ],
    extract: extractZillow,
  },

  realtor_ca: {
    name:          "realtor_ca",
    currency:      "CAD",
    proxyCountry:  "ca",
    europeanPrice: false,
    renderJs:      false, // uses directScraper — not fetched via ScrapeOps
    baseUrl:       "https://www.realtor.ca",
    countryIso2:   "CA",
    searchTargets: [
      { url: "https://www.realtor.ca/real-estate/on/toronto",   listingType: "sale" },
      { url: "https://www.realtor.ca/real-estate/bc/vancouver", listingType: "sale" },
    ],
    extract:       () => [], // unused — directScraper takes precedence
    directScraper: scrapeRealtorCaViaApi,
  },

  realestate_au: {
    name:          "realestate_au",
    currency:      "AUD",
    proxyCountry:  "au",
    europeanPrice: false,
    renderJs:      false,         // REA Group (Akamai) blocks ScrapeOps at network level — renderJs=true wastes 80s
    baseUrl:       "https://www.realestate.com.au",
    countryIso2:   "AU",
    searchTargets: [
      { url: "https://www.realestate.com.au/buy/in-sydney,+nsw/list-1",  listingType: "sale" },
      { url: "https://www.realestate.com.au/rent/in-sydney,+nsw/list-1", listingType: "rent" },
    ],
    extract: extractRealestateAu,
  },

  idealista: {
    name:          "idealista",
    currency:      "EUR",
    proxyCountry:  "es",
    europeanPrice: true,
    renderJs:      false,         // Idealista blocks ScrapeOps at network level — renderJs=true wastes 75s+ per URL
    baseUrl:       "https://www.idealista.com",
    countryIso2:   "ES",
    searchTargets: [
      { url: "https://www.idealista.com/venta-viviendas/madrid-municipio/", listingType: "sale" },
      { url: "https://www.idealista.com/alquiler-viviendas/madrid-municipio/", listingType: "rent" }, // barcelona/* returns 404; use Madrid for both
    ],
    extract: extractIdealista,
  },

  rightmove: {
    name:          "rightmove",
    currency:      "GBP",
    proxyCountry:  "gb",
    europeanPrice: false,
    renderJs:      true,
    baseUrl:       "https://www.rightmove.co.uk",
    countryIso2:   "GB",
    searchTargets: [
      {
        // REGION%5E87490 = Greater London (Rightmove region code)
        url:         "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E87490&sortType=6&numberOfPropertiesPerPage=24&index=0",
        listingType: "sale",
      },
      {
        url:         "https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=REGION%5E87490&sortType=6&numberOfPropertiesPerPage=24&index=0",
        listingType: "rent",
      },
    ],
    extract: extractRightmove,
  },

  onthemarket: {
    name:          "onthemarket",
    currency:      "GBP",
    proxyCountry:  "gb",
    europeanPrice: false,
    renderJs:      true,
    baseUrl:       "https://www.onthemarket.com",
    countryIso2:   "GB",
    searchTargets: [
      {
        url:         "https://www.onthemarket.com/for-sale/property/london/",
        listingType: "sale",
      },
      {
        url:         "https://www.onthemarket.com/to-rent/property/london/",
        listingType: "rent",
      },
    ],
    extract: extractOnTheMarket,
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE UPSERT
───────────────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Upsert enriched ParsedProperty rows using the passed service-role client.
 * The client is created once per request in the handler and passed here to
 * avoid re-instantiating per batch.
 */
async function upsertProperties(
  rows:     ParsedProperty[],
  supabase: SupabaseClient,
): Promise<number> {
  if (!rows.length) return 0;

  let total = 0;

  for (let i = 0; i < rows.length; i += SUPABASE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SUPABASE_BATCH_SIZE).map((r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase
      .from("properties")
      .upsert(batch as any, {
        onConflict:       "provider,external_property_id",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      throw new Error(
        `Supabase upsert failed (batch starting at index ${i}): ${error.message}`,
      );
    }

    total += data?.length ?? 0;
  }

  return total;
}

/**
 * Write a completed scrape run to the scraper_runs audit table.
 * Never throws — failure is logged but does not affect the scrape response.
 */
async function upsertScraperRun(
  report:   ScrapeReport,
  startedAt: string,
  supabase:  SupabaseClient,
): Promise<void> {
  try {
    const exitStatus: "success" | "partial" | "failure" =
      report.errors.length === 0 ? "success"
      : report.upsertedCount > 0  ? "partial"
      :                             "failure";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("scraper_runs") as any).insert({
      provider:         report.provider,
      started_at:       startedAt,
      finished_at:      new Date().toISOString(),
      records_scraped:  report.scrapedCount,
      records_upserted: report.upsertedCount,
      records_failed:   report.failedCount,
      errors:           report.errors,
      exit_status:      exitStatus,
      duration_ms:      report.durationMs,
    });
  } catch (err) {
    console.error("[scraper_runs] audit write failed:", (err as Error).message);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCRAPE ORCHESTRATOR
───────────────────────────────────────────────────────────────────────────── */

async function scrapeProvider(
  config:   ProviderConfig,
  supabase: SupabaseClient,
): Promise<ScrapeReport> {
  const t0          = Date.now();
  const startedAt   = new Date().toISOString();
  const errors:     string[]          = [];
  const allParsed:  ParsedProperty[]  = [];
  let   failedCount = 0;

  for (let i = 0; i < config.searchTargets.length; i++) {
    const target = config.searchTargets[i];

    try {
      console.log(`[${config.name}] ↗ ${config.directScraper ? "API" : "ScrapeOps"} → ${target.url}`);

      let raw: ParsedProperty[];

      if (config.directScraper) {
        // Provider uses its own fetch+parse pipeline (e.g. Realtor.ca JSON API)
        raw = await config.directScraper(target);
      } else {
        // Default: ScrapeOps proxy → HTML → extractor
        const html      = await fetchViaScrapeOps(target.url, config.proxyCountry, config.renderJs, 0, config.waitFor);
        const extracted = config.extract(html, config.baseUrl, target.listingType);

        // ── ETL enrichment ────────────────────────────────────────────────────
        raw = extracted.map((p) => ({
          ...p,
          country_iso2:      config.countryIso2,
          property_type_raw: p.property_type,
          property_type:     normalisePropertyType(p.property_type),
        }));
      }

      // ── Critical field validation — drop un-displayable records ────────────
      const valid    = raw.filter(validateRecord);
      const rejected = raw.length - valid.length;
      if (rejected > 0) {
        console.warn(`[${config.name}] ⚠ dropped ${rejected} records with no price AND no address`);
        failedCount += rejected;
      }

      console.log(
        `[${config.name}] ✓ ${valid.length} valid listings (${target.listingType}) from ${target.url}`,
      );

      // ── Minimum record threshold alert ────────────────────────────────────
      if (valid.length < MIN_RECORDS_PER_URL) {
        const alertMsg = `⚠️ *Prime Atlas scraper* — \`${config.name}\` returned only ${valid.length} records for ${target.url} (threshold: ${MIN_RECORDS_PER_URL}). Possible selector drift or ban.`;
        console.warn(`[${config.name}] ${alertMsg}`);
        await sendSlackAlert(alertMsg);
        errors.push(`Low record count for ${target.url}: ${valid.length} < ${MIN_RECORDS_PER_URL}`);
      }

      allParsed.push(...valid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${target.url}: ${msg}`);
      console.error(`[${config.name}] ✗ scrape failed for ${target.url}:`, msg);
    }

    if (i < config.searchTargets.length - 1) {
      await sleep(INTER_URL_DELAY_MS);
    }
  }

  // ── Deduplicate within this batch ─────────────────────────────────────────
  const seen   = new Set<string>();
  const unique = allParsed.filter(({ provider, external_property_id: eid }) => {
    if (!eid) return false;
    const key = `${provider}::${eid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let upsertedCount = 0;

  if (unique.length > 0) {
    try {
      upsertedCount = await upsertProperties(unique, supabase);
      console.log(`[${config.name}] ✓ upserted ${upsertedCount}/${unique.length} rows`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Supabase upsert: ${msg}`);
      console.error(`[${config.name}] ✗ upsert error:`, msg);
    }
  }

  const report: ScrapeReport = {
    provider:      config.name,
    scrapedCount:  unique.length,
    upsertedCount,
    failedCount,
    errors,
    durationMs:    Date.now() - t0,
  };

  // ── Write audit record ────────────────────────────────────────────────────
  await upsertScraperRun(report, startedAt, supabase);

  return report;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROUTE HANDLER
───────────────────────────────────────────────────────────────────────────── */

export async function GET(request: Request): Promise<Response> {

  // ── 1. Authenticate the caller ────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on this server" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    console.warn("[cron/scrape-listings] Rejected request — invalid authorization header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Guard all required environment variables ───────────────────────────
  const missing = (
    ["SCRAPEOPS_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const
  ).filter((k) => !process.env[k]);

  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing required environment variables", missing },
      { status: 500 },
    );
  }

  // ── 3. Resolve and validate the ?provider= query parameter ───────────────
  const { searchParams } = new URL(request.url);
  const raw              = searchParams.get("provider")?.toLowerCase().trim();
  const providerParam    = raw as Provider | undefined;

  if (!providerParam || !(providerParam in PROVIDERS)) {
    return NextResponse.json(
      {
        error:          "Missing or invalid ?provider= query parameter",
        validProviders: Object.keys(PROVIDERS) as Provider[],
        exampleRequest: "/api/cron/scrape-listings?provider=zillow",
      },
      { status: 400 },
    );
  }

  // ── 4a. Debug mode — return raw HTML snippet for selector inspection ──────
  const debug = searchParams.get("debug") === "1";
  if (debug) {
    const cfg    = PROVIDERS[providerParam];
    const target = cfg.searchTargets[0];
    try {
      const html = await fetchViaScrapeOps(target.url, cfg.proxyCountry, cfg.renderJs);

      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      let nextDataPreview: unknown = null;
      if (nextDataMatch?.[1]) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed      = JSON.parse(nextDataMatch[1]) as any;
          const pageProps   = parsed?.props?.pageProps;
          const sps         = pageProps?.searchPageState;
          const cat1        = sps?.cat1;
          const sr          = cat1?.searchResults;
          const listResults = sr?.listResults ?? sr?.mapResults ?? [];
          nextDataPreview   = {
            found:        true,
            rawLength:    nextDataMatch[1].length,
            pagePropKeys: pageProps   ? Object.keys(pageProps)   : [],
            spsKeys:      sps         ? Object.keys(sps)         : [],
            cat1Keys:     cat1        ? Object.keys(cat1)        : [],
            srKeys:       sr          ? Object.keys(sr)          : [],
            listCount:    Array.isArray(listResults) ? listResults.length : 0,
            firstListing: Array.isArray(listResults) && listResults[0] ? listResults[0] : null,
          };
        } catch {
          nextDataPreview = { found: true, parseError: true, raw: nextDataMatch[1].slice(0, 500) };
        }
      } else {
        const zpidIdx = html.indexOf("zpid");
        nextDataPreview = {
          found:   false,
          zpidAt:  zpidIdx,
          zpidCtx: zpidIdx >= 0 ? html.slice(zpidIdx - 50, zpidIdx + 300) : null,
        };
      }

      return NextResponse.json({
        debug: true, provider: providerParam, url: target.url,
        htmlLength: html.length, nextData: nextDataPreview,
      });
    } catch (err) {
      return NextResponse.json({ debug: true, error: (err as Error).message }, { status: 500 });
    }
  }

  // ── 4b. Create Supabase service-role client (one per request) ────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ── 4c. Execute the scrape ────────────────────────────────────────────────
  console.log(`[cron/scrape-listings] ▶ starting provider=${providerParam}`);

  try {
    const report = await scrapeProvider(PROVIDERS[providerParam], supabase);

    // ── Slack alert on total failure ────────────────────────────────────────
    if (report.upsertedCount === 0 && report.errors.length > 0) {
      await sendSlackAlert(
        `🚨 *Prime Atlas scraper* — \`${providerParam}\` total failure. 0 records upserted.\n\`\`\`${report.errors.slice(0, 3).join("\n")}\`\`\``,
      );
    }

    // 200 = success | 207 = partial (errors but some data saved) | 500 = total failure
    const status = report.errors.length === 0     ? 200
                 : report.upsertedCount > 0        ? 207
                 :                                   500;

    return NextResponse.json(
      {
        ok:     status < 500,
        report,
        meta: {
          provider:    providerParam,
          executedAt:  new Date().toISOString(),
          environment: process.env.VERCEL_ENV ?? "local",
        },
      },
      { status },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[cron/scrape-listings] Fatal error:", err);

    await sendSlackAlert(
      `🚨 *Prime Atlas scraper* — \`${providerParam}\` crashed with fatal error: ${message}`,
    );

    return NextResponse.json(
      { ok: false, error: message, provider: providerParam },
      { status: 500 },
    );
  }
}
