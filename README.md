# Panel de Reportes de Incidentes — FCEFyN, UNC

Dashboard for laboratory incident reports. A separate LangChain agent writes
reports over a Bearer-key REST API (`/api/v1`); humans review them in a Google-
OAuth dashboard gated by an admin-managed allowlist. Full contract in
[`PRD/SPEC.md`](PRD/SPEC.md); build plan in [`PRD/IMPLEMENTATION.md`](PRD/IMPLEMENTATION.md).

## Stack

SvelteKit 2 (Svelte 5 runes) · TypeScript · Tailwind CSS v4 · Supabase
(Postgres + Auth + PostgREST) · Chart.js · `@sveltejs/adapter-netlify`.

The server uses the Supabase **service-role** key for all DB access (no RLS).
Agents authenticate with hashed API keys; humans with Google OAuth + the
`dashboard_access` allowlist (role = exact-email match beats domain match).

## Routes

| Route               | Who            | Purpose                                       |
| ------------------- | -------------- | --------------------------------------------- |
| `/`                 | allowlisted    | Reports list — filters + pagination           |
| `/incidents/{id}`   | allowlisted    | Detail; admins edit status + soft-delete      |
| `/metrics`          | allowlisted    | API-usage charts (from `api_usage`)           |
| `/admin`            | **admin**      | Allowlist + API keys (issue/revoke)           |
| `/admin/trash`      | **admin**      | Soft-deleted reports: restore / purge         |
| `/login`, `/auth/*` | public         | Google OAuth                                  |
| `/api/v1/incidents` | agent (Bearer) | CRUD — see [`api.http`](api.http) and SPEC §4 |

## Setup

```sh
npm install
cp .env.example .env   # fill in the Supabase values
npm run dev            # http://localhost:5173
```

### Environment variables

| Var                         | Notes                                           |
| --------------------------- | ----------------------------------------------- |
| `PUBLIC_SUPABASE_URL`       | Project URL (safe on client).                   |
| `PUBLIC_SUPABASE_ANON_KEY`  | Anon key (safe on client).                      |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Never ship to the client.      |
| `SUPER_ADMIN_EMAIL`         | First admin, seeded on boot if no admin exists. |

Google OAuth is configured in the **Supabase Auth dashboard** (provider + redirect
URLs), not via app env vars.

### Database

Migrations live in [`supabase/migrations`](supabase/migrations) (details in
[`supabase/README.md`](supabase/README.md)):

```sh
supabase db push        # apply to the linked project
```

### First admin

With `SUPER_ADMIN_EMAIL` set, the app seeds it on the first request. To seed
manually (no redeploy), run in the Supabase SQL editor:

```sql
select public.ensure_super_admin('you@unc.edu.ar');
```

The email must match the Google account you sign in with. Only seeds when the
allowlist has no admin yet; manage further entries from `/admin`.

### Issuing an agent API key

`/admin` → **Claves de API** → _Emitir clave_. The plaintext is shown **once**;
copy it. Use it as `Authorization: Bearer <key>` against `/api/v1` (try the
requests in [`api.http`](api.http)). Revoke from the same screen.

## Develop

```sh
npm run check    # svelte-check (types)
npm run test     # vitest unit tests
npm run lint     # prettier + eslint
npm run build    # production build (adapter-netlify)
```

## Deploy (Netlify)

`netlify.toml` builds with `@sveltejs/adapter-netlify` (serverless functions, so
Supabase is reached over HTTP — not raw TCP). Set the four env vars above in the
Netlify site settings, then deploy. After deploy, sign in with the
`SUPER_ADMIN_EMAIL` account to bootstrap the first admin.
