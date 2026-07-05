-- 008: Card-on-file activation for the free screener quota.
--
-- Free users must vault a card with Stripe (Checkout mode=setup, $0 charge)
-- before their 3 free analyses/month activate. The flag is set ONLY by
-- service-role code (Stripe webhook / setup-confirm route): migration 004
-- already revoked client UPDATE on profiles except (full_name,
-- alert_preferences), so this column is not user-settable by construction.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_method_on_file boolean NOT NULL DEFAULT false;

-- Paying subscribers necessarily have a card on file.
UPDATE profiles
  SET payment_method_on_file = true
  WHERE subscription_tier <> 'free';
