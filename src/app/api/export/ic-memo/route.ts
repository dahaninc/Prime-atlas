/**
 * POST /api/export/ic-memo
 *
 * Compiles the Deal Board's structured memo payload into a Word-editable
 * document (.doc — HTML interchange format Word opens natively for editing,
 * which committees require for internal debt-structuring notes). Rendering
 * itself lives in src/lib/icMemoTemplate.ts (pure, unit-tested) — this route
 * is just auth, gating, and payload validation.
 *
 * Gating is enforced SERVER-SIDE: anonymous -> 401, below-entitlement -> 403
 * with upgrade flag. This is the platform's bulk/data export capability per
 * src/lib/entitlements.ts, so it's Institutional-only — Explorer and
 * Professional no longer get it (previously any paid tier could export).
 * The client button is a convenience, not the security boundary.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canBulkExport } from "@/lib/entitlements";
import { buildMemoHtml, type MemoPayload } from "@/lib/icMemoTemplate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles").select("subscription_tier").eq("id", user.id).single();
  const tier = profile?.subscription_tier ?? "free";
  if (!canBulkExport(tier)) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        requiredTier: "institutional",
        message: "Investment Analysis Report export is an Institutional feature.",
      },
      { status: 403 },
    );
  }

  let p: MemoPayload;
  try {
    p = (await req.json()) as MemoPayload;
    if (!p?.market?.name || !p?.scores) throw new Error("bad payload");
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const html = buildMemoHtml(p);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword",
      "Content-Disposition": `attachment; filename="investment-analysis-${p.market.slug || "market"}.doc"`,
      "Cache-Control": "no-store",
    },
  });
}
