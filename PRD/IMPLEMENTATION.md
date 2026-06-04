# Implementation Plan — Incident Reports Dashboard

Build blocks for `SPEC.md`. Ordered by dependency. Each block is a self-contained unit you can feed to a coding agent: it states **context** (which SPEC sections to read), **scope**, **out of scope**, **deliverables**, and a **done check**. Hand them over one at a time, in order — later blocks assume earlier ones exist.

## Shared conventions (give the agent once, up front)

- Stack: SvelteKit + `@sveltejs/adapter-netlify`, TypeScript, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), `zod`, Chart.js, Tailwind CSS. See `SPEC.md` §2.
- Server-only secrets via `$env/static/private` / `$env/dynamic/private`; never import `SUPABASE_SERVICE_ROLE_KEY` into client code.
- API contract is `SPEC.md` §3.2 — it wins over `PRD/reports-format.md`.
- All error responses: `{ "error": { "code", "message", "details"? } }`.
- Spanish UI labels; English code/keys.
- Keep it MVP-simple. No feature creep beyond the block's scope.

Dependency graph: `0 → 1 → 2 → {3, 5} → {4 (needs 3), 6 (needs 5)} → {7, 8 (need 6)} → 9`.

---

## Block 0 — Project scaffold & theme tokens

**Context:** SPEC §2, §5.2, §5.3.
**Scope:**

- Init SvelteKit (TS) app, add `adapter-netlify`, `netlify.toml`.
- Add deps: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `chart.js`, Tailwind.
- Configure Tailwind with FCEFyN palette tokens from §5.3 (CSS variables + Tailwind theme colors).
- `.env.example` with all vars from §6. App shell layout (`+layout.svelte`) with branding header placeholder (FCEFyN + UNC logos from `PRD/`).
- Base global styles: bg `#f5f5f5`, text `#363636`.

**Out of scope:** Any DB, auth, or routes beyond an empty home page.
**Deliverables:** Running `npm run dev` shell with themed header; `npm run build` passes with Netlify adapter.
**Done check:** Dev server renders a branded empty shell; palette tokens usable as Tailwind classes (e.g. `bg-teal-primary`).

---

## Block 1 — Database schema & migrations

**Context:** SPEC §3 (all subsections), §6 (bootstrap).
**Scope:**

- Supabase migration SQL for tables: `incidents`, `api_keys`, `api_usage`, `dashboard_access` (exact columns/types per §3).
- `gen_random_uuid()` defaults; expression indexes on `incidents` per §3.1.
- Seed logic: insert `dashboard_access` row (`email`, role `admin`) from `SUPER_ADMIN_EMAIL` if no admin exists.
- Document how to run migrations (Supabase CLI or SQL editor).

**Out of scope:** RLS policies (server uses service role for MVP — note this), app code.
**Deliverables:** `supabase/migrations/*.sql`, short README on applying them + seeding.
**Done check:** Applying migrations on a fresh Supabase project creates all tables/indexes and seeds the admin row.

---

## Block 2 — Domain layer (zod schemas & types)

**Context:** SPEC §3.2 (canonical contract).
**Scope:**

- `zod` schemas: `Chemical`, `IncidentReportCreate` (writable fields), `IncidentReportPatch` (partial), and enum schemas (`incident_type`, `severity_level`, `status`).
- Inferred TS types exported for reuse.
- A `toIncidentReport(row)` helper that merges DB columns (`id`, `created_at`) with `data` jsonb into the API response shape.
- Helper to format zod errors into the `error.details` shape.

**Out of scope:** HTTP handlers, DB calls.
**Deliverables:** `src/lib/domain/incident.ts` (or similar) with schemas, types, helpers; unit tests for valid/invalid payloads (incl. empty `actions_taken`, bad enum).
**Done check:** Tests pass; invalid payloads produce field-level error details.

---

## Block 3 — API auth + usage logging hook

**Context:** SPEC §3.3, §3.4, §4 (intro + permission matrix).
**Scope:**

- `hooks.server.ts` `handle` that, for `/api/v1/*`: reads `Authorization: Bearer`, hashes and looks up in `api_keys` (reject revoked), attaches `locals.apiKey`.
- Wraps the request to measure `latency_ms` and write one `api_usage` row (route name, method, path, status, key id or null, incident_id when set by the handler) — best-effort, must not throw into the response.
- Returns `401` for missing/invalid/revoked key (still logs with null key).
- Server-side Supabase client factory (service role) for API routes.

**Out of scope:** The incident endpoints themselves (Block 4), human session auth (Block 5).
**Deliverables:** Auth/logging hook, key-hashing util, service-role client helper.
**Done check:** A protected stub route returns `401` without a key, `200` with a valid seeded key, and every call appears in `api_usage`.

---

## Block 4 — Incidents CRUD API (`/api/v1/incidents`)

**Context:** SPEC §4.1–§4.6, §3, plus Blocks 2 & 3.
**Scope:**

- `POST /api/v1/incidents` — validate (Block 2), insert, `201` full report.
- `GET /api/v1/incidents/{id}` — `200` / `404` (soft-deleted ⇒ `404`).
- `GET /api/v1/incidents` — filters (`status`, `incident_type`, `severity_level`, `from`, `to`), pagination (`limit`/`offset`), excludes soft-deleted, returns `{items,total,limit,offset}`.
- `PATCH /api/v1/incidents/{id}` — partial merge into `data`, validate, bump `updated_at`.
- `DELETE /api/v1/incidents/{id}` — soft delete (`deleted_at=now()`), `204`.
- Agent (API key) is allowed all five (full CRUD). Set `incident_id` on the request for the usage log where applicable.

**Out of scope:** Dashboard UI, permanent delete (that's the trash view, Block 7).
**Deliverables:** `src/routes/api/v1/incidents/...` endpoints; an HTTP test or `.http`/curl collection covering the §7 API acceptance criteria.
**Done check:** All `/api/v1` acceptance criteria in §7 pass against a live dev server with a seeded key.

---

## Block 5 — Human auth (Google OAuth + allowlist + roles)

**Context:** SPEC §2 (human auth), §3.5, §5.1 (`/login`), §6.
**Scope:**

- Supabase SSR auth wiring (`@supabase/ssr`) in `hooks.server.ts` (compose with Block 3's hook); session in `locals`.
- Google OAuth login flow; `/login` page and callback.
- Allowlist gate: on session, match user email against `dashboard_access` (exact email > domain). No match ⇒ access-denied page. Derive role (`admin`/`viewer`) into `locals`.
- Route guard for all dashboard routes (everything except `/login` and `/api/v1/*`).

**Out of scope:** Dashboard content pages (Blocks 6–8).
**Deliverables:** Auth hook integration, `/login` + access-denied pages, `locals.user`/`locals.role`, a `requireAdmin` helper.
**Done check:** Non-allowlisted Google account is denied; allowlisted email/domain logs in with correct role.

---

## Block 6 — Dashboard: reports list & detail

**Context:** SPEC §5.1 (`/`, `/incidents/{id}`), §5.2, §3.
**Scope:**

- `/` reports table: columns + filters (type/severity/status/date range) + pagination, server `load` querying Supabase (service role, server-side), excluding soft-deleted. Severity color cues (§5.3).
- `/incidents/{id}` detail: full report incl. chemicals + actions.
- Admin-only actions on detail: edit `status` (form action → PATCH logic) and soft-delete; viewers see read-only.
- Loading/empty/error states; responsive table.

**Out of scope:** Metrics, admin allowlist/keys, trash.
**Deliverables:** Reports list + detail routes with server loads and admin form actions.
**Done check:** Filters/pagination work; admin can change status + soft-delete (row leaves the list); viewer sees no mutating controls.

---

## Block 7 — Admin: allowlist, API keys, trash

**Context:** SPEC §5.1 (`/admin`, `/admin/trash`), §3.3, §3.5, §8.
**Scope:**

- `/admin` (admin-only): manage `dashboard_access` (add/remove email|domain + role); manage `api_keys` (issue → show plaintext once, store hash + prefix; revoke via `revoked_at`).
- `/admin/trash` (admin-only): list soft-deleted reports; **restore** (clear `deleted_at`); **permanent delete** (hard row delete, with confirm).
- Guard all with `requireAdmin`.

**Out of scope:** Metrics.
**Deliverables:** Admin routes + form actions for allowlist, keys, trash.
**Done check:** Admin issues a key (shown once) and it authenticates against Block 4; restore/permanent-delete behave per §7; viewers get `403`/redirect.

---

## Block 8 — Metrics dashboard

**Context:** SPEC §3.4 (derived metrics), §5.1 (`/metrics`).
**Scope:**

- `/metrics` server load aggregating `api_usage`: total tool calls, retrievals (GET), creates (POST), error rate (status ≥ 400), time series, and per-`api_key_id` breakdown.
- Chart.js panels for the above. Date-range control.

**Out of scope:** Anything writing to `api_usage` (that's Block 3).
**Deliverables:** `/metrics` route with aggregation queries + Chart.js panels.
**Done check:** Generating API traffic (via Block 4) updates the charts; counts match raw `api_usage` rows.

---

## Block 9 — Branding polish & Netlify deploy

**Context:** SPEC §2, §5.2, §5.3, §6, §7.
**Scope:**

- Finalize header/footer with FCEFyN + UNC logos and full palette application.
- Netlify deploy config + env var documentation; verify build/runtime on Netlify (Supabase HTTP client, not raw TCP).
- README: setup, env, migrations, seeding admin, issuing an agent key, local dev, deploy.

**Out of scope:** New features.
**Deliverables:** Deploy-ready repo, README, passing `npm run build`.
**Done check:** Fresh clone → follow README → deploys to Netlify; all §7 acceptance criteria verifiable end-to-end.
