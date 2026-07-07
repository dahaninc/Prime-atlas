import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing | Prime Atlas — USA & UK Investment Intelligence",
  description:
    "Explorer $29.99/mo · Professional $69.99/mo · Institutional $89.99/mo. Cross-market real estate investment intelligence for USA and UK.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; upgraded?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentTier = "free";
  let hasCustomer = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, stripe_customer_id")
      .eq("id", user.id)
      .single();
    currentTier = profile?.subscription_tier ?? "free";
    hasCustomer = !!profile?.stripe_customer_id;
  }

  const params = await searchParams;

  return (
    <>
      <Navbar user={user} />
      <PricingClient
        isLoggedIn={!!user}
        currentTier={currentTier}
        hasCustomer={hasCustomer}
        cancelled={!!params.cancelled}
        upgraded={!!params.upgraded}
      />
      <Footer />
    </>
  );
}
