-- ═══════════════════════════════════════════════════════════════════════════
-- prime-atlas · Migration 005 — Full-gallery sync marker
-- APPLIED TO LIVE on 2026-07-04 via MCP as "gallery_synced_marker".
-- ═══════════════════════════════════════════════════════════════════════════

-- Marks properties whose detail page has been fetched for the full photo
-- gallery. The enrich cron targets rows where this is NULL, so every property
-- gets exactly one full-gallery pass without refetch loops.
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS gallery_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_properties_gallery_pending
  ON public.properties (updated_at) WHERE gallery_synced_at IS NULL;
