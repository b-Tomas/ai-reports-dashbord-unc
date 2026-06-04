# Database migrations

SQL migrations for the Incident Reports Dashboard. Schema follows `PRD/SPEC.md` §3.

| File                                              | Creates                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `migrations/20260604000001_init.sql`              | Enums, `incidents` / `api_keys` / `api_usage` / `dashboard_access`, indexes, triggers. |
| `migrations/20260604000002_seed_super_admin.sql`  | `ensure_super_admin()` function + bootstrap call (seeds the first admin).              |
| `migrations/20260604000003_incident_event_at.sql` | `incidents.event_at` generated column + index for API date-range filtering.            |
| `migrations/20260604000004_api_usage_metrics.sql` | `api_usage_daily()` / `api_usage_by_key()` aggregation functions for `/metrics`.       |

## MVP notes

- **No RLS.** No Row Level Security policies are defined. The SvelteKit server uses the
  Supabase **service-role** key for all DB access (the `/api/v1` routes and the dashboard
  server loads/actions). Do **not** grant the anon/public role access to these tables.
- **Date filtering.** `incidents.event_at` is a `STORED` generated column equal to
  `public.parse_iso_ts(data->>'timestamp')`, indexed by `idx_incidents_event_at` (migration
  0003). The API filters and orders on `event_at` directly, since PostgREST can't call a
  function inside a filter. Safe because payload timestamps are ISO-8601 **with an explicit
  offset** (`Z` or `±hh:mm`), enforced by zod, making the cast deterministic.
- `gen_random_uuid()` is built into PostgreSQL 13+ (Supabase runs 15+) — no extension needed.

## Applying the migrations

### Option A — Supabase CLI (recommended)

```bash
# One-time, from the repo root:
supabase init                 # only if supabase/config.toml does not exist yet
supabase link --project-ref <your-project-ref>

# Apply all migrations to the linked project:
supabase db push
```

For local development against the bundled Postgres:

```bash
supabase start                # boots local Postgres + Studio
supabase db reset             # applies every migration from scratch
```

### Option B — Supabase SQL editor

In the Supabase dashboard → **SQL Editor**, paste and run each file **in filename order**:

1. `migrations/20260604000001_init.sql`
2. `migrations/20260604000002_seed_super_admin.sql`

(Migrations are designed to run **once**; re-running `init` will error on the existing types/tables.)

## Seeding the first admin

The first admin comes from `SUPER_ADMIN_EMAIL` (`SPEC.md` §6). Seeding is idempotent:
`ensure_super_admin()` only inserts when **no admin exists yet**, and stores the email
lowercased.

**Recommended — call the function directly** (SQL editor or `psql`), after applying migrations:

```sql
select public.ensure_super_admin('you@unc.edu.ar');
```

**Alternative — auto-seed at apply time** via a database setting. `20260604000002` reads
`app.super_admin_email` and seeds if present (no-op when unset). Set it in the same session
before applying that file:

```sql
set app.super_admin_email = 'you@unc.edu.ar';
\i migrations/20260604000002_seed_super_admin.sql
```

> The runtime app (a later block) reads `SUPER_ADMIN_EMAIL` from the environment and calls
> `ensure_super_admin()` on boot — the same single seeding mechanism.

## Verify

```sql
\dt public.*                                   -- 4 tables
select indexname from pg_indexes where tablename = 'incidents';
select type, value, role from public.dashboard_access;   -- one email/admin row
```
