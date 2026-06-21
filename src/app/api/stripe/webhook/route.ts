/**
 * POST /api/stripe/webhook
 * Receives Stripe events and syncs subscription state to Supabase profiles.
 *
 * Events handled:
 *   checkout.session.completed          — first subscription, save customer ID
 *   customer.subscription.updated       — tier change, renewal
 *   customer.subscription.deleted       — cancellation → downgrade to free
 */

import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createServerClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

// Use service-role client — no RLS, runs outside user context
function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const TIER_BY_PRICE: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO            ?? ""]: "pro",
  [process.env.STRIPE_PRICE_INVESTOR       ?? ""]: "investor",
  [process.env.STRIPE_PRICE_INSTITUTIONAL  ?? ""]: "institutional",
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = adminClient();

  switch (event.type) {
    // ── New subscription created via Checkout ──────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const userId     = session.metadata?.user_id;
      const customerId = session.customer as string;
      const subId      = session.subscription as string;

      if (!userId) break;

      // Retrieve subscription to get price ID + period end
      const sub = await stripe.subscriptions.retrieve(subId);
      const priceId  = sub.items.data[0]?.price.id ?? "";
      const tier     = TIER_BY_PRICE[priceId] ?? "pro";
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

      await supabase
        .from("profiles")
        .update({
          stripe_customer_id:     customerId,
          stripe_subscription_id: subId,
          subscription_tier:      tier,
          subscription_period_end: periodEnd,
        })
        .eq("id", userId);

      break;
    }

    // ── Subscription renewed / plan changed ───────────────────────────────
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const priceId    = sub.items.data[0]?.price.id ?? "";
      const tier       = TIER_BY_PRICE[priceId] ?? "pro";
      const periodEnd  = new Date(sub.current_period_end * 1000).toISOString();
      const status     = sub.status;

      // If the subscription is still active/trialling, update tier
      if (["active", "trialing"].includes(status)) {
        await supabase
          .from("profiles")
          .update({
            subscription_tier:       tier,
            stripe_subscription_id:  sub.id,
            subscription_period_end: periodEnd,
          })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }

    // ── Subscription cancelled → downgrade to free ────────────────────────
    case "customer.subscription.deleted": {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await supabase
        .from("profiles")
        .update({
          subscription_tier:       "free",
          stripe_subscription_id:  null,
          subscription_period_end: null,
        })
        .eq("stripe_customer_id", customerId);

      break;
    }

    default:
      // Unhandled event type — ignore
      break;
  }

  return NextResponse.json({ received: true });
}
