import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScreenerClient } from "./ScreenerClient";
import { getQuota } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deal Screener | Prime Atlas",
  description:
    "Turn a listing into an editable pro-forma, then score it against your own saved criteria. NOI, cap rate, DSCR, cash-on-cash, sensitivity — calculations from your inputs, not investment advice.",
};

export default async function ScreenerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: criteria }, { data: analyses }, quota] = await Promise.all([
    supabase
      .from("screener_criteria")
      .select("id, name, target_cap_pct, min_dscr, max_price_per_unit, target_coc_pct, hold_years")
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
    user
      ? supabase
          .from("screener_analyses")
          .select("id, name, created_at, inputs, outputs")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
    getQuota(),
  ]);

  return (
    <>
      <Navbar user={user ? { email: user.email } : null} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="kicker text-primary">Deal Screener · US module · UK in validation</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Screen a deal in 90 seconds</h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
            Enter (or parse) a deal, get an editable pro-forma — NOI, cap rate, DSCR,
            cash-on-cash, sensitivity — then check it against your saved criteria.
            Every number is computed from your inputs. Nothing here is investment advice.
          </p>
        </div>

        <ScreenerClient
          savedCriteria={criteria ?? null}
          pastAnalyses={((analyses ?? []) as {
            id: string; name: string | null; created_at: string;
            inputs: unknown; outputs: unknown;
          }[]).map((a) => ({
            id: a.id,
            name: a.name,
            created_at: a.created_at,
            inputs: a.inputs as Record<string, number>,
            outputs: a.outputs as Record<string, number>,
          }))}
          quotaUsed={quota.used}
          quotaLimit={quota.limit}
          unlimited={quota.unlimited}
          cardOnFile={quota.cardOnFile}
        />
      </main>
      <Footer />
    </>
  );
}
