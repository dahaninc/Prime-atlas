"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Join the undervalued-property waitlist (all markets). Any authenticated
 * user may join — email notifications are sent by the deal-alerts cron to
 * paid tiers only, which is what "activates with membership" means.
 */
export async function joinWaitlist(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("underpriced_waitlist")
    .upsert(
      { user_id: user.id, municipality_id: null },
      { onConflict: "user_id,municipality_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/deal-board");
  return { ok: true };
}

export async function leaveWaitlist(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("underpriced_waitlist")
    .delete()
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/deal-board");
  return { ok: true };
}
