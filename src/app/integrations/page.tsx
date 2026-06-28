import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AppMarketplace } from "@/components/integrations/AppMarketplace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Integrations | prime-atlas",
  description:
    "Connect data sources, AI tools, and analytics integrations to your Prime Atlas workspace. Zillow, Rightmove, Land Registry, IC Memo AI and more.",
};

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier: "free" | "pro" | "investor" | "institutional" = "free";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tier = ((profile as any)?.subscription_tier ?? "free") as typeof tier;
  }

  return (
    <>
      <Navbar user={user} />
      <AppMarketplace userTier={tier} isLoggedIn={!!user} />
      <Footer />
    </>
  );
}
