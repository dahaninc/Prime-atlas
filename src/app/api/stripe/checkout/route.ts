/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for tier upgrades.
 * Body: { tier: "pro" | "investor" | "institutional" }
 */

import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs"; // Stripe SDK requires Node

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
  const PRICE_IDS: Record<string, string | undefined> = {
    pro:            process.env.STRIPE_PRICE_PRO,
    investor:       process.env.STRIPE_PRICE_INVESTOR,
    institutional:  process.env.STRIPE_PRICE_INSTITUTIONAL,
  };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tier = body.tier as string;
  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas.com";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : (user.email ?? undefined),
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: user.id, tier },
    subscription_data: { metadata: { user_id: user.id, tier } },
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url:  `${appUrl}/pricing?cancelled=1`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
