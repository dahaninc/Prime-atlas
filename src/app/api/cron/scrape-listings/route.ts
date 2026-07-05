/**
 * src/app/api/cron/scrape-listings/route.ts
 *
 * Real-estate listing scraper — 3 active providers: Zillow, Rightmove, OnTheMarket.
 * All URLs proxied through ScrapeOps (JS rendering, residential IP rotation).
 *
 * ─── SETUP ────────────────────────────────────────────────────────────────────
 *
 *  Env vars (set in .env.local + Vercel project):
 *    SCRAPEOPS_API_KEY         — ScrapeOps proxy key
 *    CRON_SECRET               — authorization secret for the cron endpoint
 *    SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (server-side only)
 *    NEXT_PUBLIC_SUPABASE_URL  — Supabase project URL
 *    SLACK_WEBHOOK_URL         — optional Slack alert webhook
 *
 *  Invoke:
 *    GET /api/cron/scrape-listings?provider=zillow&batch=0
 *    Authorization: Bearer <CRON_SECRET>
 *
 *  Batching: providers with many search targets are sliced into batches of
 *  BATCH_SIZE URLs (?batch=N picks the Nth slice). Each batch fits inside the
 *  Vercel Pro 300s window even in the worst case (all requests timing out
 *  once and retrying). See vercel.json for the batch schedule.
 */

import { NextResponse } from "next/server";
import { load }         from "cheerio";
import { createClient } from "@supabase/supabase-js";

/* ─────────────────────────────────────────────────────────────────────────────
   RUNTIME CONFIG
───────────────────────────────────────────────────────────────────────────── */

export const maxDuration = 300;
export const dynamic     = "force-dynamic";

const SCRAPEOPS_BASE      = "https://proxy.scrapeops.io/v1/";
const REQUEST_TIMEOUT_MS  = 45_000;   // per attempt; 2 attempts max per URL
const FETCH_RETRIES       = 1;        // 1 retry after the first failure
const RETRY_BASE_DELAY_MS = 2_000;
const INTER_URL_DELAY_MS  = 2_500;
const SUPABASE_BATCH_SIZE = 100;
const MIN_RECORDS_PER_URL = 3;
const BATCH_SIZE          = 5;        // search targets per invocation
// Stop launching new URLs after this much elapsed time. Worst case per URL
// is 2 attempts × 45s + 2s backoff ≈ 92s, so 180s + 92s + upsert time still
// finishes before Vercel kills the function at maxDuration (300s).
const SOFT_DEADLINE_MS    = 180_000;
const SLACK_TIMEOUT_MS    = 5_000;

/* ─────────────────────────────────────────────────────────────────────────────
   PROPERTY TYPE TAXONOMY MAP
───────────────────────────────────────────────────────────────────────────── */

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "apartment":               "Apartment",
  "apartments":              "Apartment",
  "flat":                    "Apartment",
  "flats":                   "Apartment",
  "studio":                  "Apartment",
  "studio apartment":        "Apartment",
  "studio flat":             "Apartment",
  "penthouse":               "Apartment",
  "duplex":                  "Apartment",
  "maisonette":              "Apartment",
  "ground floor flat":       "Apartment",
  "upper floor flat":        "Apartment",
  "lower floor flat":        "Apartment",
  "house":                   "House",
  "houses":                  "House",
  "single family home":      "House",
  "single family residence": "House",
  "single family":           "House",
  "detached":                "House",
  "detached house":          "House",
  "semi-detached":           "House",
  "semi detached":           "House",
  "semi-detached house":     "House",
  "terraced":                "House",
  "terraced house":          "House",
  "end of terrace":          "House",
  "end-of-terrace":          "House",
  "link detached house":     "House",
  "mews house":              "House",
  "villa":                   "House",
  "bungalow":                "House",
  "townhouse":               "House",
  "town house":              "House",
  "cottage":                 "House",
  "condo":                   "Condo",
  "condominium":             "Condo",
  "condos":                  "Condo",
  "strata":                  "Condo",
  "multi family":            "Multi-family",
  "multi-family":            "Multi-family",
  "multifamily":             "Multi-family",
  "apartment building":      "Multi-family",
  "block of flats":          "Multi-family",
  "land":                    "Land",
  "plot":                    "Land",
  "building plot":           "Land",
  "development land":        "Land",
  "commercial":              "Commercial",
  "office":                  "Commercial",
  "retail":                  "Commercial",
  "shop":                    "Commercial",
  "industrial":              "Commercial",
  "warehouse":               "Commercial",
  "garage":                  "Parking",
  "parking":                 "Parking",
  "mobile home":             "Mobile Home",
  "manufactured home":       "Mobile Home",
  "farm":                    "Farm",
  "rural":                   "Farm",
  "acreage":                 "Farm",
};

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

type Provider    = "zillow" | "rightmove" | "onthemarket";
type ListingType = "sale" | "rent";

interface ExtractedProperty {
  provider:              Provider;
  external_property_id:  string;
  title:                 string | null;
  address:               string | null;
  price:                 number | null;
  currency_code:         string;
  bedrooms:              number | null;
  bathrooms:             number | null;
  size_sqm:              number | null;
  property_type:         string | null;
  listing_type:          ListingType;
  listing_url:           string | null;
  images:                string[];
  scraped_at:            string;
}

interface ParsedProperty extends ExtractedProperty {
  country_iso2:      string;
  property_type_raw: string | null;
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
  waitFor?:      string;
  baseUrl:       string;
  countryIso2:   string;
  searchTargets: SearchTarget[];
  extract:       (html: string, baseUrl: string, listingType: ListingType) => ExtractedProperty[];
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

function idFromUrl(url: string): string {
  return url.split("?")[0].replace(/\/$/, "").split("/").filter(Boolean).pop() ?? "";
}

function safeInt(n: number, max = 99): number | null {
  return isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
}

function normalisePropertyType(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim().replace(/_/g, " ");
  return PROPERTY_TYPE_MAP[key] ?? raw.trim();
}

function validateRecord(p: ExtractedProperty): boolean {
  return !(p.price === null && p.address === null);
}

async function sendSlackAlert(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
      signal:  AbortSignal.timeout(SLACK_TIMEOUT_MS),
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

  const proxyUrl = `${SCRAPEOPS_BASE}?${new URLSearchParams(params).toString()}`;

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
      console.warn(`[ScrapeOps] attempt ${attempt + 1}/${retries + 1} failed — retrying in ${delay}ms`);
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

// ─── 1. ZILLOW (US) ──────────────────────────────────────────────────────────

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

    const data       = JSON.parse(match[1]) as any;
    const sr         = data?.props?.pageProps?.searchPageState?.cat1?.searchResults;
    const listResults: unknown[] = sr?.listResults ?? sr?.mapResults ?? [];

    for (const item of listResults) {
      try {
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

        const zillowImg: string[] = [];
        if (r.imgSrc) zillowImg.push(String(r.imgSrc));
        if (Array.isArray(r.carouselPhotos)) {
          for (const ph of r.carouselPhotos.slice(0, 5)) {
            const u = ph?.url ?? ph?.src;
            if (u && !zillowImg.includes(u)) zillowImg.push(String(u));
          }
        }

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
          images:               zillowImg,
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

// ─── 2. RIGHTMOVE (UK) ───────────────────────────────────────────────────────

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

    const data = JSON.parse(match[1]) as any;
    const pp   = data?.props?.pageProps;
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

    for (const r of properties) {
      try {
        const id = r.id ? String(r.id) : null;
        if (!id) continue;

        const rawPath = (r.propertyUrl ?? `/properties/${id}`).split("#")[0];
        const fullUrl = rawPath.startsWith("http")
          ? rawPath
          : `https://www.rightmove.co.uk${rawPath}`;

        const rawPrice = r.price?.amount ?? r.price?.value ?? null;
        const price    = typeof rawPrice === "number" && rawPrice > 0
          ? Math.round(rawPrice * 100)
          : null;

        const address = r.displayAddress ?? null;
        const typeRaw = (r.propertySubType ?? r.propertyType ?? "").toLowerCase().trim();

        const rmImages: string[] = [];
        if (Array.isArray(r.propertyImages?.images)) {
          for (const im of r.propertyImages.images.slice(0, 5)) {
            const u = im?.srcUrl ?? im?.url ?? im?.src;
            if (u && !rmImages.includes(u)) rmImages.push(String(u));
          }
        }
        const rmFallback = r.propertyImages?.mainImageSrc ?? r.mainImage?.src ?? r.image?.src;
        if (!rmImages.length && rmFallback) rmImages.push(String(rmFallback));

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
          images:               rmImages,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[Rightmove] item parse error:", e);
      }
    }
  } catch (e) {
    console.error("[Rightmove] __NEXT_DATA__ parse error:", e);
  }

  // ── HTML Cheerio fallback ─────────────────────────────────────────────────
  if (results.length === 0) {
    const $    = load(html);
    const seen = new Set<string>();

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
        const cardImg   = card.find("img").first().attr("src") ?? "";
        const cardImages: string[] = cardImg && cardImg.startsWith("http") ? [cardImg] : [];

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
          images:               cardImages,
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[Rightmove] HTML fallback parse error:", e);
      }
    });
  }

  return results;
}

// ─── 3. ONTHEMARKET (UK) ─────────────────────────────────────────────────────

function extractOnTheMarket(
  html: string,
  _baseUrl: string,
  listingType: ListingType,
): ExtractedProperty[] {
  const results: ExtractedProperty[] = [];
  const now = new Date().toISOString();

  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (match?.[1]) {
      const data = JSON.parse(match[1]) as any;
      const pp   = data?.props?.pageProps;
      const redux = data?.props?.initialReduxState;

      // OTM search results live in initialReduxState.results.list — entries
      // use kebab-case keys ("details-url", "humanised-property-type", …).
      // Older pageProps shapes kept as fallback.
      const listings: any[] =
        redux?.results?.list ??
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
            // Real OTM listing ids are numeric — location/filter objects
            // (slugs like "glasgow-west-end") must never become properties.
            if (!/^\d+$/.test(id)) continue;

            const rawHref = r["details-url"] ?? r.detailUrl ?? r.propertyUrl ?? r.url ?? `/details/${id}/`;
            if (!/\/details\/\d+/.test(rawHref)) continue;
            const fullUrl = rawHref.startsWith("http")
              ? rawHref
              : `https://www.onthemarket.com${rawHref}`;

            const rawPrice = r.price?.value ?? r.pricing?.value ?? r.price ?? null;
            const price    = typeof rawPrice === "number" && rawPrice > 0
              ? Math.round(rawPrice * 100)
              : typeof rawPrice === "string"
                ? parsePrice(rawPrice)
                : null;

            const address = (typeof r.address === "string" ? r.address : r.displayAddress ?? r.address?.displayAddress) ?? null;
            const typeRaw = (r["humanised-property-type"] ?? r.propertyType ?? r.type ?? "").toLowerCase().trim();
            const sqm     = r.floorArea?.value != null ? Number(r.floorArea.value) : null;

            const otmImages: string[] = [];
            if (Array.isArray(r.images)) {
              for (const im of r.images.slice(0, 5)) {
                const u = typeof im === "string" ? im : (im?.src ?? im?.url ?? im?.["default"]);
                if (u && !otmImages.includes(u)) otmImages.push(String(u));
              }
            }
            const otmFallback = r.mainImage?.src ?? r.image?.src ?? r.thumbnail;
            if (!otmImages.length && otmFallback) otmImages.push(String(otmFallback));

            results.push({
              provider:             "onthemarket",
              external_property_id: id,
              title:                r["property-title"] ?? address,
              address,
              price,
              currency_code:        "GBP",
              bedrooms:             safeInt(r.bedrooms ?? NaN),
              bathrooms:            safeInt(r.bathrooms ?? NaN),
              size_sqm:             sqm && isFinite(sqm) ? sqm : null,
              property_type:        typeRaw || null,
              listing_type:         listingType,
              listing_url:          fullUrl,
              images:               otmImages,
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

  // ── Cheerio fallback ──────────────────────────────────────────────────────
  const $ = load(html);

  $(
    '[class*="property-card"], [class*="PropertyCard"], [class*="otm-PropertyCard"],' +
    '[data-testid*="property-result"], [data-testid*="PropertyCard"], [data-testid*="olt-PropertyCard"],' +
    'li[class*="result-"], li[class*="otm-item"], article[class*="property"]',
  ).each((_, el) => {
    try {
      const card   = $(el);
      const linkEl = card.find('a[href*="/details/"]').first();
      const href   = linkEl.attr("href") ?? "";
      if (!href) return;

      const fullUrl = href.startsWith("http") ? href : `https://www.onthemarket.com${href}`;
      const extId   = idFromUrl(href);
      if (!/^\d+$/.test(extId)) return; // listing ids are numeric — never location slugs

      const priceText  = card.find('[class*="price"], [class*="Price"]').first().text().trim();
      const address    = (
        card.find('[data-testid*="address"], [data-testid*="Address"]').first().text() ||
        card.find('[class*="address"], [class*="Address"], [class*="title"]').first().text()
      ).replace(/\s+/g, " ").trim();
      const typeRaw    = card.find('[class*="type"], [class*="property-type"]')
        .first().text().trim().toLowerCase();
      const cardImgSrc = card.find("img").first().attr("src") ?? "";
      const cardImgs: string[] = cardImgSrc && cardImgSrc.startsWith("http") ? [cardImgSrc] : [];

      results.push({
        provider:             "onthemarket",
        external_property_id: extId,
        title:                address || null,
        address:              address || null,
        price:                parsePrice(priceText),
        currency_code:        "GBP",
        bedrooms:             safeInt(parseInt(card.find('[class*="bed"], [class*="Bed"]').first().text().trim(), 10)),
        bathrooms:            safeInt(parseInt(card.find('[class*="bath"], [class*="Bath"]').first().text().trim(), 10)),
        size_sqm:             null,
        property_type:        typeRaw || null,
        listing_type:         listingType,
        listing_url:          fullUrl,
        images:               cardImgs,
        scraped_at:           now,
      });
    } catch (e) {
      console.error("[OnTheMarket] HTML card parse error:", e);
    }
  });

  if (results.length === 0) {
    const seen = new Set<string>();
    $('a[href*="/details/"]').each((_, el) => {
      try {
        const href  = $(el).attr("href") ?? "";
        const extId = idFromUrl(href);
        if (!/^\d+$/.test(extId) || seen.has(extId)) return;
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
          images:               [],
          scraped_at:           now,
        });
      } catch (e) {
        console.error("[OnTheMarket] link fallback parse error:", e);
      }
    });
  }

  return results;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROVIDER REGISTRY
───────────────────────────────────────────────────────────────────────────── */

/* Target generators — batches of BATCH_SIZE slice these lists in order, so
   "fresh" page-1 targets sit first (re-scraped daily by cron; see vercel.json)
   and deep pagination sits at higher batch indices (one-shot backfill). */

const ZILLOW_SALE_CITIES = [
  "New-York-NY", "Los-Angeles-CA", "Chicago-IL", "Houston-TX", "Phoenix-AZ",
  "Philadelphia-PA", "San-Antonio-TX", "San-Diego-CA", "Dallas-TX", "San-Francisco-CA",
  "Austin-TX", "Jacksonville-FL", "Columbus-OH", "Charlotte-NC", "Indianapolis-IN",
  "Seattle-WA", "Denver-CO", "Nashville-TN", "Oklahoma-City-OK", "Atlanta-GA",
  "Baltimore-MD", "Miami-FL", "Louisville-KY", "Portland-OR", "Milwaukee-WI",
  "Las-Vegas-NV", "Albuquerque-NM", "Minneapolis-MN", "Boston-MA", "Detroit-MI",
];
const ZILLOW_RENT_CITIES = [
  "New-York-NY", "Los-Angeles-CA", "Chicago-IL", "Houston-TX", "Miami-FL",
  "San-Francisco-CA", "Seattle-WA", "Boston-MA", "Denver-CO", "Atlanta-GA",
];
const zillowTarget = (city: string, type: ListingType, page: number): SearchTarget => ({
  url: `https://www.zillow.com/homes/${type === "sale" ? "for_sale" : "for_rent"}/${city}_rb/${page > 1 ? `${page}_p/` : ""}`,
  listingType: type,
});

// REGION codes harvested from rightmove.co.uk/property-for-sale/<City>.html
const RM_LONDON = "87490";
const RM_CITY_CODES = [
  "904",  // Manchester
  "162",  // Birmingham
  "787",  // Leeds
  "550",  // Glasgow
  "1195", // Sheffield
  "475",  // Edinburgh
  "813",  // Liverpool
  "219",  // Bristol
  "789",  // Leicester
  "281",  // Cardiff
  "1019", // Nottingham
  "1036", // Oxford
  "274",  // Cambridge
];
const rightmoveTarget = (type: ListingType, index: number, region: string = RM_LONDON): SearchTarget => ({
  url: `https://www.rightmove.co.uk/property-${type === "sale" ? "for-sale" : "to-rent"}/find.html?locationIdentifier=REGION%5E${region}&sortType=6&numberOfPropertiesPerPage=24&index=${index}`,
  listingType: type,
});

const OTM_CITIES = [
  "london", "birmingham", "leeds", "glasgow", "sheffield", "manchester",
  "edinburgh", "liverpool", "bristol", "leicester", "cardiff", "nottingham",
  "oxford", "cambridge",
];
const otmTarget = (city: string, type: ListingType, page: number): SearchTarget => ({
  url: `https://www.onthemarket.com/${type === "sale" ? "for-sale" : "to-rent"}/property/${city}/${page > 1 ? `?page=${page}` : ""}`,
  listingType: type,
});

const PROVIDERS: Record<Provider, ProviderConfig> = {

  zillow: {
    name:          "zillow",
    currency:      "USD",
    proxyCountry:  "us",
    europeanPrice: false,
    renderJs:      true,
    baseUrl:       "https://www.zillow.com",
    countryIso2:   "US",
    searchTargets: [
      // Page 1 per city — fresh (cron batches 0-7, daily)
      ...ZILLOW_SALE_CITIES.map((c) => zillowTarget(c, "sale", 1)),
      ...ZILLOW_RENT_CITIES.map((c) => zillowTarget(c, "rent", 1)),
      // Deep pages — backfill coverage (batches 8+)
      ...ZILLOW_SALE_CITIES.map((c) => zillowTarget(c, "sale", 2)),
      ...ZILLOW_RENT_CITIES.map((c) => zillowTarget(c, "rent", 2)),
      ...ZILLOW_SALE_CITIES.slice(0, 20).map((c) => zillowTarget(c, "sale", 3)),
    ],
    extract: extractZillow,
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
      // Fresh pages (cron batches 0-1, daily)
      rightmoveTarget("sale", 0), rightmoveTarget("rent", 0),
      rightmoveTarget("sale", 24), rightmoveTarget("rent", 24),
      rightmoveTarget("sale", 48),
      // Deep London pagination — backfill coverage (sale to idx 744, rent to 360)
      ...Array.from({ length: 29 }, (_, i) => rightmoveTarget("sale", (i + 3) * 24)),
      ...Array.from({ length: 14 }, (_, i) => rightmoveTarget("rent", (i + 2) * 24)),
      // 13 regional city markets — page 1s first (cron batches 9-14, daily)
      ...RM_CITY_CODES.flatMap((code) => [
        rightmoveTarget("sale", 0, code),
        rightmoveTarget("rent", 0, code),
      ]),
      // City deep pagination — backfill coverage (sale pages 2-6, rent 2-3)
      ...RM_CITY_CODES.flatMap((code) =>
        Array.from({ length: 5 }, (_, i) => rightmoveTarget("sale", (i + 1) * 24, code))),
      ...RM_CITY_CODES.flatMap((code) =>
        Array.from({ length: 2 }, (_, i) => rightmoveTarget("rent", (i + 1) * 24, code))),
    ],
    extract: extractRightmove,
  },

  onthemarket: {
    name:          "onthemarket",
    currency:      "GBP",
    proxyCountry:  "gb",
    europeanPrice: false,
    // Raw HTML carries __NEXT_DATA__ with full results; render_js not only
    // wastes 10x credits here, it broke ?page=N pagination (rendered SPA
    // reset to page 1, so all deep pages returned page-1 content).
    renderJs:      false,
    baseUrl:       "https://www.onthemarket.com",
    countryIso2:   "GB",
    searchTargets: [
      // Page 1 per market — fresh (cron batches 0-5, daily)
      ...OTM_CITIES.map((c) => otmTarget(c, "sale", 1)),
      ...OTM_CITIES.map((c) => otmTarget(c, "rent", 1)),
      // Deep pages — backfill coverage
      ...OTM_CITIES.map((c) => otmTarget(c, "sale", 2)),
      ...OTM_CITIES.map((c) => otmTarget(c, "rent", 2)),
      ...OTM_CITIES.map((c) => otmTarget(c, "sale", 3)),
    ],
    extract: extractOnTheMarket,
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE UPSERT
───────────────────────────────────────────────────────────────────────────── */

type SupabaseClient = any;

async function upsertProperties(
  rows:     ParsedProperty[],
  supabase: SupabaseClient,
): Promise<number> {
  if (!rows.length) return 0;
  let total = 0;

  // List pages only expose thumbnails; the full gallery comes from the
  // detail-page pass in /api/cron/enrich-agents. Never let this upsert
  // shrink a stored gallery: rows whose existing image set is at least as
  // large as the newly scraped one keep their stored images (column omitted).
  const stamp = new Date().toISOString();
  const existingCounts = new Map<string, number>();
  const ids = rows.map((r) => r.external_property_id);
  for (let i = 0; i < ids.length; i += SUPABASE_BATCH_SIZE) {
    const { data: existing } = await supabase
      .from("properties")
      .select("external_property_id, images")
      .eq("provider", rows[0].provider)
      .in("external_property_id", ids.slice(i, i + SUPABASE_BATCH_SIZE));
    for (const e of existing ?? []) {
      existingCounts.set(e.external_property_id, Array.isArray(e.images) ? e.images.length : 0);
    }
  }

  const keepsStored = (r: ParsedProperty) =>
    (existingCounts.get(r.external_property_id) ?? 0) >= r.images.length;

  const withImages    = rows.filter((r) => r.images.length > 0 && !keepsStored(r)).map((r) => ({ ...r, updated_at: stamp }));
  const withoutImages = rows.filter((r) => r.images.length === 0 || keepsStored(r)).map(({ images: _images, ...r }) => ({ ...r, updated_at: stamp }));

  for (const group of [withImages, withoutImages]) {
    for (let i = 0; i < group.length; i += SUPABASE_BATCH_SIZE) {
      const batch = group.slice(i, i + SUPABASE_BATCH_SIZE);

      const { data, error } = await supabase
        .from("properties")
        .upsert(batch as any, {
          onConflict:       "provider,external_property_id",
          ignoreDuplicates: false,
        })
        .select("id");

      if (error) throw new Error(`Supabase upsert failed (batch ${i}): ${error.message}`);
      total += data?.length ?? 0;
    }
  }

  return total;
}

async function upsertScraperRun(
  report:    ScrapeReport,
  startedAt: string,
  supabase:  SupabaseClient,
): Promise<void> {
  try {
    const exitStatus: "success" | "partial" | "failure" =
      report.errors.length === 0 ? "success"
      : report.upsertedCount > 0  ? "partial"
      :                             "failure";

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
  targets:  SearchTarget[],
): Promise<ScrapeReport> {
  const t0          = Date.now();
  const startedAt   = new Date().toISOString();
  const errors:     string[]         = [];
  const allParsed:  ParsedProperty[] = [];
  let   failedCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];

    // Deadline guard — leave headroom for the upsert + audit write.
    if (Date.now() - t0 > SOFT_DEADLINE_MS) {
      const skipped = targets.length - i;
      errors.push(`Soft deadline reached — skipped ${skipped} remaining URL(s)`);
      console.warn(`[${config.name}] ⏱ soft deadline hit, skipping ${skipped} URLs`);
      break;
    }

    try {
      console.log(`[${config.name}] ↗ ScrapeOps → ${target.url}`);

      const html      = await fetchViaScrapeOps(target.url, config.proxyCountry, config.renderJs, FETCH_RETRIES, config.waitFor);
      const extracted = config.extract(html, config.baseUrl, target.listingType);

      const raw = extracted.map((p) => ({
        ...p,
        country_iso2:      config.countryIso2,
        property_type_raw: p.property_type,
        property_type:     normalisePropertyType(p.property_type),
      }));

      const valid    = raw.filter(validateRecord);
      const rejected = raw.length - valid.length;
      if (rejected > 0) {
        console.warn(`[${config.name}] ⚠ dropped ${rejected} records with no price AND no address`);
        failedCount += rejected;
      }

      console.log(`[${config.name}] ✓ ${valid.length} valid listings (${target.listingType})`);

      if (valid.length < MIN_RECORDS_PER_URL) {
        // Record it; ONE summary Slack alert is sent at the end of the run
        // instead of one per URL (each alert costs wall-clock time).
        console.warn(`[${config.name}] ⚠ low record count for ${target.url}: ${valid.length}`);
        errors.push(`Low record count for ${target.url}: ${valid.length} < ${MIN_RECORDS_PER_URL}`);
      }

      allParsed.push(...valid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${target.url}: ${msg}`);
      console.error(`[${config.name}] ✗ scrape failed for ${target.url}:`, msg);
    }

    if (i < targets.length - 1) await sleep(INTER_URL_DELAY_MS);
  }

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

  await upsertScraperRun(report, startedAt, supabase);
  return report;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROUTE HANDLER
───────────────────────────────────────────────────────────────────────────── */

export async function GET(request: Request): Promise<Response> {

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missing = (
    ["SCRAPEOPS_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const
  ).filter((k) => !process.env[k]);

  if (missing.length > 0) {
    return NextResponse.json({ error: "Missing env vars", missing }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const raw              = searchParams.get("provider")?.toLowerCase().trim();
  const providerParam    = raw as Provider | undefined;

  if (!providerParam || !(providerParam in PROVIDERS)) {
    return NextResponse.json(
      { error: "Missing or invalid ?provider=", validProviders: Object.keys(PROVIDERS) },
      { status: 400 },
    );
  }

  // ── Batch slicing ─────────────────────────────────────────────────────────
  const allTargets   = PROVIDERS[providerParam].searchTargets;
  const totalBatches = Math.ceil(allTargets.length / BATCH_SIZE);
  const batchRaw     = searchParams.get("batch");
  const batch        = batchRaw === null ? 0 : Number.parseInt(batchRaw, 10);

  if (!Number.isInteger(batch) || batch < 0 || batch >= totalBatches) {
    return NextResponse.json(
      { error: `Invalid ?batch= (provider "${providerParam}" has batches 0–${totalBatches - 1})` },
      { status: 400 },
    );
  }

  const targets = allTargets.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE);

  // Debug mode — return raw HTML info for selector inspection
  const debug = searchParams.get("debug") === "1";
  if (debug) {
    const cfg    = PROVIDERS[providerParam];
    const target = cfg.searchTargets[0];
    try {
      const html = await fetchViaScrapeOps(target.url, cfg.proxyCountry, cfg.renderJs);
      const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      let nextDataPreview: unknown = null;
      if (ndMatch?.[1]) {
        try {
          const parsed    = JSON.parse(ndMatch[1]) as any;
          const pp        = parsed?.props?.pageProps;
          nextDataPreview = { found: true, pagePropKeys: pp ? Object.keys(pp) : [] };
        } catch {
          nextDataPreview = { found: true, parseError: true };
        }
      } else {
        nextDataPreview = { found: false };
      }
      return NextResponse.json({ debug: true, provider: providerParam, htmlLength: html.length, nextData: nextDataPreview });
    } catch (err) {
      return NextResponse.json({ debug: true, error: (err as Error).message }, { status: 500 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  console.log(`[cron/scrape-listings] ▶ provider=${providerParam} batch=${batch}/${totalBatches - 1} (${targets.length} URLs)`);

  try {
    const report = await scrapeProvider(PROVIDERS[providerParam], supabase, targets);

    if (report.upsertedCount === 0 && report.errors.length > 0) {
      await sendSlackAlert(
        `🚨 *Prime Atlas* — \`${providerParam}\` batch ${batch} total failure. 0 records upserted.\n\`\`\`${report.errors.slice(0, 3).join("\n")}\`\`\``,
      );
    } else if (report.errors.length > 0) {
      await sendSlackAlert(
        `⚠️ *Prime Atlas* — \`${providerParam}\` batch ${batch} partial: ${report.upsertedCount} upserted, ${report.errors.length} issue(s).\n\`\`\`${report.errors.slice(0, 3).join("\n")}\`\`\``,
      );
    }

    const status = report.errors.length === 0 ? 200 : report.upsertedCount > 0 ? 207 : 500;

    return NextResponse.json(
      { ok: status < 500, report, meta: { provider: providerParam, batch, totalBatches, executedAt: new Date().toISOString() } },
      { status },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[cron/scrape-listings] Fatal error:", err);
    await sendSlackAlert(`🚨 *Prime Atlas* — \`${providerParam}\` batch ${batch} crashed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
