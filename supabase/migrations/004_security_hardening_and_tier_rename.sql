-- ═══════════════════════════════════════════════════════════════════════════
-- prime-atlas · Migration 004 — Security hardening + canonical tier names
-- APPLIED TO LIVE (project vcnpevcmnobpznikahku) on 2026-07-04 via MCP as
-- "security_hardening_and_tier_rename". Kept here so the repo history matches.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 ── Canonical subscription tiers: free / explorer / professional / institutional
--      (verified before applying: zero rows used 'pro' or 'investor')
ALTER TYPE subscription_tier RENAME VALUE 'pro' TO 'explorer';
ALTER TYPE subscription_tier RENAME VALUE 'investor' TO 'professional';

-- 2 ── contact_requests was fully exposed (RLS disabled).
--      Only the server (service role, bypasses RLS) writes it; users may read their own rows.
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own contact requests"
  ON public.contact_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3 ── Paywall bypass fix: users could UPDATE their own subscription_tier via PostgREST.
--      Column-level privileges restrict authenticated updates to safe columns only;
--      Stripe webhook / admin use service role which is unaffected.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, alert_preferences) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Own profile update" ON public.profiles;
CREATE POLICY "Own profile update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4 ── Pin search_path on remaining mutable-path functions
ALTER FUNCTION public.update_updated_at() SET search_path = '';
ALTER FUNCTION public.notify_signal_alert() SET search_path = 'public';
ALTER FUNCTION public.notify_generate_signal_content() SET search_path = 'public';

-- 5 ── SECURITY DEFINER functions were executable by anon via /rest/v1/rpc.
--      Triggers do not require the invoking role to hold EXECUTE, so this is safe.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_signal_alert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_generate_signal_content() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_tier() FROM PUBLIC, anon, authenticated;
