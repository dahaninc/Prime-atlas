/**
 * src/app/api/cron/scrape-listings/route.ts
 *
 * Enterprise real-estate listing scraper — five platforms, one route.
 *
 * All target URLs are proxied through the ScrapeOps Proxy API Gateway, which
 * handles JS rendering (headless Chromium), residential IP rotation, and
 * Akamai / Cloudflare / Kasada anti-bot bypasses entirely on its own
 * infrastructure. Our Next.js handler makes a single lightweight fetch() per
 * page and receives clean, fully-rendered HTML in return.
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
 *
 *  3. Run the Supabase migration below (SQL editor → New query).
 *
 *  4. Invoke per-provider — each run stays comfortably within Vercel timeouts:
 *       GET /api/cron/scrape-listings?provider=zillow
 *       Authorization: Bearer <CRON_SECRET>
 *
 *  5. Schedule with vercel.json (Vercel Pro required for maxDuration > 60s):
 *       {
 *         "crons": [
 *           { "path": "/api/cron/scrape-listings?provider=zoopla",        "schedule": "0 2 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=zillow",        "schedule": "0 3 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=realtor_ca",    "schedule": "0 4 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=realestate_au", "schedule": "0 5 * * *" },
 *           { "path": "/api/cron/scrape-listings?provider=idealista",     "schedule": "0 6 * * *" }
 *         ]
 *       }
 *     Vercel automatically sends Authorization: Bearer <CRON_SECRET> in prod.
 *
 * ─── SUPABASE MIGRATION ───────────────────────────────────────────────────────
 *
 *   CREATE TABLE IF NOT EXISTS public.properties (
 *     id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     provider             TEXT        NOT NULL,
 *     external_property_id TEXT        NOT NULL,
 *     title                TEXT,
 *     address              TEXT,
 *     price                BIGINT,
 *     currency_code        TEXT        NOT NULL DEFAULT 'GBP',
 *     bedrooms             INTEGER,
 *     bathrooms            INTEGER,
 *     size_sqm             NUMERIC,
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
 *   CREATE INDEX IF NOT EXISTS idx_properties_provider     ON public.properties (provider);
 *   CREATE INDEX IF NOT EXISTS idx_properties_price        ON public.properties (price);
 *   CREATE INDEX IF NOT EXISTS idx_properties_scraped_at   ON public.properties (scraped_at DESC);
 *   CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON public.properties (listing_type);
 *
 *   ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "properties_public_read" ON public.properties
 *     FOR SELECT TO anon USING (status = 'active');
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
const REQUEST_TIMEOUT_MS  = 45_000;   // abort a single ScrapeOps call after 45s
const RETRY_BASE_DELAY_MS = 2_000;    // exponential-backoff base (doubles per retry)
const INTER_URL_DELAY_MS  = 2_500;    // polite pause between consecutive page fetches
const SUPABASE_BATCH_SIZE = 100;      // rows per upsert call

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

type Provider    = "zoopla" | "zillow" | "realtor_ca" | "realestate_au" | "idealista";
type ListingType = "sale" | "rent";

interface ParsedProperty {
  provider:              Provider;
  external_property_id:  string;
  title:                 string | null;
  address:               string | null;
  /** Stored in minor currency units: pence (GBP), cents (USD/AUD/CAD), eurocents (EUR) */
  price:                 number | null;
  currency_code:         string;
  bedrooms:              number | null;
  bathrooms:             number | null;
  size_sqm:              number | null;
  property_type:         string | null;
  listing_type:          ListingType;
  listing_url:           string | null;
  scraped_at:            string;
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
  baseUrl:       string;
  searchTargets: SearchTarget[];
  extract:       (html: string, baseUrl: string, listingType: ListingType) => ParsedProperty[];
}

interface ScrapeReport {
  provider:      Provider;
  scrapedCount:  number;
  upsertedCount: number;
  errors:        string[];
  durationMs:    number;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED UTILITIES
───────────────────────────────────────────────────────────────────────────── */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Convert a localised price string to a minor-unit integer.
 *
 * English  (en):  "£1,250,000" → 125_000_000 pence
 *                 "$450,000"   →  45_000_000 cents
 * European (es):  "250.000 €"  →  25_000_000 eurocents
 *                 "1.250.000"  → 125_000_000 eurocents
 */
function parsePrice(raw: string, european = false): number | null {
  const stripped = raw.replace(/[^\d.,]/g, "").trim();
  if (!stripped) return null;

  const normalised = european
    ? stripped.replace(/\./g, "").replace(",", ".") // 250.000,50 → 250000.50
    : stripped.replace(/,/g, "");                   // 1,250,000  → 1250000

  const n = parseFloat(normalised);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Return the last non-empty path segment of a URL (often the platform's property ID). */
function idFromUrl(url: string): string {
  return (
    url.split("?")[0].replace(/\/$/, "").split("/").filter(Boolean).pop() ?? ""
  );
}

/**
 * Clamp a parsed integer to a sensible range.
 * Returns null for NaN, negative values, or values exceeding max.
 */
function safeInt(n: number, max = 99): number | null {
  return isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCRAPEOPS PROXY GATEWAY
───────────────────────────────────────────────────────────────────────────── */

/**
 * Route a target URL through the ScrapeOps Proxy API (v1).
 *
 * ScrapeOps executes on its own infrastructure:
 *   • residential=true      — rotates residential IPs to bypass IP-reputation blocks
 *   • render_js=true        — runs headless Chromium; returns fully hydrated HTML
 *   • premium_proxy=true    — activates specialised Akamai / Kasada / Cloudflare bypass
 *   • country=<2-letter>    — pins proxy exit node to the target site's home country
 *
 * Our server sends one plain fetch() and receives clean HTML — zero browser
 * process overhead on the Next.js side.
 */
async function fetchViaScrapeOps(
  targetUrl:    string,
  proxyCountry: string,
  retries = 2,
): Promise<string> {
  const apiKey = process.env.SCRAPEOPS_API_KEY;
  if (!apiKey) throw new Error("SCRAPEOPS_API_KEY is not configured");

  const qs = new URLSearchParams({
    api_key:       apiKey,
    url:           targetUrl,
    render_js:     "true",
    residential:   "true",
    premium_proxy: "true",
    country:       proxyCountry,
  });

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

  // unreachable — the final-attempt throw above always fires
  throw new Error("fetchViaScrapeOps: all retries exhausted");
}

/* ─────────────────────────────────────────────────────────────────────────────
   PLATFORM EXTRACTORS
   Each function receives the fully-rendered HTML string from ScrapeOps,
   the provider's base URL for resolving relative hrefs, and the listing type.
   It returns an array of ParsedProperty objects — never throws.
───────────────────────────────────────────────────────────────────────────── */

// ─── 1. ZOOPLA (UK) ──────────────────────────────────────────────────────────
//
// Zoopla is a Next.js app. With render_js=true, listing cards hydrate under
// [data-testid="regular-listings"] as <li> elements. The numeric tail of the
// detail URL (/for-sale/property/.../listing-{ID}/) is the stable external ID.
// data-testid attributes are intentionally stable across Zoopla deploys.

function extractZoopla(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ParsedProperty[] {
  const $       = load(html);
  const results: ParsedProperty[] = [];
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

  return results;
}

// ─── 2. ZILLOW (US) ──────────────────────────────────────────────────────────
//
// Zillow renders property cards as <article data-zpid="..."> elements.
// The zpid (Zillow Property ID) is the canonical stable identifier and lives
// on both the article element and the detail URL (/homedetails/{id}_zpid/).
// Bed / bath / sqft figures appear in a <ul> of <li> elements per card.

function extractZillow(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ParsedProperty[] {
  const $       = load(html);
  const results: ParsedProperty[] = [];
  const now     = new Date().toISOString();

  $('article[data-zpid], [data-test="property-card"]').each((_, el) => {
    try {
      const card = $(el);
      const zpid = card.attr("data-zpid") ?? "";

      const linkEl  = card.find('[data-test="property-card-link"], a[href*="_zpid"]').first();
      const href    = linkEl.attr("href") ?? "";
      const fullUrl = href.startsWith("http") ? href : `https://www.zillow.com${href}`;

      const zpidFromUrl = href.match(/(\d+)_zpid/)?.[1] ?? "";
      const extId       = zpid || zpidFromUrl || idFromUrl(href);
      if (!extId) return;

      const priceText = card.find('[data-test="property-card-price"]').first().text().trim();
      const address   = card.find('[data-test="property-card-addr"]').first().text().replace(/\s+/g, " ").trim();

      let beds: number | null  = null;
      let baths: number | null = null;
      let sqft: number | null  = null;

      card.find('[data-test="property-card-details"] li, .StyledPropertyCardDataArea--body li').each((_, li) => {
        const text = $(li).text().toLowerCase().trim();
        if (/\d+\s*(bd|bds|bed)/.test(text))       beds  = safeInt(parseInt(text, 10));
        else if (/\d+(\.\d)?\s*(ba|bath)/.test(text)) baths = safeInt(parseFloat(text));
        else if (/[\d,]+\s*sqft/.test(text))        sqft  = parseInt(text.replace(/,/g, ""), 10) || null;
      });

      results.push({
        provider:             "zillow",
        external_property_id: extId,
        title:                address || null,
        address:              address || null,
        price:                parsePrice(priceText),
        currency_code:        "USD",
        bedrooms:             beds,
        bathrooms:            baths,
        size_sqm:             sqft != null ? Math.round(sqft * 0.0929) : null,
        property_type:        null,
        listing_type:         listingType,
        listing_url:          fullUrl || null,
        scraped_at:           now,
      });
    } catch (e) {
      console.error("[Zillow] card parse error:", e);
    }
  });

  return results;
}

// ─── 3. REALTOR.CA (Canada) ──────────────────────────────────────────────────
//
// Realtor.ca is a React SPA. Card elements carry compound CSS-module class
// names — we match on substrings with [class*="..."] selectors. The MLS®
// number lives in the URL path (/real-estate/{mlsNumber}/slug) or as a
// data-id attribute directly on the card element.

function extractRealtorCa(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ParsedProperty[] {
  const $       = load(html);
  const results: ParsedProperty[] = [];
  const now     = new Date().toISOString();

  $('[class*="cardCon"], [class*="listingCard"], [data-id]').each((_, el) => {
    try {
      const card   = $(el);
      const dataId = card.attr("data-id") ?? "";

      const linkEl  = card.find('[class*="listingDetails"], a[href*="/real-estate/"]').first();
      const href    = linkEl.attr("href") ?? "";
      if (!href) return;

      const fullUrl  = href.startsWith("http") ? href : `https://www.realtor.ca${href}`;
      const mlsMatch = href.match(/\/real-estate\/(\d+)\//);
      const extId    = dataId || mlsMatch?.[1] || idFromUrl(href);
      if (!extId) return;

      const priceText = card.find('[class*="listingCardPrice"], [class*="Price"]').first().text().trim();
      const address   = card.find('[class*="listingCardAddress"], [class*="Address"]').first().text().replace(/\s+/g, " ").trim();
      const title     = card.find('[class*="listingCardTitle"], h2, h3').first().text().replace(/\s+/g, " ").trim() || address;

      const bedsRaw  = card.find('[class*="bedroomNumber"], [class*="Bedroom"]').first().text().trim();
      const bathsRaw = card.find('[class*="bathroomNumber"], [class*="Bathroom"]').first().text().trim();
      const sqftRaw  = card.find('[class*="sqft"], [class*="SquareFeet"]').first().text().trim();
      const sqft     = sqftRaw ? parseInt(sqftRaw.replace(/,/g, ""), 10) : null;
      const typeRaw  = card.find('[class*="PropertyType"], [class*="propertyType"]').first().text().trim().toLowerCase();

      results.push({
        provider:             "realtor_ca",
        external_property_id: String(extId),
        title:                title   || null,
        address:              address || null,
        price:                parsePrice(priceText),
        currency_code:        "CAD",
        bedrooms:             safeInt(parseInt(bedsRaw, 10)),
        bathrooms:            safeInt(parseFloat(bathsRaw)),
        size_sqm:             sqft != null ? Math.round(sqft * 0.0929) : null,
        property_type:        typeRaw || null,
        listing_type:         listingType,
        listing_url:          fullUrl,
        scraped_at:           now,
      });
    } catch (e) {
      console.error("[Realtor.ca] card parse error:", e);
    }
  });

  return results;
}

// ─── 4. REALESTATE.COM.AU (Australia) ────────────────────────────────────────
//
// REA Group uses data-testid attributes throughout. Property IDs are embedded
// in the URL slug as the final long numeric segment (/property-house-nsw-12345678).
// Bed / bath / land-size features render as adjacent <span> pairs:
//   <span>3</span><span>Beds</span>

function extractRealestateAu(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ParsedProperty[] {
  const $       = load(html);
  const results: ParsedProperty[] = [];
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

      // Feature spans: value span followed by label span
      card.find('[data-testid*="features"] span, [class*="propertyFeature"] span').each((_, span) => {
        const value = $(span).text().trim();
        const label = $(span).next("span").text().toLowerCase().trim();
        const n     = parseInt(value, 10);

        if (label.startsWith("bed") || label === "br")                 beds  = safeInt(n);
        else if (label.startsWith("bath"))                             baths = safeInt(n);
        else if (label.includes("m²") || label.includes("sqm"))       sqm   = isFinite(n) ? n : null;
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

// ─── 5. IDEALISTA (Spain / Italy / Portugal) ─────────────────────────────────
//
// Idealista listing cards are <article class="item" data-element-id="...">.
// data-element-id is the canonical stable identifier across all three markets.
// Prices use European locale (. = thousands separator, , = decimal separator).
// Room counts appear as: "3 habs." (bedrooms), "2 baños" (bathrooms), "90 m²".

function extractIdealista(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ParsedProperty[] {
  const $       = load(html);
  const results: ParsedProperty[] = [];
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

      // Detail chips: "3 habs.", "2 baños", "90 m²", "piso" (type), etc.
      card.find(".item-detail-char li, .item-detail").each((_, li) => {
        const text = $(li).text().toLowerCase().trim();
        const n    = parseInt(text, 10);

        if ((text.includes("hab") || text.includes("dorm")) && isFinite(n)) beds  = safeInt(n);
        else if ((text.includes("baño") || text.includes("aseo")) && isFinite(n)) baths = safeInt(n);
        else if ((text.includes("m²") || text.includes("m2")) && isFinite(n))    sqm   = n;
      });

      // The first chip typically describes property type (piso, casa, chalet…)
      const typeRaw = card.find(".item-detail-char li").first().text().trim().toLowerCase() || null;

      results.push({
        provider:             "idealista",
        external_property_id: String(resolvedId),
        title:                address || null,
        address:              address || null,
        price:                parsePrice(priceText, true), // European locale
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

/* ─────────────────────────────────────────────────────────────────────────────
   PROVIDER REGISTRY
───────────────────────────────────────────────────────────────────────────── */

const PROVIDERS: Record<Provider, ProviderConfig> = {

  zoopla: {
    name:          "zoopla",
    currency:      "GBP",
    proxyCountry:  "gb",
    europeanPrice: false,
    baseUrl:       "https://www.zoopla.co.uk",
    searchTargets: [
      {
        url:         "https://www.zoopla.co.uk/for-sale/property/london/?page_size=25",
        listingType: "sale",
      },
      {
        url:         "https://www.zoopla.co.uk/to-rent/property/london/?page_size=25",
        listingType: "rent",
      },
    ],
    extract: extractZoopla,
  },

  zillow: {
    name:          "zillow",
    currency:      "USD",
    proxyCountry:  "us",
    europeanPrice: false,
    baseUrl:       "https://www.zillow.com",
    searchTargets: [
      {
        url:         "https://www.zillow.com/homes/for_sale/",
        listingType: "sale",
      },
      {
        url:         "https://www.zillow.com/homes/for_rent/",
        listingType: "rent",
      },
    ],
    extract: extractZillow,
  },

  realtor_ca: {
    name:          "realtor_ca",
    currency:      "CAD",
    proxyCountry:  "ca",
    europeanPrice: false,
    baseUrl:       "https://www.realtor.ca",
    searchTargets: [
      {
        url:         "https://www.realtor.ca/real-estate/on/toronto",
        listingType: "sale",
      },
      {
        url:         "https://www.realtor.ca/real-estate/bc/vancouver",
        listingType: "sale",
      },
    ],
    extract: extractRealtorCa,
  },

  realestate_au: {
    name:          "realestate_au",
    currency:      "AUD",
    proxyCountry:  "au",
    europeanPrice: false,
    baseUrl:       "https://www.realestate.com.au",
    searchTargets: [
      {
        url:         "https://www.realestate.com.au/buy/in-sydney,+nsw/list-1",
        listingType: "sale",
      },
      {
        url:         "https://www.realestate.com.au/rent/in-sydney,+nsw/list-1",
        listingType: "rent",
      },
    ],
    extract: extractRealestateAu,
  },

  idealista: {
    name:          "idealista",
    currency:      "EUR",
    proxyCountry:  "es",
    europeanPrice: true,
    baseUrl:       "https://www.idealista.com",
    searchTargets: [
      {
        url:         "https://www.idealista.com/venta-viviendas/madrid/",
        listingType: "sale",
      },
      {
        url:         "https://www.idealista.com/alquiler-viviendas/barcelona/",
        listingType: "rent",
      },
    ],
    extract: extractIdealista,
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE UPSERT
───────────────────────────────────────────────────────────────────────────── */

/**
 * Upsert parsed properties into public.properties using the service role key
 * (bypasses RLS). Conflict on the compound unique key (provider,
 * external_property_id) — existing rows are updated (price, beds, etc. stay
 * fresh); created_at is preserved by the database DEFAULT.
 *
 * Rows are chunked to SUPABASE_BATCH_SIZE to stay within PostgREST payload
 * limits. Returns the total count of rows inserted or updated.
 */
async function upsertProperties(rows: ParsedProperty[]): Promise<number> {
  if (!rows.length) return 0;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let total = 0;

  for (let i = 0; i < rows.length; i += SUPABASE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SUPABASE_BATCH_SIZE).map((r) => ({
      ...r,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("properties")
      .upsert(batch, {
        onConflict:       "provider,external_property_id",
        ignoreDuplicates: false, // update price / address on re-scrape
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

/* ─────────────────────────────────────────────────────────────────────────────
   SCRAPE ORCHESTRATOR
───────────────────────────────────────────────────────────────────────────── */

async function scrapeProvider(config: ProviderConfig): Promise<ScrapeReport> {
  const t0             = Date.now();
  const errors:  string[]           = [];
  const parsed:  ParsedProperty[]   = [];

  for (let i = 0; i < config.searchTargets.length; i++) {
    const target = config.searchTargets[i];

    try {
      console.log(`[${config.name}] ↗ ScrapeOps → ${target.url}`);

      const html     = await fetchViaScrapeOps(target.url, config.proxyCountry);
      const listings = config.extract(html, config.baseUrl, target.listingType);

      console.log(`[${config.name}] ✓ ${listings.length} listings parsed (${target.listingType})`);
      parsed.push(...listings);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${target.url}: ${msg}`);
      console.error(`[${config.name}] ✗ scrape failed for ${target.url}:`, msg);
    }

    // Polite inter-request delay — skip after the final URL
    if (i < config.searchTargets.length - 1) {
      await sleep(INTER_URL_DELAY_MS);
    }
  }

  // Deduplicate within this batch before writing to Supabase
  const seen   = new Set<string>();
  const unique = parsed.filter(({ provider, external_property_id: eid }) => {
    if (!eid) return false;
    const key = `${provider}::${eid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let upsertedCount = 0;

  if (unique.length > 0) {
    try {
      upsertedCount = await upsertProperties(unique);
      console.log(`[${config.name}] ✓ upserted ${upsertedCount}/${unique.length} rows`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Supabase upsert: ${msg}`);
      console.error(`[${config.name}] ✗ upsert error:`, msg);
    }
  }

  return {
    provider:      config.name,
    scrapedCount:  unique.length,
    upsertedCount,
    errors,
    durationMs:    Date.now() - t0,
  };
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
        error:           "Missing or invalid ?provider= query parameter",
        validProviders:  Object.keys(PROVIDERS) as Provider[],
        exampleRequest:  "/api/cron/scrape-listings?provider=zillow",
      },
      { status: 400 },
    );
  }

  // ── 4. Execute the scrape ─────────────────────────────────────────────────
  console.log(`[cron/scrape-listings] ▶ starting provider=${providerParam}`);

  try {
    const report = await scrapeProvider(PROVIDERS[providerParam]);

    // 200 = complete success | 207 = partial (errors but some data) | 500 = total failure
    const status = report.errors.length === 0      ? 200
                 : report.upsertedCount  > 0        ? 207
                 :                                    500;

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
    return NextResponse.json(
      { ok: false, error: message, provider: providerParam },
      { status: 500 },
    );
  }
}
