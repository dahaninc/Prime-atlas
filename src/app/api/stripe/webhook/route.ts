/**
 * POST /api/stripe/webhook
 * Receives Stripe events and syncs subscription state to Supabase.
 *
 * Design notes:
 *  - Any Supabase write failure returns HTTP 500 so Stripe RETRIES the event.
 *    (Previously errors were swallowed and Stripe marked the event delivered,
 *    leaving paying customers without access.)
 *  - The user is resolved from subscription metadata (user_id) first, falling
 *    back to profiles.stripe_customer_id — so out-of-order event delivery
 *    (subscription.updated before checkout.session.completed) still lands.
 *  - ALL billing states are handled: active/trialing grant the tier;
 *    past_due, unpaid, canceled, incomplete, incomplete_expired and paused
 *    downgrade to free immediately.
 *
 * Events handled:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 */

import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];
type Admin = SupabaseClient<Database>;

/** Statuses that grant paid access. Everything else downgrades to free. */
const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

function adminClient(): Admin {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** price ID → tier. New env names with legacy fallbacks (STRIPE_PRICE_PRO/INVESTOR). */
function tierByPrice(): Record<string, SubscriptionTier> {
  const map: Record<string, SubscriptionTier> = {};
  const pairs: Array<[string | undefined, SubscriptionTier]> = [
    [process.env.STRIPE_PRICE_EXPLORER ?? process.env.STRIPE_PRICE_PRO, "explorer"],
    [process.env.STRIPE_PRICE_PROFESSIONAL ?? process.env.STRIPE_PRICE_INVESTOR, "professional"],
    [process.env.STRIPE_PRICE_INSTITUTIONAL, "institutional"],
  ];
  for (const [priceId, tier] of pairs) {
    if (priceId) map[priceId] = tier;
  }
  return map;
}

/** Resolve the profile ID a subscription belongs to. */
async function resolveUserId(
  admin: Admin,
  sub: Stripe.Subscription
): Promise<string | null> {
  const fromMetadata = sub.metadata?.user_id;
  if (fromMetadata) return fromMetadata;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(`profiles lookup failed: ${error.message}`);
  return data?.id ?? null;
}

/** Sync one subscription's state onto the owner's profile + subscriptions table. */
async function syncSubscription(admin: Admin, sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(admin, sub);
  if (!userId) {
    // No profile yet — likely a race with signup. 500 → Stripe retries later.
    throw new Error(`No profile found for subscription ${sub.id} (customer ${sub.customer})`);
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price.id ?? "";
  const mappedTier = tierByPrice()[priceId];
  const isActive = ACTIVE_STATUSES.has(sub.status);

  if (isActive && !mappedTier) {
    // Unknown price ID: never guess a paid tier. Loud log, no grant, no retry loop.
    console.error(
      `[stripe/webhook] Unmapped price "${priceId}" on subscription ${sub.id} — ` +
        `check STRIPE_PRICE_EXPLORER / STRIPE_PRICE_PROFESSIONAL / STRIPE_PRICE_INSTITUTIONAL env vars.`
    );
    return;
  }

  const tier: SubscriptionTier = isActive ? mappedTier! : "free";
  const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: isActive ? sub.id : null,
      subscription_tier: tier,
      subscription_period_end: isActive ? periodEnd : null,
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error(`profile update failed for user ${userId}: ${profileError.message}`);
  }

  // Keep an auditable subscription record (status history for support/debugging).
  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      status: sub.status,
      current_period_end: periodEnd,
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (subError) {
    throw new Error(`subscriptions upsert failed for ${sub.id}: ${subError.message}`);
  }

  console.log(
    `[stripe/webhook] synced sub ${sub.id} → user ${userId}: status=${sub.status}, tier=${tier}`
  );
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = adminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        // Retrieve the full subscription; metadata.user_id was set at checkout.
        const sub = await stripe.subscriptions.retrieve(subId);

        // Belt-and-braces: if subscription metadata is missing, fall back to
        // the checkout session's metadata before the customer-ID lookup.
        if (!sub.metadata?.user_id && session.metadata?.user_id) {
          sub.metadata = { ...sub.metadata, user_id: session.metadata.user_id };
        }

        await syncSubscription(admin, sub);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(admin, sub);
        break;
      }

      default:
        // Unhandled event type — acknowledge and ignore.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] ${event.type} failed:`, message);
    // 500 → Stripe retries with exponential backoff for up to 3 days.
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
