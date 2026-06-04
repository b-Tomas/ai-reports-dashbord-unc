/**
 * Metrics dashboard (SPEC §5.1 `/metrics`, §3.4). Aggregates `api_usage` over a
 * date range. Visible to any allowlisted user (read-only panel) — the guard
 * already blocks non-allowlisted sessions.
 */
import { createServiceClient } from '$lib/server/supabase';
import { getMetrics, parseRange } from '$lib/server/metricsRepo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const range = parseRange(url.searchParams, new Date());
	try {
		const metrics = await getMetrics(createServiceClient(), range);
		return { range, metrics, loadError: null };
	} catch (e) {
		console.error('[metrics] aggregation failed:', e);
		return {
			range,
			metrics: null,
			loadError: 'No se pudieron cargar las métricas. Intente nuevamente.' as const
		};
	}
};
