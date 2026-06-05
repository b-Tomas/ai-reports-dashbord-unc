/**
 * Create incident via the dashboard. Any allowlisted user may create; the
 * "viewers read-only" rule covers editing and deleting existing reports, not
 * creation. The form goes through the same validated data layer as the agent
 * API (`createIncident`), so both write paths share one contract.
 */
import { fail, redirect } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import { createIncident } from '$lib/server/incidentsRepo';
import { parseIncidentForm } from '$lib/domain/incidentForm';
import type { Actions, PageServerLoad } from './$types';

/**
 * Current Córdoba wall-clock as a `datetime-local` value (`YYYY-MM-DDTHH:mm`) to
 * prefill the form. Córdoba is fixed UTC-3, so shifting the instant by -3h and
 * slicing the ISO string yields the local clock without locale quirks.
 */
function cordobaNowLocal(): string {
	return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export const load: PageServerLoad = async () => {
	return { nowLocal: cordobaNowLocal() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const result = parseIncidentForm(await request.formData());
		if (!result.ok) {
			return fail(422, {
				message: 'Revisá los campos marcados.',
				fieldErrors: result.fieldErrors,
				values: result.values
			});
		}

		const report = await createIncident(createServiceClient(), result.data);
		// Land on the new report's detail page (also confirms it persisted).
		throw redirect(303, `/incidents/${report.id}`);
	}
};
