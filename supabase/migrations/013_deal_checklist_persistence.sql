-- ═══════════════════════════════════════════════════════════════
-- 013 · Deal Board conviction-checklist persistence
-- Checklist ticks on the Deal Board were client-state only (lost on
-- reload / not synced across devices). Persist per-user, per-market,
-- per-checklist-item as a join table — one row per checked item.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.deal_checklist_items (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  checklist_key   TEXT NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, municipality_id, checklist_key)
);
ALTER TABLE public.deal_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own checklist items" ON public.deal_checklist_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_user ON public.deal_checklist_items (user_id);
