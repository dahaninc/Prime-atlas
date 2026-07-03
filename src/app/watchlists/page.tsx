import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { WatchlistsClient } from "@/components/watchlists/WatchlistsClient";
import { AlertPreferences } from "@/components/watchlists/AlertPreferences";

export const metadata: Metadata = { title: "Watchlists | prime-atlas" };

export default async function WatchlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/watchlists");

  const params = await searchParams;

  // Fetch watchlists + items + related municipalities + opportunities
  const { data: watchlists } = await supabase
    .from("watchlists")
    .select(`
      id, name, created_at,
      watchlist_items (
        id, municipality_id, opportunity_id, created_at,
        municipalities ( id, name, region, opportunity_score ),
        opportunities ( id, title, opportunity_score, category, risk_level )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at");

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, alert_preferences")
    .eq("id", user.id)
    .single();

  // Fetch all municipalities for "add to watchlist" picker
  const { data: municipalities } = await supabase
    .from("municipalities")
    .select("id, name, region, opportunity_score")
    .in("country", ["United Kingdom", "United States"])
    .order("opportunity_score", { ascending: false });

  const isPro = profile?.subscription_tier !== "free";

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
          prime-atlas · Your account
        </p>
        <h1 className="text-4xl font-bold mb-2">Watchlists</h1>
        <p className="text-muted-foreground text-sm">
          Track municipalities and opportunities. Get email alerts when new signals are detected.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WatchlistsClient
            initialWatchlists={watchlists ?? []}
            municipalities={municipalities ?? []}
            preAddMunicipalityId={params.add}
            isPro={isPro}
          />
        </div>
        <div>
          <AlertPreferences
            initialPrefs={(profile?.alert_preferences as {
              email_alerts: boolean;
              signal_threshold: number;
              alert_frequency: "immediate" | "daily" | "weekly";
            }) ?? { email_alerts: true, signal_threshold: 60, alert_frequency: "daily" }}
            isPro={isPro}
          />
        </div>
      </div>
    </main>
  );
}
