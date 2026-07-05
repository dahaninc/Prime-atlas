/**
 * /api/stripe/setup — card-on-file activation for the free screener quota.
 *
 * POST: creates a Stripe Checkout Session in mode=setup ($0 — the card is
 * vaulted with Stripe, never charged and never touches our servers).
 * GET ?session_id=: return leg from Checkout — verifies the completed session
 * belongs to the caller, flips profiles.payment_method_on_file via the
 * service role (the column is deliberately not client-updatable, see
 * migration 008), then redirects back to /screener. The webhook
 * (checkout.session.completed, mode=setup) is the fallback if the user
 * closes the tab before returning.
 */

import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[stripe/setup] STRIPE_SECRET_KEY is not configured");
    return NextResponse.json({ error: "Payments are not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, payment_method_on_file")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.payment_method_on_file) {
    return NextResponse.json({ error: "Already activated" }, { status: 409 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas.com";

  try {
    // Reuse the Stripe customer if one exists so a later upgrade shares it.
    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      const { error } = await adminClient()
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (error) throw new Error(`could not persist customer id: ${error.message}`);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      payment_method_types: ["card"],
      customer: customerId,
      metadata: { user_id: user.id },
      success_url: `${appUrl}/api/stripe/setup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/screener?setup_cancelled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed";
    console.error("[stripe/setup] session create failed:", message);
    return NextResponse.json({ error: "Could not start card setup. Please try again." }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas.com";
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(`${appUrl}/screener`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/auth/login`);

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Only the session's owner, only a genuinely completed setup session.
    if (
      session.mode === "setup" &&
      session.status === "complete" &&
      session.metadata?.user_id === user.id
    ) {
      const { error } = await adminClient()
        .from("profiles")
        .update({ payment_method_on_file: true })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      return NextResponse.redirect(`${appUrl}/screener?card_saved=1`);
    }
  } catch (err) {
    // Webhook remains the fallback activation path — fail quiet, log loud.
    console.error("[stripe/setup] confirm failed:", err instanceof Error ? err.message : err);
  }

  return NextResponse.redirect(`${appUrl}/screener`);
}
