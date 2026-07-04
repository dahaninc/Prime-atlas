import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { cn, scoreColor } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard | prime-atlas" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/dashboard");

  const params = await searchParams;

  const [profileRes, watchlistsRes, signalsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, subscription_tier, subscription_period_end")
      .eq("id", user.id)
      .single(),

    supabase
      .from("watchlists")
      .select(`
        id, name,
        watchlist_items (
          id, municipality_id,
          municipalities ( id, name, region, opportunity_score )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at"),

    supabase
      .from("signals")
      .select("id, title, signal_type, opportunity_impact, detected_at, municipalities!inner(name, region, country)")
      .in("municipalities.country", ["United Kingdom", "United States"])
      .order("detected_at", { ascending: false })
      .limit(8),
  ]);

  const profile    = profileRes.data;
  const watchlists = watchlistsRes.data ?? [];
  const signals    = signalsRes.data ?? [];

  const tier  = profile?.subscription_tier ?? "free";
  const isPro = tier !== "free";

  // Collect all watched municipalities, deduplicated, sorted by score
  const seen = new Set<string>();
  const uniqueWatched = watchlists
    .flatMap((wl) => wl.watchlist_items)
    .map((item) => item.municipalities)
    .filter((m): m is NonNullable<typeof m> => {
      if (!m || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0));

  const totalItems = watchlists.reduce((acc, wl) => acc + wl.watchlist_items.length, 0);

  return (
    <>
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Upgrade banner */}
        {params.upgraded && (
          <div className="mb-8 p-4 border border-pa-green/40 bg-pa-green/5 rounded-xl">
            <p className="text-pa-green font-semibold text-sm">
              🎉 Welcome to prime-atlas {tier.charAt(0).toUpperCase() + tier.slice(1)}!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your access is now active.{" "}
              <Link href="/opportunities/finder" className="text-pa-green hover:underline">
                Try the Opportunity Finder →
              </Link>
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">Dashboard</p>
          <h1 className="text-3xl font-bold">
            {profile?.full_name
              ? `Welcome back, ${profile.full_name.split(" ")[0]}.`
              : "Your intelligence hub."}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left 2/3 ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Watchlists", value: watchlists.length },
                { label: "Tracked",    value: totalItems },
                { label: "Tier",       value: tier.charAt(0).toUpperCase() + tier.slice(1) },
              ].map(({ label, value }) => (
                <div key={label} className="border border-border bg-card rounded-xl px-4 py-4">
                  <p className="font-mono font-bold text-2xl text-pa-green">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Watched municipalities */}
            <div className="border border-border bg-card rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm">Your watched municipalities</h2>
                <Link href="/watchlists" className="text-xs text-pa-green hover:underline">Manage →</Link>
              </div>
              {uniqueWatched.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No municipalities tracked yet.</p>
                  <Link href="/watchlists" className="text-xs text-pa-green hover:underline">
                    Add to watchlist →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {uniqueWatched.slice(0, 6).map((m) => (
                    <Link
                      key={m.id}
                      href={`/opportunities/${m.name.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "")}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/20 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.region}</p>
                      </div>
                      <span className={cn("font-mono font-bold text-sm", scoreColor(m.opportunity_score))}>
                        {m.opportunity_score}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent signals */}
            <div className="border border-border bg-card rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm">Recent signals</h2>
                <Link href="/signals" className="text-xs text-pa-green hover:underline">
                  {isPro ? "Live feed →" : "View (48hr delay) →"}
                </Link>
              </div>
              <div className="divide-y divide-border">
                {signals.slice(0, 5).map((s) => {
                  const muni = s.municipalities as { name: string; region: string } | null;
                  return (
                    <div key={s.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {muni?.name ?? "—"} · {s.signal_type.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className={cn(
                          "font-mono text-xs font-bold flex-shrink-0",
                          s.opportunity_impact >= 75
                            ? "text-pa-green"
                            : s.opportunity_impact >= 50
                            ? "text-amber-400"
                            : "text-muted-foreground"
                        )}>
                          {s.opportunity_impact}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right 1/3 ── */}
          <div className="space-y-4">
            {/* Subscription card */}
            <div className="border border-border bg-card rounded-xl p-5">
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">Subscription</p>
              <span className={cn(
                "inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3",
                isPro
                  ? "bg-pa-green/10 text-pa-green border border-pa-green/30"
                  : "bg-secondary text-muted-foreground border border-border"
              )}>
                {tier.toUpperCase()}
              </span>
              {profile?.subscription_period_end && (
                <p className="text-xs text-muted-foreground mb-3">
                  Renews{" "}
                  {new Date(profile.subscription_period_end).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              )}
              {isPro ? (
                <form action="/api/stripe/portal" method="POST">
                  <button
                    type="submit"
                    className="w-full text-xs border border-border text-muted-foreground py-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Manage subscription →
                  </button>
                </form>
              ) : (
                <Link
                  href="/pricing"
                  className="block w-full text-center text-xs bg-primary text-white font-bold py-2.5 rounded-lg hover:bg-primary/85 transition-colors"
                >
                  Upgrade to Pro →
                </Link>
              )}
            </div>

            {/* Quick actions */}
            <div className="border border-border bg-card rounded-xl p-5">
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">Quick actions</p>
              <div className="space-y-2">
                {[
                  { href: "/deal-board",           label: "Deal Board",          pro: false },
                  { href: "/opportunities/finder", label: "Opportunity Finder",  pro: true },
                  { href: "/signals",              label: "Signals feed",        pro: true },
                  { href: "/rankings",             label: "Rankings",            pro: false },
                  { href: "/watchlists",           label: "Watchlists",          pro: false },
                  { href: "/capital",              label: "prime-atlas Capital", pro: false },
                ].map(({ href, label, pro }) => (
                  <Link
                    key={href}
                    href={pro && !isPro ? "/pricing" : href}
                    className="flex items-center justify-between text-sm py-1 text-muted-foreground hover:text-pa-green transition-colors"
                  >
                    <span>→ {label}</span>
                    {pro && !isPro && (
                      <span className="text-xs text-amber-400 font-medium">Pro</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
