-- 010: Replay guard for AI-generated opportunities.
--
-- Vercel replayed identical GET invocations of the generation cron, inserting
-- duplicate (municipality, title) rows. Full (non-partial) unique index:
-- PostgREST upsert ON CONFLICT cannot infer partial indexes. No collisions
-- existed in curated rows at creation time (verified).

drop index if exists opportunities_generated_dedupe;
create unique index if not exists opportunities_market_title_unique
  on opportunities (municipality_id, title);
