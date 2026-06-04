import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceClient } from '$lib/server/supabase';
import { IncidentReportPatch } from '$lib/domain/incident';
import { apiError, validationError } from '$lib/domain/errors';
import { getIncident, updateIncident, softDeleteIncident, isUuid } from '$lib/server/incidentsRepo';

const notFound = () => json(apiError('not_found', 'Incident not found'), { status: 404 });

// GET /api/v1/incidents/{id} (SPEC §4.2) — soft-deleted ⇒ 404
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!isUuid(params.id)) return notFound();
	const supabase = createServiceClient();
	try {
		const report = await getIncident(supabase, params.id);
		if (!report) return notFound();
		locals.incidentId = report.id;
		return json(report);
	} catch {
		return json(apiError('internal_error', 'Failed to load incident'), { status: 500 });
	}
};

// PATCH /api/v1/incidents/{id} (SPEC §4.4) — partial merge, bumps updated_at
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!isUuid(params.id)) return notFound();
	const supabase = createServiceClient();

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(apiError('bad_request', 'Invalid JSON body'), { status: 400 });
	}

	const parsed = IncidentReportPatch.safeParse(body);
	if (!parsed.success) return json(validationError(parsed.error), { status: 422 });

	try {
		const result = await updateIncident(supabase, params.id, parsed.data);
		if (result.ok) {
			locals.incidentId = result.report.id;
			return json(result.report);
		}
		if (result.reason === 'not_found') return notFound();
		return json(validationError(result.error), { status: 422 });
	} catch {
		return json(apiError('internal_error', 'Failed to update incident'), { status: 500 });
	}
};

// DELETE /api/v1/incidents/{id} (SPEC §4.5) — soft delete, 204
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!isUuid(params.id)) return notFound();
	const supabase = createServiceClient();
	try {
		const deleted = await softDeleteIncident(supabase, params.id);
		if (!deleted) return notFound();
		locals.incidentId = params.id;
		return new Response(null, { status: 204 });
	} catch {
		return json(apiError('internal_error', 'Failed to delete incident'), { status: 500 });
	}
};
