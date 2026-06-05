-- Date-range filtering support for the incidents API.
--
-- PostgREST (and therefore supabase-js) cannot call a function inside a filter,
-- so the parse_iso_ts EXPRESSION index from the initial schema was unusable over
-- the HTTP API. Replace it with a STORED generated column holding the parsed
-- instant, which PostgREST can both filter (?event_at=gte.<value>) and order on,
-- backed by an index.
-- parse_iso_ts is IMMUTABLE, which generated columns require.

drop index if exists public.idx_incidents_timestamp;

alter table public.incidents
  add column event_at timestamptz
  generated always as (public.parse_iso_ts(data ->> 'timestamp')) stored;

create index idx_incidents_event_at on public.incidents (event_at desc);
