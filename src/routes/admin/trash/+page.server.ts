/**
 * Trash view (SPEC §5.1 `/admin/trash`, §8) — soft-deleted reports. Admin-only:
 * `requireAdmin` guards the load and both actions. Restore clears `deleted_at`
 * (report reappears in lists); permanent delete removes the row for good.
 */
import { fail } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import { requireAdmin } from '$lib/server/auth';
import {
	hardDeleteIncident,
	listDeletedIncidents,
	restoreIncident
} from '$lib/server/incidentsRepo';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return { items: await listDeletedIncidents(createServiceClient()) };
};

export const actions: Actions = {
	restore: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const ok = await restoreIncident(createServiceClient(), id);
		if (!ok) return fail(404, { message: 'El reporte no está en la papelera.' });
		return { restored: true };
	},

	hardDelete: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const ok = await hardDeleteIncident(createServiceClient(), id);
		if (!ok) return fail(404, { message: 'El reporte no está en la papelera.' });
		return { purged: true };
	}
};
