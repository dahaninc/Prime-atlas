"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────────── */

type Category =
  | "All"
  | "Data Sources"
  | "AI Tools"
  | "Analytics"
  | "Alerts"
  | "Infrastructure"
  | "Exports";

type SortKey = "popular" | "newest" | "rating" | "alpha";

type Market = "All" | "US" | "UK" | "ES" | "AU" | "CA" | "Global";

type Tier = "free" | "explorer" | "professional" | "institutional";

interface AppChangelog {
  version: string;
  date: string;
  notes: string;
}

interface AppMetrics {
  uptime: number;       // 0–100
  coverage: number;     // 0–100
  latency: string;      // display string
}

interface MarketplaceApp {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: Category;
  markets: Market[];
  description: string;
  longDescription: string;
  rating: number;
  ratingCount: number;
  installs: number;
  version: string;
  tags: string[];
  featured: boolean;
  price: string;
  requiredTier: Tier;
  metrics: AppMetrics;
  steps: string[];
  changelog: AppChangelog[];
  icon: string; // emoji or letter
  iconBg: string; // tailwind bg class fragment for hex
  new?: boolean;
}

/* ─── App catalogue ──────────────────────────────────────────────── */

const APPS: MarketplaceApp[] = [
  {
    id: "zillow-feed",
    slug: "zillow-feed",
    name: "Zillow Market Feed",
    tagline: "30 US cities · live scraped · daily refresh",
    category: "Data Sources",
    markets: ["US"],
    description:
      "Automated daily scrape of Zillow residential listings across 30 major US metro areas. Powers the Market Feed explorer with sale and rental data.",
    longDescription:
      "The Zillow Market Feed integration connects Prime Atlas directly to Zillow's residential listing database via ScrapeOps-managed proxies. Each morning at 03:00 UTC, the scraper cycles through 30 metro areas — capturing address, price, bed/bath count, sqm, listing type, and URL — then upserts clean rows into your Supabase properties table. The Market Feed Explorer reads live from this table with zero cold-start delay.",
    rating: 4.8,
    ratingCount: 1240,
    installs: 8432,
    version: "2.1.0",
    tags: ["Listings", "Residential", "Scraper", "Daily"],
    featured: true,
    price: "Included",
    requiredTier: "free",
    metrics: { uptime: 99.2, coverage: 92, latency: "< 2s" },
    steps: [
      "Integration is active by default — no configuration required.",
      "Visit Market Feed → select your city filters.",
      "Listings refresh automatically at 03:00 UTC every day.",
      "Upgrade to Pro to unlock cross-market comparison.",
    ],
    changelog: [
      { version: "2.1.0", date: "Jun 2026", notes: "Added Phoenix, Nashville, Raleigh" },
      { version: "2.0.0", date: "Apr 2026", notes: "Rebuilt scraper with ScrapeOps v3" },
      { version: "1.4.2", date: "Feb 2026", notes: "Bug fix: duplicate dedup on price updates" },
    ],
    icon: "Z",
    iconBg: "#006AFF",
  },
  {
    id: "land-registry",
    slug: "land-registry",
    name: "UK Land Registry",
    tagline: "Live title & price paid · England & Wales",
    category: "Data Sources",
    markets: ["UK"],
    description:
      "Real-time price-paid lookups from HM Land Registry for any UK postcode. Powers comparables panels on listing detail pages.",
    longDescription:
      "The Land Registry integration queries the HM Land Registry Price Paid API on demand for any UK postcode you view. It returns the 10 most recent comparable transactions — address, price, date, property type, and tenure — displayed directly in the comparables panel. No scraping, no delay: data is sourced directly from the UK government's authoritative dataset, updated daily.",
    rating: 4.9,
    ratingCount: 874,
    installs: 5210,
    version: "1.3.0",
    tags: ["Comparables", "UK", "Official", "Title"],
    featured: true,
    price: "Included",
    requiredTier: "free",
    metrics: { uptime: 99.8, coverage: 100, latency: "< 800ms" },
    steps: [
      "Active automatically on all UK listing detail pages.",
      "Open any listing → scroll to Comparables panel.",
      "Enter a postcode to pull the 10 most recent transactions.",
      "Data sourced live from HM Land Registry — no caching.",
    ],
    changelog: [
      { version: "1.3.0", date: "May 2026", notes: "Tenure type filter (freehold/leasehold)" },
      { version: "1.2.0", date: "Mar 2026", notes: "Added property type breakdown chart" },
    ],
    icon: "🏛",
    iconBg: "#1D2D50",
  },
  {
    id: "rightmove-tracker",
    slug: "rightmove-tracker",
    name: "Rightmove Tracker",
    tagline: "UK residential · price history · days on market",
    category: "Data Sources",
    markets: ["UK"],
    description:
      "Tracks Rightmove listing price changes and days-on-market for UK residential properties. Surfaces stale inventory and vendor urgency signals.",
    longDescription:
      "Rightmove Tracker ingests a daily snapshot of UK residential listings and calculates price reduction velocity, days on market, and re-list frequency. These signals feed directly into the Signals feed as 'vendor urgency' and 'price momentum' events. Pro tier unlocks raw data export.",
    rating: 4.5,
    ratingCount: 432,
    installs: 2890,
    version: "1.1.0",
    tags: ["UK", "Price History", "Signals", "Residential"],
    featured: false,
    price: "Pro",
    requiredTier: "explorer",
    metrics: { uptime: 97.4, coverage: 85, latency: "< 4s" },
    steps: [
      "Upgrade to Pro to enable Rightmove Tracker.",
      "Connect under Settings → Integrations → Rightmove.",
      "Select regions and property types to monitor.",
      "Signals appear in your feed within 24 hours.",
    ],
    changelog: [
      { version: "1.1.0", date: "May 2026", notes: "Re-list detection algorithm v2" },
      { version: "1.0.0", date: "Jan 2026", notes: "Initial release" },
    ],
    icon: "R",
    iconBg: "#00DEB6",
  },
  {
    id: "ic-memo-ai",
    slug: "ic-memo-ai",
    name: "IC Memo AI",
    tagline: "Investment committee memos · Claude-powered · one click",
    category: "AI Tools",
    markets: ["Global"],
    description:
      "Generates institutional-grade investment committee memos from any Prime Atlas opportunity score in seconds. Powered by Claude.",
    longDescription:
      "IC Memo AI takes a municipality's full score breakdown — opportunity, growth, infrastructure, development, liquidity, and risk — and generates a structured IC memo covering market context, investment thesis, risk factors, sensitivity analysis, and recommendation. Output is a downloadable PDF formatted to institutional standards.",
    rating: 4.9,
    ratingCount: 2105,
    installs: 12340,
    version: "3.0.1",
    tags: ["AI", "Memo", "Claude", "PDF", "Pro"],
    featured: true,
    price: "Pro",
    requiredTier: "explorer",
    metrics: { uptime: 99.9, coverage: 100, latency: "~8s generation" },
    steps: [
      "Open any municipality opportunity page.",
      "Click 'Generate IC Memo' in the action bar.",
      "Claude processes score data → memo generates in ~8 seconds.",
      "Download as formatted PDF or copy as Markdown.",
    ],
    changelog: [
      { version: "3.0.1", date: "Jun 2026", notes: "Claude Sonnet 4.6 model upgrade" },
      { version: "3.0.0", date: "Apr 2026", notes: "Sensitivity analysis section added" },
      { version: "2.1.0", date: "Jan 2026", notes: "PDF export with letterhead" },
    ],
    icon: "✦",
    iconBg: "#7C3AED",
    new: true,
  },
  {
    id: "thesis-builder",
    slug: "thesis-builder",
    name: "Thesis Builder",
    tagline: "AI investment theses · editable · shareable",
    category: "AI Tools",
    markets: ["Global"],
    description:
      "AI-drafted investment theses for any market or opportunity, with inline editing and one-click share links.",
    longDescription:
      "Thesis Builder uses Claude to generate a 400–600 word structured investment thesis from opportunity finder inputs: budget, geography, risk profile, and return target. Output sections include: market catalyst, acquisition strategy, exit horizon, and risks. Theses are saved to your dashboard and can be shared via private link.",
    rating: 4.7,
    ratingCount: 876,
    installs: 6120,
    version: "2.2.0",
    tags: ["AI", "Writing", "Claude", "Thesis"],
    featured: false,
    price: "Pro",
    requiredTier: "explorer",
    metrics: { uptime: 99.7, coverage: 100, latency: "~5s generation" },
    steps: [
      "Open Opportunity Finder → set your filters.",
      "Click 'Draft Investment Thesis' on any result.",
      "Edit inline — all sections are editable rich text.",
      "Share via private link or export as PDF.",
    ],
    changelog: [
      { version: "2.2.0", date: "May 2026", notes: "Inline edit mode + share links" },
      { version: "2.0.0", date: "Feb 2026", notes: "Claude Sonnet 4 upgrade" },
    ],
    icon: "T",
    iconBg: "#059669",
  },
  {
    id: "rental-yield-calc",
    slug: "rental-yield-calc",
    name: "Rental Yield Calculator",
    tagline: "Gross & net yield · cap rate · cash-on-cash return",
    category: "Analytics",
    markets: ["Global"],
    description:
      "Calculate gross yield, net yield, cap rate, and cash-on-cash return for any property with a guided input wizard.",
    longDescription:
      "The Rental Yield Calculator is an embedded financial model that takes purchase price, gross rent, vacancy rate, expenses, mortgage details, and local transaction costs to produce gross yield, net yield, cap rate, cash-on-cash return, and 5-year IRR. All values update in real time as inputs change. Results can be attached to any Deal Board entry.",
    rating: 4.6,
    ratingCount: 1890,
    installs: 9870,
    version: "1.5.0",
    tags: ["Calculator", "Yield", "Finance", "Embedded"],
    featured: false,
    price: "Included",
    requiredTier: "free",
    metrics: { uptime: 100, coverage: 100, latency: "Instant" },
    steps: [
      "Access from any listing detail page → 'Calculate Yield'.",
      "Enter purchase price, monthly rent, vacancy, expenses.",
      "Toggle mortgage inputs for leveraged return analysis.",
      "Attach results to your Deal Board entry.",
    ],
    changelog: [
      { version: "1.5.0", date: "Jun 2026", notes: "5-year IRR projection chart added" },
      { version: "1.4.0", date: "Mar 2026", notes: "Leveraged cash-on-cash return" },
    ],
    icon: "Σ",
    iconBg: "#0891B2",
  },
  {
    id: "market-heatmap",
    slug: "market-heatmap",
    name: "Market Heat Map",
    tagline: "Score distribution · 32 markets · interactive",
    category: "Analytics",
    markets: ["Global"],
    description:
      "Interactive geographic heat map of Prime Atlas opportunity scores across all 32 tracked markets. Filter by score component.",
    longDescription:
      "Market Heat Map renders all tracked municipalities on a Mapbox GL canvas, colour-coded by opportunity score (or any sub-score: growth, infrastructure, development, liquidity, risk). Hover for a score card pop-up, click to navigate to the full opportunity page. Pro users can export the filtered dataset as CSV.",
    rating: 4.4,
    ratingCount: 654,
    installs: 3450,
    version: "1.2.0",
    tags: ["Map", "Visualisation", "Scores", "Interactive"],
    featured: false,
    price: "Pro",
    requiredTier: "explorer",
    metrics: { uptime: 98.9, coverage: 100, latency: "< 1.5s render" },
    steps: [
      "Navigate to Rankings → click 'Open Heat Map'.",
      "Select score component from the top filter bar.",
      "Hover markets for pop-up score card.",
      "Export visible dataset as CSV (Pro only).",
    ],
    changelog: [
      { version: "1.2.0", date: "Apr 2026", notes: "Sub-score layer switching" },
      { version: "1.0.0", date: "Nov 2025", notes: "Initial Mapbox integration" },
    ],
    icon: "◉",
    iconBg: "#16A34A",
  },
  {
    id: "signal-watcher",
    slug: "signal-watcher",
    name: "Signal Watcher",
    tagline: "Real-time alerts · custom triggers · email + push",
    category: "Alerts",
    markets: ["Global"],
    description:
      "Set custom alert thresholds on any market, score component, or listing metric. Receive notifications via email or push.",
    longDescription:
      "Signal Watcher lets you define triggers — score crosses threshold, listing price drop > X%, new signals in watchlisted municipalities — and routes notifications to email, browser push, or both. Alert history is stored for 90 days. Free tier receives 48-hour delayed alerts; Pro users receive real-time.",
    rating: 4.7,
    ratingCount: 1102,
    installs: 6780,
    version: "2.0.0",
    tags: ["Alerts", "Real-time", "Email", "Push"],
    featured: false,
    price: "Pro (real-time)",
    requiredTier: "free",
    metrics: { uptime: 99.5, coverage: 100, latency: "< 30s (Pro)" },
    steps: [
      "Go to Watchlists → select a municipality → 'Add Alert'.",
      "Choose trigger: score threshold, signal type, price event.",
      "Set delivery: email, browser push, or both.",
      "Pro users receive alerts within 30 seconds of detection.",
    ],
    changelog: [
      { version: "2.0.0", date: "May 2026", notes: "Push notification support + alert history" },
      { version: "1.3.0", date: "Jan 2026", notes: "Price drop triggers for listings" },
    ],
    icon: "⚡",
    iconBg: "#D97706",
  },
  {
    id: "planning-portal",
    slug: "planning-portal",
    name: "Planning Portal Watch",
    tagline: "UK planning applications · automated detection",
    category: "Alerts",
    markets: ["UK"],
    description:
      "Monitors UK planning portal for new applications, approvals, and refusals in your tracked municipalities. Surfaces as Signals.",
    longDescription:
      "Planning Portal Watch polls the UK Planning Portal API daily, capturing new planning applications, decisions, and appeals for all English and Welsh local planning authorities. Applications within or near your tracked municipalities surface as Signals with category 'planning_momentum'. Pro users can set keyword filters.",
    rating: 4.2,
    ratingCount: 340,
    installs: 1890,
    version: "1.0.1",
    tags: ["Planning", "UK", "Signals", "Government"],
    featured: false,
    price: "Pro",
    requiredTier: "explorer",
    metrics: { uptime: 95.2, coverage: 88, latency: "< 24h" },
    steps: [
      "Enable in Settings → Integrations → Planning Portal Watch.",
      "Applications surface automatically in your Signals feed.",
      "Filter by: residential, commercial, change of use, appeals.",
      "Set keyword alerts for specific development types.",
    ],
    changelog: [
      { version: "1.0.1", date: "Mar 2026", notes: "Appeal decision tracking added" },
      { version: "1.0.0", date: "Dec 2025", notes: "Initial release" },
    ],
    icon: "🏗",
    iconBg: "#B45309",
  },
  {
    id: "scrapeops-proxy",
    slug: "scrapeops-proxy",
    name: "ScrapeOps Proxy",
    tagline: "Managed proxy infrastructure · 25k credits/mo",
    category: "Infrastructure",
    markets: ["Global"],
    description:
      "Managed proxy rotation and CAPTCHA solving that powers all Prime Atlas web scrapers. Transparent pass-through, no configuration.",
    longDescription:
      "ScrapeOps provides the proxy and anti-bot infrastructure underpinning all Prime Atlas data scrapers. The integration is fully managed — no API keys or configuration required on the user side. Credit consumption is tracked internally. The Starter plan covers 25k credits/month (sufficient for all current scrapers). Upgrade within ScrapeOps if you see coverage gaps.",
    rating: 4.6,
    ratingCount: 218,
    installs: 1100,
    version: "3.0.0",
    tags: ["Infrastructure", "Proxy", "Scraping", "Internal"],
    featured: false,
    price: "$29/mo (internal)",
    requiredTier: "free",
    metrics: { uptime: 98.7, coverage: 95, latency: "Varies by target" },
    steps: [
      "No user action required — fully managed internally.",
      "Coverage issues? Contact support@prime-atlas.io.",
      "Scraper health visible in the admin status endpoint.",
      "Credit usage resets on the 1st of each month.",
    ],
    changelog: [
      { version: "3.0.0", date: "Apr 2026", notes: "ScrapeOps v3 API migration" },
      { version: "2.1.0", date: "Nov 2025", notes: "CAPTCHA solving tier upgrade" },
    ],
    icon: "⚙",
    iconBg: "#374151",
  },
  {
    id: "csv-export",
    slug: "csv-export",
    name: "CSV Export",
    tagline: "Deal Board, rankings & listings · one-click download",
    category: "Exports",
    markets: ["Global"],
    description:
      "Export any filtered Deal Board view, ranking table, or listings set as a clean, structured CSV. No formatting cruft.",
    longDescription:
      "CSV Export adds a download button to Deal Board, Listings Terminal, and Market Feed pages. Exports honour your current filters — so exporting from 'UK, score > 70' produces exactly that dataset. Columns match the displayed table with consistent naming. Professional users get enriched exports including all score sub-components.",
    rating: 4.5,
    ratingCount: 780,
    installs: 4320,
    version: "1.2.0",
    tags: ["Export", "CSV", "Data", "Download"],
    featured: false,
    price: "Pro",
    requiredTier: "explorer",
    metrics: { uptime: 100, coverage: 100, latency: "< 2s" },
    steps: [
      "On Deal Board, Rankings, or Market Feed — click '↓ Export CSV'.",
      "Current filters apply automatically to the export.",
      "File downloads immediately — no email required.",
      "Pro exports include all score sub-components.",
    ],
    changelog: [
      { version: "1.2.0", date: "Jun 2026", notes: "Sub-score columns in Pro export" },
      { version: "1.0.0", date: "Dec 2025", notes: "Initial release" },
    ],
    icon: "↓",
    iconBg: "#1F2937",
  },
  {
    id: "pdf-report",
    slug: "pdf-report",
    name: "Portfolio PDF Report",
    tagline: "Watchlist → branded PDF · investor-ready",
    category: "Exports",
    markets: ["Global"],
    description:
      "Generates a branded, paginated PDF report from your watchlist — opportunity scores, thesis summaries, and risk callouts.",
    longDescription:
      "Portfolio PDF Report compiles your full watchlist into a paginated, branded PDF. Each page covers one municipality: score radar, sub-score breakdown, market snapshot, and any saved investment thesis. The report includes a cover page with your name, generation date, and Prime Atlas branding. Ideal for LP or IC presentations.",
    rating: 4.8,
    ratingCount: 540,
    installs: 2780,
    version: "2.0.0",
    tags: ["PDF", "Portfolio", "Report", "Branding"],
    featured: false,
    price: "Investor",
    requiredTier: "professional",
    metrics: { uptime: 99.2, coverage: 100, latency: "~12s generation" },
    steps: [
      "Go to Dashboard → Watchlists → select a watchlist.",
      "Click 'Generate PDF Report'.",
      "Report generates in ~12 seconds.",
      "Download or share via private link (expires 7 days).",
    ],
    changelog: [
      { version: "2.0.0", date: "May 2026", notes: "Score radar charts per municipality" },
      { version: "1.0.0", date: "Feb 2026", notes: "Initial release" },
    ],
    icon: "📄",
    iconBg: "#1E3A5F",
    new: true,
  },
];

/* ─── Constants ──────────────────────────────────────────────────── */

const CATEGORIES: Category[] = [
  "All",
  "Data Sources",
  "AI Tools",
  "Analytics",
  "Alerts",
  "Infrastructure",
  "Exports",
];

const MARKETS: Market[] = ["All", "US", "UK", "ES", "AU", "CA", "Global"];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "newest",  label: "Newest"       },
  { value: "rating",  label: "Top rated"    },
  { value: "alpha",   label: "A → Z"        },
];

const TIER_ORDER: Record<Tier, number> = {
  free: 0, explorer: 1, professional: 2, institutional: 3,
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function PercentBar({ value, color = "#00C805" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 12 12"
          className="w-2.5 h-2.5"
          fill={i <= Math.round(rating) ? "#CCFF00" : "none"}
          stroke={i <= Math.round(rating) ? "#CCFF00" : "rgba(255,255,255,0.2)"}
          strokeWidth="1"
        >
          <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" />
        </svg>
      ))}
    </span>
  );
}

function AppIcon({ app }: { app: MarketplaceApp }) {
  return (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
      style={{ background: app.iconBg }}
    >
      {app.icon}
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  if (tier === "free") return null;
  const labels: Record<Tier, string> = {
    free: "", explorer: "Explorer", professional: "Professional", institutional: "Enterprise",
  };
  const colors: Record<Tier, string> = {
    free: "",
    explorer: "text-[#CCFF00]",
    professional: "text-amber-400",
    institutional: "text-purple-400",
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest ${colors[tier]}`}>
      {labels[tier]}
    </span>
  );
}

/* ─── FilterDrawer ───────────────────────────────────────────────── */

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function FilterDrawer({ open, onClose, title, children }: FilterDrawerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-150"
        style={{
          background: "rgba(0,0,0,0.72)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={ref}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{
          background: "#0C0D14",
          boxShadow: "0 -1px 0 rgba(255,255,255,0.06), 0 -40px 80px rgba(0,0,0,0.6)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 140ms cubic-bezier(0.32,0.72,0,1)",
          maxHeight: "72vh",
          overflowY: "auto",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 px-1">{title}</p>
        {children}
      </div>
    </>
  );
}

/* ─── AppDetailPanel ─────────────────────────────────────────────── */

interface DetailPanelProps {
  app: MarketplaceApp | null;
  onClose: () => void;
  userTier: Tier;
  isLoggedIn: boolean;
  installedIds: Set<string>;
  onInstall: (id: string) => void;
}

function AppDetailPanel({ app, onClose, userTier, isLoggedIn, installedIds, onInstall }: DetailPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const open = !!app;
  const installed = app ? installedIds.has(app.id) : false;
  const canInstall = app ? TIER_ORDER[userTier] >= TIER_ORDER[app.requiredTier] : false;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-150"
        style={{
          background: "rgba(0,0,0,0.75)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Panel — full-height right drawer on desktop, bottom sheet on mobile */}
      <div
        ref={ref}
        className="fixed z-50 bg-[#0C0D14] overflow-y-auto"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(520px, 100vw)",
          boxShadow: "-1px 0 0 rgba(255,255,255,0.05), -40px 0 80px rgba(0,0,0,0.5)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 140ms cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {!app ? null : (
          <div className="px-6 py-8 space-y-10">

            {/* Close */}
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-white transition-colors duration-100 text-sm font-semibold flex items-center gap-1.5"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M10 4L6 8l4 4" />
                </svg>
                Back
              </button>
              {app.new && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#CCFF00] bg-[#CCFF00]/10 px-2.5 py-1 rounded-full">
                  New
                </span>
              )}
            </div>

            {/* Header — Agentic Console style */}
            <div className="space-y-5">
              <AppIcon app={app} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                  {app.category} · {app.markets.join(", ")} · v{app.version}
                </p>
                <h2 className="font-black text-3xl tracking-tight text-white leading-tight">
                  {app.name}
                </h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed text-pretty">{app.tagline}</p>
              </div>

              {/* Install button */}
              {isLoggedIn ? (
                canInstall ? (
                  <button
                    onClick={() => onInstall(app.id)}
                    className="w-full py-3.5 rounded-full font-bold text-sm transition-all duration-100"
                    style={
                      installed
                        ? { background: "rgba(0,200,5,0.1)", color: "#00C805", outline: "1px solid rgba(0,200,5,0.3)" }
                        : { background: "#CCFF00", color: "#000000" }
                    }
                  >
                    {installed ? "✓ Installed" : "Install integration"}
                  </button>
                ) : (
                  <Link
                    href="/pricing"
                    className="block w-full text-center py-3.5 rounded-full font-bold text-sm"
                    style={{ background: "rgba(204,255,0,0.08)", color: "#CCFF00", outline: "1px solid rgba(204,255,0,0.2)" }}
                  >
                    Upgrade to {app.requiredTier.charAt(0).toUpperCase() + app.requiredTier.slice(1)} to install
                  </Link>
                )
              ) : (
                <Link
                  href="/auth/login"
                  className="block w-full text-center bg-[#CCFF00] text-black font-bold py-3.5 rounded-full text-sm"
                >
                  Sign in to install
                </Link>
              )}
            </div>

            {/* Stats strip — tabular-nums */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Installs",  value: app.installs.toLocaleString() },
                { label: "Rating",    value: `${app.rating.toFixed(1)}/5`  },
                { label: "Version",   value: `v${app.version}`             },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xl font-black text-white tabular-nums tracking-tight leading-none">{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Performance metrics */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Performance</p>
              {[
                { label: "Uptime",   value: app.metrics.uptime,   display: `${app.metrics.uptime}%`  },
                { label: "Coverage", value: app.metrics.coverage, display: `${app.metrics.coverage}%` },
              ].map(({ label, value, display }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-semibold">{label}</span>
                    <span className="text-xs font-black text-white tabular-nums">{display}</span>
                  </div>
                  <PercentBar value={value} color={value >= 98 ? "#00C805" : value >= 90 ? "#CCFF00" : "#F59E0B"} />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-semibold">Latency</span>
                <span className="text-xs font-black text-white tabular-nums">{app.metrics.latency}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">About</p>
              <p className="text-sm text-zinc-300 leading-relaxed text-pretty">{app.longDescription}</p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {app.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.04)", outline: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Integration steps */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">How to connect</p>
              <div className="space-y-3">
                {app.steps.map((step, i) => (
                  <div key={i} className="flex gap-3.5">
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-black"
                      style={{ background: "#CCFF00" }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Changelog */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Changelog</p>
              <div className="space-y-3">
                {app.changelog.map((entry) => (
                  <div key={entry.version} className="flex gap-3">
                    <span className="text-[10px] font-black tabular-nums text-zinc-500 w-12 flex-shrink-0 pt-0.5">
                      {entry.version}
                    </span>
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold">{entry.date}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{entry.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ratings breakdown */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Ratings · {app.ratingCount.toLocaleString()} reviews
              </p>
              <div className="flex items-start gap-5">
                <div>
                  <p className="text-5xl font-black text-white tabular-nums leading-none">{app.rating.toFixed(1)}</p>
                  <StarRating rating={app.rating} />
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const pct =
                      star === 5 ? Math.round(app.rating * 15)
                      : star === 4 ? Math.round((5 - app.rating) * 20)
                      : star === 3 ? 5
                      : star === 2 ? 2
                      : 1;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-500 w-3 text-right tabular-nums">{star}</span>
                        <PercentBar value={Math.min(pct, 100)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

/* ─── AppCard ─────────────────────────────────────────────────────── */

interface AppCardProps {
  app: MarketplaceApp;
  installed: boolean;
  onClick: () => void;
}

function AppCard({ app, installed, onClick }: AppCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group flex flex-col gap-4 py-6 transition-all duration-100"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-start gap-4">
        <AppIcon app={app} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-black text-base text-white tracking-tight leading-tight group-hover:text-[#CCFF00] transition-colors duration-100">
              {app.name}
            </span>
            {app.new && (
              <span className="text-[8px] font-black uppercase tracking-widest text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded-full">
                New
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
            {app.category}
            {app.markets[0] !== "Global" ? ` · ${app.markets.join(", ")}` : ""}
            {" · "}
            <TierBadge tier={app.requiredTier} />
            {app.requiredTier === "free" && <span className="text-[#00C805]">Free</span>}
          </p>
          <p className="text-sm text-zinc-400 leading-snug line-clamp-2">{app.description}</p>
        </div>
        {/* Install state indicator */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {installed ? (
            <span
              className="text-[10px] font-bold text-[#00C805]"
              style={{ outline: "1px solid rgba(0,200,5,0.3)", borderRadius: 99, padding: "4px 10px" }}
            >
              ✓
            </span>
          ) : (
            <span
              className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors duration-100"
              style={{ outline: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, padding: "4px 10px" }}
            >
              GET
            </span>
          )}
        </div>
      </div>

      {/* Mini metrics row */}
      <div className="flex items-center gap-5 pl-[60px]">
        <div className="flex items-center gap-1.5">
          <StarRating rating={app.rating} />
          <span className="text-[10px] tabular-nums text-zinc-500 font-semibold">{app.rating.toFixed(1)}</span>
        </div>
        <span className="text-[10px] tabular-nums text-zinc-500 font-semibold">
          {app.installs.toLocaleString()} installs
        </span>
        <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">v{app.version}</span>
      </div>
    </button>
  );
}

/* ─── FeaturedBanner ─────────────────────────────────────────────── */

function FeaturedBanner({ app, onClick }: { app: MarketplaceApp; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left relative overflow-hidden rounded-3xl p-7 group"
      style={{
        background: "linear-gradient(135deg, rgba(0,200,5,0.10) 0%, rgba(204,255,0,0.05) 50%, rgba(0,200,5,0.08) 100%)",
        boxShadow: "0 0 0 1px rgba(0,200,5,0.12), inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.35)",
      }}
    >
      {/* Shimmer */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00C805]/30 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#00C805] mb-3">Featured</p>
          <h3 className="font-black text-2xl text-white tracking-tight leading-tight mb-1 group-hover:text-[#CCFF00] transition-colors duration-100">
            {app.name}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed text-pretty mb-5">{app.description}</p>
          <div className="flex items-center gap-4">
            <StarRating rating={app.rating} />
            <span className="text-xs tabular-nums text-zinc-400 font-semibold">{app.rating.toFixed(1)} · {app.ratingCount.toLocaleString()} reviews</span>
          </div>
        </div>
        <AppIcon app={app} />
      </div>
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */

interface Props {
  userTier: Tier;
  isLoggedIn: boolean;
}

export function AppMarketplace({ userTier, isLoggedIn }: Props) {
  const [category, setCategory]             = useState<Category>("All");
  const [market, setMarket]                 = useState<Market>("All");
  const [sortBy, setSortBy]                 = useState<SortKey>("popular");
  const [search, setSearch]                 = useState("");
  const [selectedApp, setSelectedApp]       = useState<MarketplaceApp | null>(null);
  const [installedIds, setInstalledIds]     = useState<Set<string>>(new Set(["zillow-feed", "land-registry", "rental-yield-calc"]));
  const [filterDrawer, setFilterDrawer]     = useState<"category" | "market" | "sort" | null>(null);

  const closeDrawer = useCallback(() => setFilterDrawer(null), []);

  /* ── Filtered & sorted list ── */
  const filtered = useMemo(() => {
    let list = APPS;
    if (category !== "All") list = list.filter((a) => a.category === category);
    if (market !== "All")   list = list.filter((a) => a.markets.includes(market));
    if (search.trim())      list = list.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    );
    return [...list].sort((a, b) => {
      if (sortBy === "popular") return b.installs - a.installs;
      if (sortBy === "rating")  return b.rating - a.rating;
      if (sortBy === "newest")  return b.version.localeCompare(a.version);
      return a.name.localeCompare(b.name);
    });
  }, [category, market, sortBy, search]);

  const featuredApp = useMemo(
    () => filtered.find((a) => a.featured) ?? null,
    [filtered]
  );

  const listApps = useMemo(
    () => (featuredApp ? filtered.filter((a) => a.id !== featuredApp.id) : filtered),
    [filtered, featuredApp]
  );

  const handleInstall = useCallback((id: string) => {
    setInstalledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* ── Page header ── */}
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">
            prime-atlas · integrations
          </p>
          <h1 className="font-black text-4xl sm:text-5xl tracking-tight text-white leading-[1.02] mb-4 text-balance">
            The intelligence stack.<br />
            <span className="text-[#CCFF00]">Fully connected.</span>
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-md text-pretty">
            Connect data sources, AI tools, and analytics integrations to your Prime Atlas workspace.
            {" "}{APPS.length} integrations · {installedIds.size} active.
          </p>
        </div>

        {/* ── Search ── */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            outline: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path strokeLinecap="round" d="M13.5 13.5L17 17" />
          </svg>
          <input
            type="text"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-zinc-500 hover:text-white text-xs transition-colors">
              ✕
            </button>
          )}
        </div>

        {/* ── Filter pills ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 mb-10">
          {/* Category pill */}
          <button
            onClick={() => setFilterDrawer("category")}
            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-100"
            style={
              category !== "All"
                ? { background: "#00C805", color: "#000" }
                : { background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }
            }
          >
            {category === "All" ? "Category" : category}
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </button>

          {/* Market pill */}
          <button
            onClick={() => setFilterDrawer("market")}
            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-100"
            style={
              market !== "All"
                ? { background: "#00C805", color: "#000" }
                : { background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }
            }
          >
            {market === "All" ? "Market" : market}
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </button>

          {/* Sort pill */}
          <button
            onClick={() => setFilterDrawer("sort")}
            className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ml-auto transition-all duration-100"
            style={{ background: "rgba(255,255,255,0.06)", color: "#A1A1AA" }}
          >
            {SORT_OPTIONS.find((s) => s.value === sortBy)?.label ?? "Sort"}
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </button>

          {/* Active filter clear */}
          {(category !== "All" || market !== "All") && (
            <button
              onClick={() => { setCategory("All"); setMarket("All"); }}
              className="shrink-0 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Result count ── */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-8 tabular-nums">
          {filtered.length} integration{filtered.length !== 1 ? "s" : ""}
          {category !== "All" ? ` · ${category}` : ""}
          {market !== "All" ? ` · ${market}` : ""}
        </p>

        {/* ── Featured banner ── */}
        {featuredApp && !search && (
          <div className="mb-10">
            <FeaturedBanner app={featuredApp} onClick={() => setSelectedApp(featuredApp)} />
          </div>
        )}

        {/* ── App list ── */}
        {listApps.length === 0 && !featuredApp ? (
          <div className="py-24 text-center">
            <p className="text-zinc-500 text-sm mb-2">No integrations match your filters.</p>
            <button
              onClick={() => { setCategory("All"); setMarket("All"); setSearch(""); }}
              className="text-xs text-[#CCFF00] hover:opacity-80 transition-opacity"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div>
            {listApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                installed={installedIds.has(app.id)}
                onClick={() => setSelectedApp(app)}
              />
            ))}
          </div>
        )}

        {/* ── Footer nudge ── */}
        <div className="py-20 text-center space-y-2">
          <p className="text-xs text-zinc-600 font-semibold">Missing an integration?</p>
          <Link
            href="mailto:support@prime-atlas.io?subject=Integration Request"
            className="text-xs text-zinc-500 hover:text-[#CCFF00] transition-colors duration-100"
          >
            Request one →
          </Link>
        </div>

      </div>

      {/* ── Filter drawers ── */}

      {/* Category */}
      <FilterDrawer open={filterDrawer === "category"} onClose={closeDrawer} title="Filter by Category">
        <div className="flex flex-col gap-1 pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); closeDrawer(); }}
              className="w-full text-left flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-colors duration-100"
              style={
                category === cat
                  ? { background: "rgba(0,200,5,0.08)", color: "#00C805" }
                  : { color: "#fff" }
              }
            >
              <span>{cat}</span>
              <span className="text-xs tabular-nums font-semibold" style={{ color: "#52525B" }}>
                {cat === "All" ? APPS.length : APPS.filter((a) => a.category === cat).length}
              </span>
            </button>
          ))}
        </div>
      </FilterDrawer>

      {/* Market */}
      <FilterDrawer open={filterDrawer === "market"} onClose={closeDrawer} title="Filter by Market">
        <div className="flex flex-col gap-1 pb-2">
          {MARKETS.map((m) => (
            <button
              key={m}
              onClick={() => { setMarket(m); closeDrawer(); }}
              className="w-full text-left flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-colors duration-100"
              style={
                market === m
                  ? { background: "rgba(0,200,5,0.08)", color: "#00C805" }
                  : { color: "#fff" }
              }
            >
              <span>{m === "All" ? "All Markets" : m}</span>
              <span className="text-xs tabular-nums font-semibold" style={{ color: "#52525B" }}>
                {m === "All" ? APPS.length : APPS.filter((a) => a.markets.includes(m)).length}
              </span>
            </button>
          ))}
        </div>
      </FilterDrawer>

      {/* Sort */}
      <FilterDrawer open={filterDrawer === "sort"} onClose={closeDrawer} title="Sort by">
        <div className="flex flex-col gap-1 pb-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSortBy(opt.value); closeDrawer(); }}
              className="w-full text-left px-4 py-3.5 rounded-2xl text-sm font-bold transition-colors duration-100"
              style={
                sortBy === opt.value
                  ? { background: "rgba(0,200,5,0.08)", color: "#00C805" }
                  : { color: "#fff" }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterDrawer>

      {/* ── App detail panel ── */}
      <AppDetailPanel
        app={selectedApp}
        onClose={() => setSelectedApp(null)}
        userTier={userTier}
        isLoggedIn={isLoggedIn}
        installedIds={installedIds}
        onInstall={handleInstall}
      />
    </main>
  );
}
