/**
 * Incident data-access layer (SPEC §3, §4). The agent API routes and the Block 6
 * dashboard server actions both go through here — "same server-side DB logic".
 *
 * Soft-deleted rows (`deleted_at IS NOT NULL`) are excluded from every read and
 * mutation; they are only reachable via the trash view (Block 7).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
	IncidentReportCreate,
	incidentTypeSchema,
	severityLevelSchema,
	statusSchema,
	toIncidentReport,
	type IncidentReport,
	type IncidentReportData,
	type IncidentReportPatch
} from '../domain/incident';

const TABLE = 'incidents';
const COLUMNS = 'id, created_at, updated_at, data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
	return UUID_RE.test(value);
}

function fail(error: unknown): never {
	// supabase-js rejects with a PostgrestError plain object ({ message, details,
	// hint, code }), not an Error — so `String(error)` would be "[object Object]".
	// Pull out the useful fields instead.
	let message: string;
	if (error instanceof Error) {
		message = error.message;
	} else if (error && typeof error === 'object') {
		const e = error as { message?: string; details?: string; hint?: string; code?: string };
		message = [e.message, e.details, e.hint, e.code && `(${e.code})`].filter(Boolean).join(' — ');
		if (!message) message = JSON.stringify(error);
	} else {
		message = String(error);
	}
	throw new Error(`incidents repo: ${message}`);
}

// ---------------------------------------------------------------------------
// List query parsing (SPEC §4.3)
// ---------------------------------------------------------------------------
export interface ListParams {
	status?: string;
	incident_type?: string;
	severity_level?: string;
	from?: string;
	to?: string;
	limit: number;
	offset: number;
}

export interface ListResult {
	items: IncidentReport[];
	total: number;
	limit: number;
	offset: number;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// Accept either a full offset datetime (e.g. 2026-01-01T00:00:00Z) or a date-only
// ISO string (e.g. 2026-01-01). Date-only values are normalized to explicit UTC
// bounds below so results don't depend on server timezone.
const isoInstantOrDate = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

const listFilterSchema = z.object({
	status: statusSchema.optional(),
	incident_type: incidentTypeSchema.optional(),
	severity_level: severityLevelSchema.optional(),
	from: isoInstantOrDate.optional(),
	to: isoInstantOrDate.optional()
});

/** Expand a date-only `from` to the start of that UTC day; pass instants through. */
function normalizeFrom(v: string | undefined): string | undefined {
	return !v || v.includes('T') ? v : `${v}T00:00:00Z`;
}

/** Expand a date-only `to` to the inclusive end of that UTC day; pass instants through. */
function normalizeTo(v: string | undefined): string | undefined {
	return !v || v.includes('T') ? v : `${v}T23:59:59.999Z`;
}

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
	if (raw === undefined) return def;
	const n = Number.parseInt(raw, 10);
	if (Number.isNaN(n)) return def;
	return Math.min(Math.max(n, min), max);
}

/** Parse + validate list query params. Bad filter/date values yield a ZodError (→ 400). */
export function parseListParams(
	searchParams: URLSearchParams
): { ok: true; params: ListParams } | { ok: false; error: z.ZodError } {
	const get = (k: string) => {
		const v = searchParams.get(k);
		return v && v.trim() !== '' ? v : undefined;
	};
	const filters = listFilterSchema.safeParse({
		status: get('status'),
		incident_type: get('incident_type'),
		severity_level: get('severity_level'),
		from: get('from'),
		to: get('to')
	});
	if (!filters.success) return { ok: false, error: filters.error };
	return {
		ok: true,
		params: {
			...filters.data,
			from: normalizeFrom(filters.data.from),
			to: normalizeTo(filters.data.to),
			limit: clampInt(get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT),
			offset: clampInt(get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
		}
	};
}

/** Merge a partial patch over the existing report's writable data (provided fields replace). */
export function mergePatch(
	existing: IncidentReport,
	patch: IncidentReportPatch
): IncidentReportData {
	// Drop operational columns; keep only the writable payload, then overlay the patch.
	const { id: _id, created_at: _c, updated_at: _u, ...data } = existing;
	void _id;
	void _c;
	void _u;
	return { ...data, ...patch } as IncidentReportData;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
export async function createIncident(
	supabase: SupabaseClient,
	data: IncidentReportData
): Promise<IncidentReport> {
	const { data: row, error } = await supabase.from(TABLE).insert({ data }).select(COLUMNS).single();
	if (error || !row) fail(error);
	return toIncidentReport(row);
}

export async function getIncident(
	supabase: SupabaseClient,
	id: string
): Promise<IncidentReport | null> {
	const { data: row, error } = await supabase
		.from(TABLE)
		.select(COLUMNS)
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();
	if (error) fail(error);
	return row ? toIncidentReport(row) : null;
}

export async function listIncidents(
	supabase: SupabaseClient,
	params: ListParams
): Promise<ListResult> {
	let query = supabase.from(TABLE).select(COLUMNS, { count: 'exact' }).is('deleted_at', null);
	if (params.status) query = query.eq('data->>status', params.status);
	if (params.incident_type) query = query.eq('data->>incident_type', params.incident_type);
	if (params.severity_level) query = query.eq('data->>severity_level', params.severity_level);
	if (params.from) query = query.gte('event_at', params.from);
	if (params.to) query = query.lte('event_at', params.to);
	query = query
		.order('event_at', { ascending: false })
		.range(params.offset, params.offset + params.limit - 1);

	const { data: rows, count, error } = await query;
	if (error) fail(error);
	return {
		items: (rows ?? []).map(toIncidentReport),
		total: count ?? 0,
		limit: params.limit,
		offset: params.offset
	};
}

export type UpdateResult =
	| { ok: true; report: IncidentReport }
	| { ok: false; reason: 'not_found' }
	| { ok: false; reason: 'invalid'; error: z.ZodError };

export async function updateIncident(
	supabase: SupabaseClient,
	id: string,
	patch: IncidentReportPatch
): Promise<UpdateResult> {
	const existing = await getIncident(supabase, id);
	if (!existing) return { ok: false, reason: 'not_found' };

	// Re-validate the FULL merged report so it can never become invalid.
	const merged = IncidentReportCreate.safeParse(mergePatch(existing, patch));
	if (!merged.success) return { ok: false, reason: 'invalid', error: merged.error };

	const { data: row, error } = await supabase
		.from(TABLE)
		.update({ data: merged.data })
		.eq('id', id)
		.is('deleted_at', null)
		.select(COLUMNS)
		.single();
	if (error || !row) fail(error);
	return { ok: true, report: toIncidentReport(row) };
}

/** Soft delete: set deleted_at. Returns false if unknown or already deleted. */
export async function softDeleteIncident(supabase: SupabaseClient, id: string): Promise<boolean> {
	const { data: rows, error } = await supabase
		.from(TABLE)
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', id)
		.is('deleted_at', null)
		.select('id');
	if (error) fail(error);
	return (rows?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Trash view (SPEC §5.1 `/admin/trash`, §8) — soft-deleted rows only.
// ---------------------------------------------------------------------------
const TRASH_COLUMNS = 'id, created_at, updated_at, deleted_at, data';

/** A soft-deleted report, carrying the deletion timestamp for the trash UI. */
export type DeletedIncident = IncidentReport & { deleted_at: string };

/** List soft-deleted reports, newest deletion first. */
export async function listDeletedIncidents(supabase: SupabaseClient): Promise<DeletedIncident[]> {
	const { data: rows, error } = await supabase
		.from(TABLE)
		.select(TRASH_COLUMNS)
		.not('deleted_at', 'is', null)
		.order('deleted_at', { ascending: false });
	if (error) fail(error);
	return (rows ?? []).map((row) => ({
		...toIncidentReport(row),
		deleted_at: row.deleted_at instanceof Date ? row.deleted_at.toISOString() : row.deleted_at
	}));
}

/** Restore a soft-deleted report (clear deleted_at). Returns false if not in trash. */
export async function restoreIncident(supabase: SupabaseClient, id: string): Promise<boolean> {
	const { data: rows, error } = await supabase
		.from(TABLE)
		.update({ deleted_at: null })
		.eq('id', id)
		.not('deleted_at', 'is', null)
		.select('id');
	if (error) fail(error);
	return (rows?.length ?? 0) > 0;
}

/** Permanently delete a row — only if it is already in the trash (soft-deleted). */
export async function hardDeleteIncident(supabase: SupabaseClient, id: string): Promise<boolean> {
	const { data: rows, error } = await supabase
		.from(TABLE)
		.delete()
		.eq('id', id)
		.not('deleted_at', 'is', null)
		.select('id');
	if (error) fail(error);
	return (rows?.length ?? 0) > 0;
}
