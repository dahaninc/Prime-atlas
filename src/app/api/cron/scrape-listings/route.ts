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
 *    GET /api/cron/scrape-listings?provider=zillow
 *    Authorization: Bearer <CRON_SECRET>
 *
 *  Schedule (vercel.json):
 *    { "path": "/api/cron/scrape-listings?provider=zillow",      "schedule": "0 3 * * *" }
 *    { "path": "/api/cron/scrape-listings?provider=rightmove",   "schedule": "0 7 * * *" }
 *    { "path": "/api/cron/scrape-listings?provider=onthemarket", "schedule": "0 8 * * *" }
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
const REQUEST_TIMEOUT_MS  = 90_000;
const RETRY_BASE_DELAY_MS = 2_000;
const INTER_URL_DELAY_MS  = 2_500;
const SUPABASE_BATCH_SIZE = 100;
const MIN_RECORDS_PER_URL = 3;

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

        const zillowImg: string[] = [];
        if (r.imgSrc) zillowImg.push(String(r.imgSrc));

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = JSON.parse(match[1]) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pp   = data?.props?.pageProps;
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

        const rmImgSrc: string =
          r.propertyImages?.images?.[0]?.srcUrl ??
          r.propertyImages?.mainImageSrc ??
          r.mainImage?.src ??
          r.image?.src ??
          "";
        const rmImages: string[] = rmImgSrc ? [rmImgSrc] : [];

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = JSON.parse(match[1]) as any;
      const pp   = data?.props?.pageProps;

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

            const otmImgSrc: string =
              r.mainImage?.src ??
              r.images?.[0]?.src ??
              r.image?.src ??
              r.thumbnail ??
              "";
            const otmImages: string[] = otmImgSrc ? [otmImgSrc] : [];

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
      const linkEl = card.find('a[href*="/property/"]').first();
      const href   = linkEl.attr("href") ?? "";
      if (!href) return;

      const fullUrl = href.startsWith("http") ? href : `https://www.onthemarket.com${href}`;
      const extId   = idFromUrl(href);
      if (!extId) return;

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
      { url: "https://www.onthemarket.com/for-sale/property/london/",  listingType: "sale" },
      { url: "https://www.onthemarket.com/to-rent/property/london/",   listingType: "rent" },
    ],
    extract: extractOnTheMarket,
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE UPSERT
───────────────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

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

    if (error) throw new Error(`Supabase upsert failed (batch ${i}): ${error.message}`);
    total += data?.length ?? 0;
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
  const errors:     string[]         = [];
  const allParsed:  ParsedProperty[] = [];
  let   failedCount = 0;

  for (let i = 0; i < config.searchTargets.length; i++) {
    const target = config.searchTargets[i];

    try {
      console.log(`[${config.name}] ↗ ScrapeOps → ${target.url}`);

      const html      = await fetchViaScrapeOps(target.url, config.proxyCountry, config.renderJs, 0, config.waitFor);
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
        const alertMsg = `⚠️ *Prime Atlas* — \`${config.name}\` returned only ${valid.length} records for ${target.url}`;
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

    if (i < config.searchTargets.length - 1) await sleep(INTER_URL_DELAY_MS);
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  console.log(`[cron/scrape-listings] ▶ provider=${providerParam}`);

  try {
    const report = await scrapeProvider(PROVIDERS[providerParam], supabase);

    if (report.upsertedCount === 0 && report.errors.length > 0) {
      await sendSlackAlert(
        `🚨 *Prime Atlas* — \`${providerParam}\` total failure. 0 records upserted.\n\`\`\`${report.errors.slice(0, 3).join("\n")}\`\`\``,
      );
    }

    const status = report.errors.length === 0 ? 200 : report.upsertedCount > 0 ? 207 : 500;

    return NextResponse.json(
      { ok: status < 500, report, meta: { provider: providerParam, executedAt: new Date().toISOString() } },
      { status },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[cron/scrape-listings] Fatal error:", err);
    await sendSlackAlert(`🚨 *Prime Atlas* — \`${providerParam}\` crashed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
