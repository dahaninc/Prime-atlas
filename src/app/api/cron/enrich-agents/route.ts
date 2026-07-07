/**
 * GET /api/cron/enrich-agents
 *
 * Second-pass scraper: finds properties that have a listing_url but no agent_name,
 * fetches each detail page via ScrapeOps, extracts agent contact info, updates DB.
 *
 * Runs max 40 properties per invocation (rate-limited).
 * Schedule: every 3 days (vercel.json) — agent enrichment is a nice-to-have
 * backfill on top of already-scraped listings, not part of the freshness
 * claim, so it doesn't need the daily cadence scrape-listings has.
 *
 * Auth: Bearer CRON_SECRET
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient }                   from "@supabase/supabase-js";
import { load }                           from "cheerio";

export const maxDuration = 300;
export const dynamic     = "force-dynamic";

const SCRAPEOPS_BASE     = "https://proxy.scrapeops.io/v1/";
const BATCH_SIZE         = 40;
const DELAY_MS           = 2500;
const TIMEOUT_MS         = 20_000;
// Stop starting new fetches past this point so the function returns its
// summary before Vercel kills it at maxDuration (300s). Worst case per row
// is one 20s fetch + 2.5s delay, so 240s + 22.5s stays inside the window.
const SOFT_DEADLINE_MS   = 240_000;

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url: string, country: string, marker?: string): Promise<string | null> {
  const apiKey = process.env.SCRAPEOPS_API_KEY;
  if (!apiKey) return null;

  // Cheap plain fetch first; when the target blocks it (Zillow especially),
  // retry once with JS rendering + residential IP — costs more ScrapeOps
  // credits but reliably gets through.
  // `marker` guards against bot-challenge pages: they can be >2000 bytes and
  // HTTP 200 but lack the data blob — without the check they'd be accepted
  // from the cheap attempt and the rendered fallback would never fire.
  const attempts = [
    `${SCRAPEOPS_BASE}?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false`,
    `${SCRAPEOPS_BASE}?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&residential=true&country=${country}`,
  ];

  for (const proxyUrl of attempts) {
    try {
      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "Accept": "text/html" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (html.length > 2000 && (!marker || html.includes(marker))) return html;
    } catch {
      // fall through to the rendered attempt / give up
    }
  }
  return null;
}

/* ── Per-provider agent selectors ───────────────────────────────────────── */

interface AgentInfo {
  agent_name:    string | null;
  agent_company: string | null;
  agent_phone:   string | null;
  agent_email:   string | null;
  images:        string[];
}

function parseRightmoveDetail(html: string): AgentInfo {
  const info: AgentInfo = { agent_name: null, agent_company: null, agent_phone: null, agent_email: null, images: [] };

  try {
    // Rightmove embeds detail data in window.PAGE_MODEL (not __NEXT_DATA__)
    const pmMatch = html.match(/window\.PAGE_MODEL\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
    const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    const raw = pmMatch?.[1] ?? nextMatch?.[1];
    if (raw) {
      const data = JSON.parse(raw) as any;
      const pd   = data?.propertyData ??
                   data?.props?.pageProps?.propertyData ?? data?.props?.pageProps?.property;

      if (pd) {
        info.agent_company = pd.customer?.branchDisplayName ??
                             pd.customerAvmDetails?.branchDisplayName ??
                             pd.customer?.companyName ??
                             pd.contactInfo?.agencyName ?? null;
        info.agent_phone   = pd.contactInfo?.telephoneNumbers?.localNumber ??
                             pd.contactInfo?.telephoneNumbers?.internationalNumber ?? null;
        // Images — full gallery, canonical (non-resized) URLs
        const imgs: string[] = pd.images?.map((i: { url?: string; src?: string }) => i.url ?? i.src).filter(Boolean) ?? [];
        if (imgs.length) info.images = imgs;
      }
    }
  } catch { /* fall through */ }

  // Cheerio fallback
  const $ = load(html);
  if (!info.agent_company) {
    info.agent_company =
      $('[class*="agent-details"] [class*="brand-name"], [class*="agentName"], .agent-name').first().text().trim() || null;
  }
  if (!info.agent_phone) {
    info.agent_phone =
      $('[class*="contactTelephone"], [class*="agent-phone"], [class*="phone-number"]').first().text().trim().replace(/\s+/g, " ") || null;
  }
  if (!info.images.length) {
    $('img[src*="media.rightmove"], img[src*="rightmove"]').each((_, el) => {
      const src = $(el).attr("src");
      if (src && !info.images.includes(src)) info.images.push(src);
    });
  }

  return info;
}

function parseOnTheMarketDetail(html: string): AgentInfo {
  const info: AgentInfo = { agent_name: null, agent_company: null, agent_phone: null, agent_email: null, images: [] };

  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (match?.[1]) {
      const data = JSON.parse(match[1]) as any;
      // OTM detail data lives in initialReduxState.property (camelCase);
      // legacy pageProps shapes kept as fallback.
      const pd   = data?.props?.initialReduxState?.property ??
                   data?.props?.pageProps?.propertyDetails ?? data?.props?.pageProps?.listing ?? data?.props?.pageProps?.property;

      if (pd) {
        const agent = pd.agent ?? pd.branch ?? pd.contact;
        if (agent) {
          info.agent_name    = agent.name ?? agent.contactName ?? null;
          info.agent_company = agent.branchName ?? agent.companyName ?? agent.company ?? agent.name ?? null;
          info.agent_phone   = agent.telephone ?? agent.phone ?? null;
          info.agent_email   = agent.email ?? null;
        }
        const imgs: string[] = (pd.images ?? pd.photos ?? [])
          .map((i: { largeUrl?: string; src?: string; url?: string; default?: string }) =>
            i.largeUrl ?? i.src ?? i.url ?? i.default)
          .filter(Boolean);
        if (imgs.length) info.images = imgs;
      }
    }
  } catch { /* fall through */ }

  const $ = load(html);
  if (!info.agent_company) {
    info.agent_company = $('.agent-details__name, [class*="branchName"], [class*="AgencyName"]').first().text().trim() || null;
  }
  if (!info.agent_phone) {
    info.agent_phone = $('.phone-number, [class*="phoneNumber"], [data-testid*="phone"]').first().text().trim() || null;
  }

  return info;
}

function parseZillowDetail(html: string): AgentInfo {
  const info: AgentInfo = { agent_name: null, agent_company: null, agent_phone: null, agent_email: null, images: [] };

  try {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (match?.[1]) {
      const data = JSON.parse(match[1]) as any;
      // Zillow buries agent data deep in gdpClientCache
      const cache = data?.props?.pageProps?.componentProps?.gdpClientCache;
      if (cache) {
        const cacheStr = typeof cache === "string" ? cache : JSON.stringify(cache);
        const agentMatch = cacheStr.match(/"agentName"\s*:\s*"([^"]+)"/);
        const phoneMatch  = cacheStr.match(/"phone"\s*:\s*"([^"]+)"/);
        const brokerMatch = cacheStr.match(/"brokerName"\s*:\s*"([^"]+)"/);
        if (agentMatch) info.agent_name    = agentMatch[1];
        if (phoneMatch)  info.agent_phone   = phoneMatch[1];
        if (brokerMatch) info.agent_company = brokerMatch[1];
      }
      // Images — capture the FULL gallery. The cache holds many size variants
      // per photo, so dedupe on the photo hash (path before the size suffix).
      // NOTE: gdpClientCache is usually a JSON *string*, not an object.
      const photos = data?.props?.pageProps?.componentProps?.gdpClientCache ?? data?.props?.pageProps?.gdpClientCache;
      if (photos) {
        const photoStr = typeof photos === "string" ? photos : JSON.stringify(photos);
        const photoMatch = photoStr.match(/"url"\s*:\s*"(https:\\?\/\\?\/photos\.zillowstatic[^"]+)"/g) ?? [];
        // The /fp/<hex> hash uniquely identifies a photo across all of
        // Zillow's ~24 size-variant suffixes — key the dedupe on it, not on
        // suffix patterns. Prefer jpg over webp, then the largest size.
        const photoScore = (u: string): number => {
          const suffix = u.match(/-([a-z0-9_]+)\.(jpg|webp|png)$/i)?.[1] ?? "";
          const size = Number(suffix.match(/\d{3,4}/)?.[0] ?? 0);
          return (u.toLowerCase().endsWith(".jpg") ? 10000 : 0) + size;
        };
        const byBase = new Map<string, string>();
        for (const m of photoMatch) {
          const url  = m.replace(/^"url"\s*:\s*"/, "").replace(/"$/, "").replace(/\\\//g, "/");
          const base = url.match(/\/fp\/([0-9a-f]+)/i)?.[1]
            ?? url.replace(/(-cc_ft_\d+|-p_[a-z])?\.(jpg|webp|png)$/i, "");
          const prev = byBase.get(base);
          if (!prev || photoScore(url) > photoScore(prev)) byBase.set(base, url);
        }
        info.images = Array.from(byBase.values());
      }
    }
  } catch { /* fall through */ }

  // Cheerio
  const $ = load(html);
  if (!info.agent_name) {
    info.agent_name = $('[data-testid="agent-name"], [class*="AgentName"]').first().text().trim() || null;
  }
  if (!info.agent_phone) {
    info.agent_phone = $('[data-testid="agent-phone"], [class*="AgentPhone"]').first().text().trim() || null;
  }

  return info;
}

/* ── Main handler ───────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth   = req.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminSupabase();

  // Optional ?provider= scope — lets a backfill drive one provider without
  // being starved by another provider's blocked rows at the queue head.
  const providerFilter = req.nextUrl.searchParams.get("provider");

  // Fetch properties needing enrichment: missing agent info OR photos.
  // Ordered by updated_at ASC and always touched on processing, so the cron
  // cycles through the whole backlog over successive runs instead of
  // re-fetching the same rows forever.
  let query = supabase
    .from("properties")
    .select("id, provider, listing_url")
    .or("gallery_synced_at.is.null,agent_name.is.null")
    .not("listing_url", "is", null)
    .eq("status", "active");
  if (providerFilter) query = query.eq("provider", providerFilter);
  // Galleries are the product-critical asset: rows that have never synced a
  // gallery ALWAYS outrank rows that only lack agent info — otherwise
  // agent-less-but-synced rows (UK sources rarely expose agent names)
  // rotate forever at the head and starve the unsynced backlog.
  const { data: rows, error } = await query
    .order("gallery_synced_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ ok: true, enriched: 0, message: "Nothing to enrich" });

  let enriched  = 0;
  let galleries = 0;
  let agents    = 0;
  let empty     = 0;
  let skipped   = 0;
  const errors: string[] = [];
  const t0 = Date.now();

  for (const row of rows as { id: string; provider: string; listing_url: string }[]) {
    if (Date.now() - t0 > SOFT_DEADLINE_MS) {
      skipped = rows.length - enriched - errors.length;
      console.warn(`[enrich-agents] soft deadline hit — ${skipped} rows left for next run`);
      break;
    }
    try {
      const country = row.provider === "zillow" ? "us" : "gb";
      const marker  = row.provider === "zillow"    ? "gdpClientCache"
                    : row.provider === "rightmove" ? "PAGE_MODEL"
                    :                                "__NEXT_DATA__";
      const html = await fetchPage(row.listing_url, country, marker);
      if (!html) {
        errors.push(`${row.id}: fetch failed`);
        // Send permanently-blocked rows to the back of the queue so they
        // don't head-of-line block the every-3-days backfill.
        await supabase.from("properties")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      let info: AgentInfo;
      if (row.provider === "rightmove")   info = parseRightmoveDetail(html);
      else if (row.provider === "onthemarket") info = parseOnTheMarketDetail(html);
      else info = parseZillowDetail(html);

      // Build update payload — only set fields we got.
      // gallery_synced_at is set ONLY when photos were actually extracted;
      // parse misses keep the row in the queue (updated_at bump sends it to
      // the back) so a future run with better parsing picks it up again.
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (info.images.length > 0) update.gallery_synced_at = new Date().toISOString();
      if (info.agent_name)    update.agent_name    = info.agent_name;
      if (info.agent_company) update.agent_company = info.agent_company;
      if (info.agent_phone)   update.agent_phone   = info.agent_phone;
      if (info.agent_email)   update.agent_email   = info.agent_email;
      // Full gallery from the detail page — uncapped (100% of source photos)
      if (info.images.length > 0) update.images = info.images;

      await supabase.from("properties").update(update).eq("id", row.id);
      const gotData = info.images.length > 0 || info.agent_name || info.agent_company || info.agent_phone;
      if (info.images.length > 0) galleries++;
      if (info.agent_name || info.agent_company) agents++;
      if (gotData) enriched++; else empty++;
    } catch (err) {
      errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    await sleep(DELAY_MS);
  }

  return NextResponse.json({
    ok: true,
    enriched,
    galleries_synced: galleries,
    agents_found: agents,
    parse_empty: empty,
    skipped,
    attempted: rows.length,
    errors: errors.slice(0, 10),
  });
}
