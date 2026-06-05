/**
 * Reports list. Server `load` queries Supabase with the service
 * role (same data layer as the agent API), excluding soft-deleted rows. Filters
 * (type/severity/status/date range) + pagination come from the query string.
 */
import { createServiceClient } from '$lib/server/supabase';
import { listIncidents, parseListParams, type ListResult } from '$lib/server/incidentsRepo';
import type { PageServerLoad } from './$types';

/** Echo of the active filters so the form can repopulate itself. */
export interface ActiveFilters {
	status: string;
	incident_type: string;
	severity_level: string;
	from: string;
	to: string;
}

function readFilters(searchParams: URLSearchParams): ActiveFilters {
	const g = (k: string) => searchParams.get(k) ?? '';
	return {
		status: g('status'),
		incident_type: g('incident_type'),
		severity_level: g('severity_level'),
		from: g('from'),
		to: g('to')
	};
}

export const load: PageServerLoad = async ({ url }) => {
	const filters = readFilters(url.searchParams);
	const parsed = parseListParams(url.searchParams);
	if (!parsed.ok) {
		return { filters, result: null, loadError: 'Algún filtro tiene un valor inválido.' as const };
	}

	try {
		const result: ListResult = await listIncidents(createServiceClient(), parsed.params);
		return { filters, result, loadError: null };
	} catch (e) {
		console.error('[reports] list failed:', e);
		return {
			filters,
			result: null,
			loadError: 'No se pudieron cargar los reportes. Intente nuevamente.' as const
		};
	}
};
