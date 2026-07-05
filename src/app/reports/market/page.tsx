import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ReportClient } from "./ReportClient";
import { getReportQuota } from "./actions";
import type { MarketReport } from "@/lib/marketReport";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Reports | Prime Atlas",
  description:
    "Proprietary market reports for USA and UK real-estate markets — conviction scores, live inventory analytics, demand signals, and interest-rate implications at 3, 5 and 10-year horizons.",
};

export default async function MarketReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: munis }, { data: reports }, quota] = await Promise.all([
    supabase
      .from("municipalities")
      .select("id, name, region, country")
      .in("country", ["United Kingdom", "United States"])
      .order("name"),
    user
      ? supabase
          .from("deal_board_reports")
          .select("id, created_at, payload")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    getReportQuota(),
  ]);

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

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="kicker text-primary">Deal Board · market reports</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Proprietary market reports</h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
            Pick a covered market and get the numbers an investment committee asks for —
            conviction scores, live inventory and mispricing analytics, demand signals, and
            interest-rate implications at 3, 5 and 10-year horizons. Computed from live
            Prime Atlas data. Analytics, not investment advice.
          </p>
        </div>

        <ReportClient
          markets={(munis ?? []) as { id: string; name: string; region: string; country: string }[]}
          pastReports={((reports ?? []) as { id: string; created_at: string; payload: unknown }[]).map((r) => ({
            id: r.id,
            created_at: r.created_at,
            payload: r.payload as MarketReport,
          }))}
          quotaUsed={quota.used}
          quotaLimit={quota.limit}
          unlimited={quota.unlimited}
        />
      </main>
      <Footer />
    </>
  );
}
