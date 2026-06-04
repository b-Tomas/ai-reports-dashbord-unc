import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceClient } from '$lib/server/supabase';
import { IncidentReportCreate } from '$lib/domain/incident';
import { apiError, validationError } from '$lib/domain/errors';
import { createIncident, listIncidents, parseListParams } from '$lib/server/incidentsRepo';

// POST /api/v1/incidents — create (SPEC §4.1)
export const POST: RequestHandler = async ({ request, locals }) => {
	const supabase = createServiceClient();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(apiError('bad_request', 'Invalid JSON body'), { status: 400 });
	}

	const parsed = IncidentReportCreate.safeParse(body);
	if (!parsed.success) return json(validationError(parsed.error), { status: 422 });

	try {
		const report = await createIncident(supabase, parsed.data);
		locals.incidentId = report.id; // for the api_usage log
		return json(report, { status: 201 });
	} catch {
		return json(apiError('internal_error', 'Failed to create incident'), { status: 500 });
	}
};

// GET /api/v1/incidents — list with filters + pagination (SPEC §4.3)
export const GET: RequestHandler = async ({ url }) => {
	const supabase = createServiceClient();

	const parsed = parseListParams(url.searchParams);
	if (!parsed.ok)
		return json(validationError(parsed.error, 'Invalid query parameters'), { status: 400 });

	try {
		return json(await listIncidents(supabase, parsed.params));
	} catch {
		return json(apiError('internal_error', 'Failed to list incidents'), { status: 500 });
	}
};
