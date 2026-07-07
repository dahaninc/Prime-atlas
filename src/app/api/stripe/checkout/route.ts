/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for tier upgrades.
 * Body: { tier: "explorer" | "professional" | "institutional", interval?: "monthly" | "annual" }
 */

import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs"; // Stripe SDK requires Node
export const dynamic = "force-dynamic";

/** New env names with legacy fallbacks (STRIPE_PRICE_PRO/INVESTOR). */
function monthlyPriceIds(): Record<string, string | undefined> {
  return {
    explorer: process.env.STRIPE_PRICE_EXPLORER ?? process.env.STRIPE_PRICE_PRO,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL ?? process.env.STRIPE_PRICE_INVESTOR,
    institutional: process.env.STRIPE_PRICE_INSTITUTIONAL,
  };
}

/**
 * Annual prices resolve by Stripe lookup_key (prime_atlas_<tier>_annual) rather
 * than an env var per price — one fewer piece of config to wire into Vercel
 * per tier, and the lookup_key <-> tier mapping lives in Stripe itself.
 */
async function annualPriceId(stripe: Stripe, tier: string): Promise<string | undefined> {
  const { data } = await stripe.prices.list({
    lookup_keys: [`prime_atlas_${tier}_annual`],
    active: true,
    limit: 1,
  });
  return data[0]?.id;
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[stripe/checkout] STRIPE_SECRET_KEY is not configured");
    return NextResponse.json({ error: "Payments are not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tier = typeof body.tier === "string" ? body.tier : "";
  const interval = body.interval === "annual" ? "annual" : "monthly";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  const priceId = interval === "annual" ? await annualPriceId(stripe, tier) : monthlyPriceIds()[tier];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas.com";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : (user.email ?? undefined),
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id: user.id, tier, interval },
      // subscription metadata is what the webhook uses to resolve the user —
      // robust against out-of-order event delivery.
      subscription_data: { metadata: { user_id: user.id, tier, interval } },
      success_url: `${appUrl}/dashboard?upgraded=1`,
      cancel_url: `${appUrl}/pricing?cancelled=1`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("[stripe/checkout] session create failed:", message);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
