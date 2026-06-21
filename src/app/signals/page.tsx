import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { SignalsFeed } from "@/components/signals/SignalsFeed";

export const metadata: Metadata = {
  title: "Live Signals | prime-atlas",
  description:
    "Real-time investment signals for Spain. Infrastructure approvals, employer relocations, planning applications, and development zone announcements — before they move the market.",
};

export const revalidate = 0; // always fresh for signals

export default async function SignalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Initial signals — SSR for first paint
  const { data: initialSignals } = await supabase
    .from("signals")
    .select("*, municipalities(id, name, region)")
    .order("detected_at", { ascending: false })
    .limit(50);

  const isPro = user
    ? await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single()
        .then(({ data }) => data?.subscription_tier !== "free")
    : false;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">
            prime-atlas · Real-time
          </p>
          <h1 className="text-4xl font-bold mb-2">Live Signals</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Infrastructure approvals, employer relocations, planning decisions, and development zone
            announcements — detected and scored before they move the market.
          </p>
        </div>

        {!user && (
          <Link
            href="/auth/signup"
            className="flex-shrink-0 bg-pa-green text-pa-navy font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors"
          >
            Subscribe to alerts →
          </Link>
        )}
      </div>

      {/* Free tier notice */}
      {(!user || !isPro) && (
        <div className="mb-6 p-4 border border-pa-amber/30 bg-pa-amber/5 rounded-xl flex items-start gap-3">
          <svg className="w-4 h-4 text-pa-amber flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-pa-amber">Signals shown with 48hr delay on Free tier</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link href="/pricing?upgrade=pro" className="text-pa-green hover:underline">Upgrade to Pro</Link>
              {" "}for real-time signals + email alerts the moment they are detected.
            </p>
          </div>
        </div>
      )}

      {/* Live feed */}
      <SignalsFeed
        initialSignals={initialSignals ?? []}
        isPro={isPro}
        userId={user?.id}
      />
    </main>
  );
}
