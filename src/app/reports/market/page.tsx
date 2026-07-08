import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Reports | Prime Atlas",
  description:
    "Proprietary market reports for USA and UK real-estate markets — conviction scores, live inventory analytics, demand signals, and interest-rate implications at 3, 5 and 10-year horizons.",
};

/*
 * In-app report generation taken offline for launch (2026-07-09): this
 * report's "underpriced" count is computed from the blended metro median
 * (market_listing_stats.underpriced_count), not the ZIP-comp basis every
 * other surface (Deal Board, Market Feed) now uses — for Charlotte that was
 * 45 vs. Deal Board's real 9, a live in-app contradiction for any logged-in
 * user. Mirrors the report-sharing disable in src/app/actions/share.ts and
 * src/app/s/[token]/page.tsx. Neither generating a new report nor viewing a
 * past one (its stored payload has the same blended-median count baked in)
 * is reachable while this is up. Re-enable once this is migrated onto the
 * ZIP-comp engine (src/lib/comps.ts).
 */
export default async function MarketReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <Navbar user={user ? { email: user.email } : null} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href="/deal-board" className="hover:text-foreground">Deal Board</Link>
          <span>/</span>
          <span>Market Reports</span>
        </nav>

        <div className="border border-border rounded-2xl bg-card p-8 text-center max-w-2xl mx-auto">
          <p className="kicker text-primary mb-2">Prime Atlas · market reports</p>
          <h1 className="text-xl font-bold mb-2">Report generation is temporarily unavailable</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            We&apos;re finishing work on this report&apos;s underlying methodology. In the meantime,
            screen this market&apos;s real, ZIP-comp-verified mispricing on Deal Board.
          </p>
          <Link
            href="/deal-board"
            className="inline-block bg-primary text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-primary/85 transition-colors"
          >
            Open Deal Board →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
