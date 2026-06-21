/**
 * prime-atlas analytics event helpers.
 * All events funnel to PostHog.
 *
 * Usage (client components only):
 *   import { track } from "@/lib/analytics";
 *   track("opportunity_finder_run", { objective: "growth", region: "Costa Blanca" });
 */

import posthog from "posthog-js";

type EventProperties = Record<string, string | number | boolean | null | undefined>;

export function track(event: string, properties?: EventProperties) {
  try {
    posthog.capture(event, properties);
  } catch {
    // PostHog not initialised (SSR / tests) — silently swallow
  }
}

// ── Typed event helpers ────────────────────────────────────────────────────

export const analytics = {
  /** User ran the Opportunity Finder */
  opportunityFinderRun(params: {
    objective: string;
    region?: string;
    category?: string;
    budget_min?: number;
    budget_max?: number;
    risk_tolerance?: number;
    min_score?: number;
    result_count: number;
  }) {
    track("opportunity_finder_run", params);
  },

  /** Claude thesis generation triggered */
  thesisGenerated(params: { municipality_id: string; municipality_name: string }) {
    track("thesis_generated", params);
  },

  /** Municipality added to watchlist */
  watchlistAdd(params: { municipality_id: string; municipality_name: string }) {
    track("watchlist_add", params);
  },

  /** Signal card clicked / expanded */
  signalViewed(params: { signal_id: string; signal_type: string; impact: number }) {
    track("signal_viewed", params);
  },

  /** User clicked an upgrade CTA */
  upgradeClicked(params: { source: string; current_tier: string; target_tier?: string }) {
    track("upgrade_clicked", params);
  },

  /** Stripe checkout completed (client-side confirmation from /pricing?upgraded=1) */
  subscriptionStarted(params: { tier: string }) {
    track("subscription_started", params);
  },

  /** Municipality opportunity page viewed */
  municipalityViewed(params: { municipality_name: string; region: string; score: number }) {
    track("municipality_viewed", params);
  },

  /** User identified after login */
  identify(userId: string, traits?: { email?: string; tier?: string }) {
    try {
      posthog.identify(userId, traits);
    } catch { /* SSR */ }
  },
};
