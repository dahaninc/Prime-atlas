-- 010: Replay guard for AI-generated opportunities.
--
-- Vercel replayed identical GET invocations of the generation cron, inserting
-- duplicate (municipality, title) rows. Partial unique index scoped to the
-- generated source so hand-curated rows are unaffected; the route inserts
-- with ON CONFLICT DO NOTHING semantics against this index.

create unique index if not exists opportunities_generated_dedupe
  on opportunities (municipality_id, title)
  where source_name = 'Prime Atlas Intelligence';
