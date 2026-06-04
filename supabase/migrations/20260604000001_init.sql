-- Incident Reports Dashboard — initial schema (SPEC §3).
--
-- MVP note: NO Row Level Security policies are defined. The SvelteKit server
-- uses the Supabase service-role key for ALL database access (the /api/v1 routes
-- and the dashboard server loads/actions). The anon/public role must NOT be
-- granted access to these tables. RLS is deliberately out of scope for the MVP.
--
-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase runs 15+), so no
-- extension is required.

-- ---------------------------------------------------------------------------
-- Enums (SPEC §3.5)
-- ---------------------------------------------------------------------------
-- Note: incident_type / severity_level / status are NOT DB enums — they live
-- inside the `incidents.data` jsonb and are validated by zod (Block 2), per the
-- "store the JSON" decision (SPEC §2).
create type dashboard_access_type as enum ('email', 'domain');
create type dashboard_access_role as enum ('admin', 'viewer');

-- ---------------------------------------------------------------------------
-- Shared trigger: auto-bump updated_at on every UPDATE
-- ---------------------------------------------------------------------------
-- Guarantees the SPEC §3.1 / §4.4 contract ("PATCH bumps updated_at")
-- regardless of what the application sends.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Immutable ISO-8601 → timestamptz parser (needed for the timestamp index)
-- ---------------------------------------------------------------------------
-- A bare `(data ->> 'timestamp')::timestamptz` cannot be indexed: PostgreSQL
-- treats text→timestamptz as STABLE (it can depend on the session TimeZone for
-- strings WITHOUT an offset). Our payloads are ISO-8601 WITH an explicit offset
-- ('Z' or ±hh:mm) — enforced by zod — so the cast is deterministic and can be
-- safely marked IMMUTABLE. Migration 0003 uses this function for the `event_at`
-- generated column that the API filters/orders on.
create or replace function public.parse_iso_ts(p_text text)
returns timestamptz
language sql
immutable
as $$
  select p_text::timestamptz;
$$;

-- ---------------------------------------------------------------------------
-- incidents (SPEC §3.1 / §3.2)
-- ---------------------------------------------------------------------------
create table public.incidents (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,            -- soft-delete marker; NULL = active
  data       jsonb not null          -- the validated IncidentReport payload
);

create trigger trg_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- Expression indexes for dashboard filters (SPEC §3.1)
create index idx_incidents_incident_type  on public.incidents ((data ->> 'incident_type'));
create index idx_incidents_severity_level on public.incidents ((data ->> 'severity_level'));
create index idx_incidents_status         on public.incidents ((data ->> 'status'));
create index idx_incidents_timestamp      on public.incidents (public.parse_iso_ts(data ->> 'timestamp'));

-- Supports default list ordering and cheap soft-delete exclusion.
create index idx_incidents_created_at on public.incidents (created_at desc);
create index idx_incidents_active     on public.incidents (created_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- api_keys (SPEC §3.3)
-- ---------------------------------------------------------------------------
-- created_by logically references the auth.users(id) of the issuing admin.
-- Kept as a plain uuid (no FK) to avoid coupling to the Supabase auth schema
-- and to preserve the audit row if that user is ever removed.
create table public.api_keys (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                 -- human label, e.g. "langchain-agent-prod"
  key_hash   text not null unique,          -- SHA-256 of the plaintext key; never store plaintext
  key_prefix text not null,                 -- first chars shown in the UI for identification
  created_at timestamptz not null default now(),
  created_by uuid,                          -- admin who issued it (auth.users.id)
  revoked_at timestamptz                    -- NULL = active
);

-- ---------------------------------------------------------------------------
-- api_usage (SPEC §3.4) — the ONLY source of agent metrics.
-- One row per /api/v1/* request (best-effort insert; never blocks the response).
-- ---------------------------------------------------------------------------
create table public.api_usage (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  api_key_id  uuid references public.api_keys (id) on delete set null,  -- NULL if unauthenticated/invalid
  route       text not null,        -- logical name: create_incident, get_incident, list_incidents, update_incident, delete_incident
  method      text not null,        -- HTTP method
  path        text not null,        -- raw request path
  status_code integer not null,
  latency_ms  integer not null,
  incident_id uuid references public.incidents (id) on delete set null   -- incident touched, when applicable
);

create index idx_api_usage_created_at on public.api_usage (created_at desc);
create index idx_api_usage_api_key_id on public.api_usage (api_key_id);
create index idx_api_usage_route      on public.api_usage (route);
create index idx_api_usage_method     on public.api_usage (method);

-- ---------------------------------------------------------------------------
-- dashboard_access (SPEC §3.5) — human-login allowlist (domains + emails).
-- ---------------------------------------------------------------------------
create table public.dashboard_access (
  id         uuid primary key default gen_random_uuid(),
  type       dashboard_access_type not null,   -- 'email' | 'domain'
  value      text not null,                    -- e.g. 'jdoe@unc.edu.ar' or 'unc.edu.ar' (stored lowercase)
  role       dashboard_access_role not null,   -- 'admin' | 'viewer'
  created_at timestamptz not null default now(),
  created_by uuid,                             -- admin who added it (auth.users.id), NULL for bootstrap seed
  unique (type, value)
);
