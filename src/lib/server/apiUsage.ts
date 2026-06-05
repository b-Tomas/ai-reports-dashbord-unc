/**
 * api_usage logging: the only source of agent metrics.
 * One row per /api/v1/* request; inserts are best-effort and must never throw
 * into the response.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ApiUsageRow {
	route: string;
	method: string;
	path: string;
	status_code: number;
	latency_ms: number;
	api_key_id: string | null;
	incident_id: string | null;
}

/**
 * Map an HTTP method + path to the logical route name used for metrics
 * (create_incident / get_incident / list_incidents / update_incident /
 * delete_incident). Unknown /api/v1 paths fall back to their first segment.
 */
export function resolveRouteName(method: string, pathname: string): string {
	const rest = pathname.replace(/^\/api\/v1\/?/, '');
	const parts = rest.split('/').filter(Boolean);
	if (parts[0] === 'incidents') {
		const hasId = parts.length >= 2;
		if (method === 'POST' && !hasId) return 'create_incident';
		if (method === 'GET' && !hasId) return 'list_incidents';
		if (method === 'GET' && hasId) return 'get_incident';
		if (method === 'PATCH' && hasId) return 'update_incident';
		if (method === 'DELETE' && hasId) return 'delete_incident';
	}
	return parts[0] ?? 'unknown';
}

/** Best-effort insert of one usage row. Swallows all errors. */
export async function logApiUsage(supabase: SupabaseClient, row: ApiUsageRow): Promise<void> {
	try {
		await supabase.from('api_usage').insert(row);
	} catch (err) {
		// Logging must never break the request, so swallow but stay observable.
		console.warn('api_usage insert failed', err);
	}
}
