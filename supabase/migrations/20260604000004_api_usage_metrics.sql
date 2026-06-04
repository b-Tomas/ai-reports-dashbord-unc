-- Metrics aggregation (SPEC §3.4 / Block 8). Two STABLE functions the /metrics
-- dashboard calls via PostgREST RPC. Aggregating in SQL (not by fetching rows)
-- keeps counts exact regardless of PostgREST's row cap.
--
-- Daily buckets use the display timezone (America/Argentina/Cordoba, SPEC §6) so
-- the time series lines up with what users see elsewhere.

create or replace function public.api_usage_daily(p_from timestamptz, p_to timestamptz)
returns table (
  day date,
  tool_calls bigint,
  retrievals bigint,
  creates bigint,
  errors bigint
)
language sql
stable
as $$
  select
    (created_at at time zone 'America/Argentina/Cordoba')::date as day,
    count(*)                                          as tool_calls,
    count(*) filter (where method = 'GET')           as retrievals,
    count(*) filter (where route = 'create_incident') as creates,
    count(*) filter (where status_code >= 400)        as errors
  from public.api_usage
  where created_at >= p_from and created_at <= p_to
  group by 1
  order by 1;
$$;

create or replace function public.api_usage_by_key(p_from timestamptz, p_to timestamptz)
returns table (
  api_key_id uuid,
  name text,
  tool_calls bigint,
  errors bigint
)
language sql
stable
as $$
  select
    u.api_key_id,
    k.name,
    count(*)                                   as tool_calls,
    count(*) filter (where u.status_code >= 400) as errors
  from public.api_usage u
  left join public.api_keys k on k.id = u.api_key_id
  where u.created_at >= p_from and u.created_at <= p_to
  group by u.api_key_id, k.name
  order by count(*) desc;
$$;
