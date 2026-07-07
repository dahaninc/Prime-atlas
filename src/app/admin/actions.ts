"use server";

import { createClient as createSsrClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/auth/admins";

const VALID_TIERS = ["free", "explorer", "professional", "institutional"] as const;
type Tier = (typeof VALID_TIERS)[number];

/**
 * Admin-only tier override — replaces the manual "run this SQL against
 * production" step that used to be the only way to change a user's tier.
 */
export async function setUserTier(
  userId: string,
  tier: string
): Promise<{ ok: boolean; error?: string }> {
  const ssrClient = await createSsrClient();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return { ok: false, error: "Not authorised" };
  }
  if (!VALID_TIERS.includes(tier as Tier)) {
    return { ok: false, error: "Invalid tier" };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_tier: tier })
    .eq("id", userId);

  if (error) {
    console.error("[setUserTier]", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
