import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FinderClient } from "./FinderClient";

export const metadata: Metadata = {
  title: "Opportunity Finder | prime-atlas Pro",
  description: "Input your budget, geography, and risk profile. Get a ranked list of investment opportunities with AI-generated theses.",
};

export default async function FinderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?redirect=/opportunities/finder");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = (profile as { subscription_tier?: string } | null)?.subscription_tier ?? "free";

  if (tier === "free") {
    redirect("/pricing?upgrade=pro&from=finder");
  }

  // Fetch available geo options and categories for the form
  const [{ data: geoRows }, { data: catRows }] = await Promise.all([
    supabase
      .from("municipalities")
      .select("name, region, country")
      .in("country", ["United Kingdom", "United States"])
      .order("country").order("region").order("name"),
    supabase.from("opportunities").select("category").eq("status", "active"),
  ]);

  type GeoRow = { country: string; region: string; name: string };
  type CatRow = { category: string };

  const geoOptions = ((geoRows as unknown as GeoRow[]) ?? []).map((r) => ({
    country: r.country,
    region:  r.region,
    city:    r.name,
  }));
  const uniqueCategories = Array.from(new Set(((catRows as unknown as CatRow[]) ?? []).map((c) => c.category)));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
          Prime Atlas · Opportunity Finder
        </p>
        <h1 className="text-4xl font-bold mb-2">Opportunity Finder</h1>
        <p className="text-muted-foreground text-sm">
          Tell us what you&apos;re looking for. We&apos;ll return a ranked, scored list of investment opportunities — personalised to your objective and risk profile.
        </p>
      </div>

      <FinderClient geoOptions={geoOptions} categories={uniqueCategories} />
    </main>
  );
}
