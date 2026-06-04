# Incident Reports Dashboard — Specification

**Project:** Incident report CRUD API + human dashboard for an FCEFyN (UNC) university lab.
**Status:** MVP. Optimize for "small and dead simple."
**Owner:** tomas@mi.unc.edu.ar
**Last updated:** 2026-06-04

---

## 1. Overview

A SvelteKit application, hosted on Netlify, that:

1. Exposes a versioned REST API (`/api/v1/...`) for CRUD of laboratory incident reports. A **separate** LangChain agent project consumes this API via tool calls.
2. Provides a human web **dashboard** for lab staff to view, filter, edit, and delete reports, plus visualize agent API-usage metrics.
3. Records **agent metrics** derivable purely from API usage (no access to the agent's internals).

Branding: FCEFyN and UNC logos (`PRD/FCEFyN.png`, `PRD/UNC.jpg`). Content domain is Spanish (UNC Safety Manual); API keys are English, enum values are Spanish per the manual.

### Non-goals (MVP)

- No agent-internal telemetry (the agent is a separate codebase; we only see API traffic).
- No real-time updates / websockets.
- No multi-lab tenancy (single lab).
- No rate limiting (noted as future work).
- No file/attachment uploads on reports.

---

## 2. Tech Stack & Decisions

| Concern         | Choice                                    | Rationale                                                                                                                                           |
| --------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | SvelteKit                                 | Requested.                                                                                                                                          |
| Hosting         | Netlify (`@sveltejs/adapter-netlify`)     | Requested.                                                                                                                                          |
| DB + Auth       | **Supabase** (Postgres + Supabase Auth)   | Single provider for DB **and** human auth; official SvelteKit guide; simpler setup than Turso + Auth0 (which needs two services glued via Auth.js). |
| Supabase client | `@supabase/supabase-js` + `@supabase/ssr` | Official SvelteKit SSR auth pattern. On Netlify functions use the HTTP client (PostgREST), not raw Postgres TCP, to avoid connection exhaustion.    |
| Validation      | `zod`                                     | Strict payload validation on writes.                                                                                                                |
| Charts          | Chart.js (Svelte wrapper) — _swappable_   | Lightweight; sufficient for MVP panels.                                                                                                             |
| Styling         | Tailwind CSS (or plain CSS)               | Fast, themeable to FCEFyN palette.                                                                                                                  |

**Decision — data shape:** Report content stored as a single `jsonb` blob ("store the JSON"). Only minimal operational columns live outside the blob: `id`, `created_at`, `updated_at`, `deleted_at`. Filtering for the dashboard uses Postgres `jsonb` operators / expression indexes.

**Decision — human auth:** Supabase Auth, **Google OAuth only**. Access gated by an **admin-managed allowlist** (domains + individual emails).

**Decision — agent auth:** Static **API keys** (Bearer), managed in an `api_keys` table by an admin. Each API call is attributed to a key, enabling per-agent metrics.

**Decision — roles:** Two roles, `admin` and `viewer`. First admin seeded from env (`SUPER_ADMIN_EMAIL`).

---

## 3. Data Model

### 3.1 `incidents`

| Column       | Type               | Notes                                              |
| ------------ | ------------------ | -------------------------------------------------- |
| `id`         | `uuid` PK          | Server-generated (`gen_random_uuid()`).            |
| `created_at` | `timestamptz`      | Server insert time.                                |
| `updated_at` | `timestamptz`      | Updated on PATCH.                                  |
| `deleted_at` | `timestamptz` NULL | Soft-delete marker. NULL = active.                 |
| `data`       | `jsonb`            | The validated `IncidentReport` payload (see §3.2). |

Recommended expression indexes for dashboard filters:
`(data->>'incident_type')`, `(data->>'severity_level')`, `(data->>'status')`, `((data->>'timestamp')::timestamptz)`.

### 3.2 `IncidentReport` payload (the `data` jsonb) — canonical contract

> This is the contract the separate LangChain agent must produce. **Typos in `PRD/reports-format.md` are corrected here and this spec wins.**

| Field                         | Type              | Required | Notes                                                  |
| ----------------------------- | ----------------- | -------- | ------------------------------------------------------ |
| `timestamp`                   | string (ISO 8601) | **Yes**  | When the incident occurred/was reported.               |
| `location`                    | string            | **Yes**  | Lab/area, e.g. `"Laboratorio Central - Mesa 4"`.       |
| `incident_type`               | enum              | **Yes**  | `DERRAME` \| `INCENDIO` \| `EXPOSICION` \| `FUGA_GAS`. |
| `severity_level`              | enum              | **Yes**  | `BAJO` \| `MEDIO` \| `ALTO` \| `CRITICO`.              |
| `chemicals_involved`          | array<Chemical>   | No       | Defaults to `[]`.                                      |
| `actions_taken`               | array<string>     | **Yes**  | Min 1 item.                                            |
| `medical_assistance_required` | boolean           | **Yes**  |                                                        |
| `status`                      | enum              | **Yes**  | `ABIERTO` \| `EN_PROGRESO` \| `RESUELTO`.              |

**`Chemical` sub-object**

| Field                | Type   | Required | Notes                                                                                       |
| -------------------- | ------ | -------- | ------------------------------------------------------------------------------------------- |
| `name`               | string | **Yes**  | e.g. `"Ácido Acético Glacial"`.                                                             |
| `hazard_class`       | string | No       | **Renamed** from doc's `simplt_class`. Hazard class per manual, e.g. `"Clase B y Clase E"`. |
| `estimated_quantity` | string | No       | e.g. `"250 ml"`, `"Desconocido"`.                                                           |

`id`, `created_at` are returned on read but are **not** part of the writable payload (they live as columns; the API merges them into the returned object).

### 3.3 `api_keys`

| Column       | Type               | Notes                                                        |
| ------------ | ------------------ | ------------------------------------------------------------ |
| `id`         | `uuid` PK          |                                                              |
| `name`       | text               | Human label, e.g. "langchain-agent-prod".                    |
| `key_hash`   | text               | Store a hash (e.g. SHA-256) of the key, never the plaintext. |
| `key_prefix` | text               | First chars shown in UI for identification.                  |
| `created_at` | `timestamptz`      |                                                              |
| `created_by` | uuid               | Admin who issued it.                                         |
| `revoked_at` | `timestamptz` NULL | NULL = active.                                               |

Plaintext key shown **once** at creation. Format suggestion: `irk_<random>`.

### 3.4 `api_usage` (metrics source)

One row per `/api/v1/*` request. This is the **only** source of agent metrics.

| Column        | Type          | Notes                                                                                                    |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| `id`          | `uuid` PK     |                                                                                                          |
| `created_at`  | `timestamptz` | Request time.                                                                                            |
| `api_key_id`  | uuid NULL     | FK → `api_keys`. NULL if unauthenticated/invalid.                                                        |
| `route`       | text          | Logical name: `create_incident`, `get_incident`, `list_incidents`, `update_incident`, `delete_incident`. |
| `method`      | text          | HTTP method.                                                                                             |
| `path`        | text          | Raw path.                                                                                                |
| `status_code` | int           | Response status.                                                                                         |
| `latency_ms`  | int           | Server-measured.                                                                                         |
| `incident_id` | uuid NULL     | Incident touched, when applicable.                                                                       |

**Derived dashboard metrics:**

- **Tool calls** = total `api_usage` rows (1 endpoint hit = 1 tool call).
- **Retrievals** = rows where `method = GET` (`get_incident` + `list_incidents`).
- **Creates** = rows where `route = create_incident`.
- **Error rate** = `status_code >= 400` / total.
- Time series of the above; breakdown per `api_key_id`.

### 3.5 `dashboard_access` (allowlist)

| Column       | Type          | Notes                                            |
| ------------ | ------------- | ------------------------------------------------ |
| `id`         | `uuid` PK     |                                                  |
| `type`       | enum          | `email` \| `domain`.                             |
| `value`      | text          | e.g. `jdoe@unc.edu.ar` or `unc.edu.ar`.          |
| `role`       | enum          | `admin` \| `viewer`. Applied to matching logins. |
| `created_at` | `timestamptz` |                                                  |
| `created_by` | uuid NULL     |                                                  |

**Bootstrap:** On deploy, seed one `email`/`admin` row from `SUPER_ADMIN_EMAIL` if the table has no admin. A logging-in user's role = best match (exact email > domain); no match ⇒ access denied.

---

## 4. API Specification (`/api/v1`)

All `/api/v1/*` endpoints:

- Require `Authorization: Bearer <api_key>`. Missing/invalid/revoked ⇒ `401`. The request is still logged to `api_usage` (with `api_key_id = NULL`).
- Are logged to `api_usage` via a SvelteKit `handle` hook wrapping the route group.
- Return JSON. Errors use `{ "error": { "code", "message", "details"? } }`.

**Permission matrix**

| Endpoint                               | Agent (API key) | Dashboard human          |
| -------------------------------------- | --------------- | ------------------------ |
| `POST /incidents` (create)             | ✅              | ✅ (admin/viewer via UI) |
| `GET /incidents/{id}` (read)           | ✅              | ✅                       |
| `GET /incidents` (list)                | ✅              | ✅                       |
| `PATCH /incidents/{id}` (update)       | ✅              | ✅                       |
| `DELETE /incidents/{id}` (soft-delete) | ✅              | ✅ **admin only**        |

> Agent (API key) has **full CRUD**: create, read, update, soft-delete. Among humans, soft-delete via the dashboard is **admin-only** (viewers read-only — see §8). Dashboard humans act through server-side load/actions authenticated by Supabase session, not via Bearer keys; the agent acts via Bearer key. Both paths hit the same server-side DB logic.

### 4.1 `POST /api/v1/incidents`

- **Body:** `IncidentReportCreate` (§3.2 writable fields).
- **Validation:** strict zod. On failure ⇒ `422` with field-level `details` so the agent can self-correct.
- **201:** full `IncidentReport` incl. `id`, `created_at`.

### 4.2 `GET /api/v1/incidents/{id}`

- **200:** `IncidentReport`. Soft-deleted ⇒ `404` (to agent).
- **404:** unknown id.

### 4.3 `GET /api/v1/incidents`

- **Query params:** `status`, `incident_type`, `severity_level`, `from` (ISO), `to` (ISO), `limit` (default 25, max 100), `offset`.
- Excludes soft-deleted by default.
- **200:** `{ "items": [IncidentReport], "total": int, "limit": int, "offset": int }`.

### 4.4 `PATCH /api/v1/incidents/{id}` (agent + human)

- Partial update; common case is `status` transition (`ABIERTO → EN_PROGRESO → RESUELTO`). Merged into `data`, validated against schema. Updates `updated_at`.
- Allowed for valid API-key callers **and** dashboard humans.
- **200:** updated `IncidentReport`. **422** invalid patch. **404** unknown/deleted.

### 4.5 `DELETE /api/v1/incidents/{id}` (agent + admin human)

- **Soft delete:** sets `deleted_at = now()`. Row retained.
- Allowed for valid API-key callers **and** admin dashboard humans (dashboard viewers: not allowed → `403`).
- **204** on success. **404** unknown/already-deleted.

### 4.6 Example create payload

```json
{
	"timestamp": "2026-06-04T18:30:00Z",
	"location": "Laboratorio Central - Mesa 4",
	"incident_type": "DERRAME",
	"severity_level": "MEDIO",
	"chemicals_involved": [
		{
			"name": "Ácido Acético Glacial",
			"hazard_class": "Clase B y Clase E",
			"estimated_quantity": "250 ml"
		}
	],
	"actions_taken": [
		"Se alertó a todos los presentes y se procedió a evacuar el área inmediata.",
		"Se utilizó equipo de protección personal (guantes y antiparras).",
		"Se vertió material adsorbente alrededor del perímetro del derrame para neutralizar."
	],
	"medical_assistance_required": false,
	"status": "RESUELTO"
}
```

---

## 5. Dashboard (human UI)

Auth: Supabase session; access gated by `dashboard_access` allowlist; role drives capabilities.

### 5.1 Routes / views

- `/login` — Supabase Auth, **Google OAuth only**. Non-allowlisted ⇒ access-denied screen.
- `/` (Reports) — paginated table. Columns: timestamp, location, incident_type, severity_level, status, medical flag. **Filters:** type, severity, status, date range. Click row → detail.
- `/incidents/{id}` — full detail incl. chemicals + actions. Actions: **admin** can edit `status` and soft-delete; **viewer** is read-only.
- `/metrics` — agent API-usage panel: tool calls / retrievals / creates over time, error rate, breakdown per API key.
- `/admin` (admin only) — manage `dashboard_access` allowlist (add/remove email/domain + role) and `api_keys` (issue / revoke; plaintext shown once).
- `/admin/trash` (admin only) — **trash view**: lists soft-deleted reports (`deleted_at` not null). Per row: **restore** (clear `deleted_at`) or **permanently delete** (hard `DELETE` of the row, with confirm). Not reachable by viewers.

### 5.2 UX

- Branding header with FCEFyN + UNC logos; theme uses the official FCEFyN palette (§5.3).
- Severity rendered with color cues (e.g. `CRITICO` red).
- Responsive: table usable on mobile (stacked/cards under sm breakpoint).
- Loading + empty + error states for every data view.
- Spanish UI labels (domain is Spanish).

### 5.3 Theme palette (from fcefyn.unc.edu.ar)

Extracted from the faculty site's `style.css` (Bulma defaults excluded). Define as CSS variables / Tailwind theme tokens.

| Token            | Hex       | Use                                     |
| ---------------- | --------- | --------------------------------------- |
| `--teal-primary` | `#205650` | Primary brand: navbar, headers, buttons |
| `--teal-alt`     | `#2c5f66` | Secondary teal surfaces                 |
| `--teal-dark`    | `#19433f` | Hover/active, dark accents              |
| `--gold`         | `#ddcf82` | Accent: highlights, badges, focus       |
| `--gold-alt`     | `#d8c76e` | Accent variant                          |
| `--gold-dark`    | `#746720` | Accent text on light bg                 |
| `--text`         | `#363636` | Body text                               |
| `--bg`           | `#f5f5f5` | Page background                         |
| `--surface`      | `#ffffff` | Cards/tables                            |
| `--border`       | `#dbdbdb` | Borders                                 |
| `--muted`        | `#707070` | Muted text                              |

Severity cues (independent of brand): `BAJO` green, `MEDIO` `--gold`, `ALTO` orange, `CRITICO` red.

---

## 6. Security & Operational Notes

- API keys stored hashed; plaintext shown once. Revocation via `revoked_at`.
- `SUPABASE_SERVICE_ROLE_KEY` used **server-side only**, never shipped to client.
- All write validation server-side (never trust client/agent).
- Soft-delete preserves audit trail; hard purge is out of scope.
- `api_usage` logging must not block the response on failure (best-effort insert; swallow logging errors).
- Timezone: store UTC; display America/Argentina/Cordoba.
- **Rate limiting:** out of scope for MVP. `[TBD]` if abuse appears.

### Environment variables

```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPER_ADMIN_EMAIL
# Google OAuth configured in Supabase Auth dashboard
```

---

## 7. Acceptance Criteria

- [ ] `POST /api/v1/incidents` with valid Bearer key + valid body ⇒ `201` + stored row with server `id`/`created_at`.
- [ ] Invalid payload (bad enum, missing required, empty `actions_taken`) ⇒ `422` with field-level details.
- [ ] Missing/invalid/revoked key ⇒ `401`; request still recorded in `api_usage` with null key.
- [ ] `GET /api/v1/incidents/{id}` returns the report; soft-deleted ⇒ `404`.
- [ ] `GET /api/v1/incidents` filters by type/severity/status/date and paginates; excludes soft-deleted.
- [ ] Valid API-key caller can PATCH (status transition persists, bumps `updated_at`) and DELETE (soft-delete sets `deleted_at`).
- [ ] Dashboard **viewer** attempting delete ⇒ `403`; **admin** can delete.
- [ ] Every `/api/v1/*` hit creates one `api_usage` row with route, method, status, latency, key attribution.
- [ ] Dashboard login allows only allowlisted users; role correctly derived (email > domain).
- [ ] Admin can add/remove allowlist entries and issue/revoke API keys; plaintext key shown once.
- [ ] Reports table filters + detail render; admin can soft-delete; status edits persist + bump `updated_at`.
- [ ] `/metrics` shows tool calls, retrievals, creates, error rate over time, per-key breakdown — all derived from `api_usage`.
- [ ] Admin `/admin/trash` lists soft-deleted reports; restore clears `deleted_at` (report reappears in lists); permanent delete removes the row after confirm. Viewers cannot reach it.
- [ ] Human login is Google OAuth only.
- [ ] Theme applies FCEFyN palette tokens (§5.3); deploys to Netlify; first admin seeded from `SUPER_ADMIN_EMAIL`.
- [ ] FCEFyN + UNC branding present.

---

## 8. Resolved Decisions

All interview questions resolved — no open items.

1. **Viewer rights:** viewers are strictly read-only; only admins edit `status` and delete.
2. **Charts:** Chart.js.
3. **Soft-deleted reports:** retained and viewable by admins in `/admin/trash` (restore or permanently delete); hidden from normal lists and from the agent API.
4. **Human login:** Google OAuth only.
