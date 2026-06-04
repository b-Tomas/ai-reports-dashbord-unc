/**
 * Incident detail (SPEC §5.1 `/incidents/{id}`). Read for everyone allowlisted;
 * admins can change `status` and soft-delete. Both actions go through the shared
 * incidents data layer (same logic as the agent API) and are admin-guarded
 * server-side — the viewer UI just hides the controls.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import { requireAdmin } from '$lib/server/auth';
import { getIncident, isUuid, softDeleteIncident, updateIncident } from '$lib/server/incidentsRepo';
import { statusSchema } from '$lib/domain/incident';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!isUuid(params.id)) throw error(404, 'Reporte no encontrado.');
	const report = await getIncident(createServiceClient(), params.id);
	if (!report) throw error(404, 'Reporte no encontrado.');
	return { report };
};

export const actions: Actions = {
	updateStatus: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const parsed = statusSchema.safeParse(form.get('status'));
		if (!parsed.success) return fail(400, { message: 'Estado inválido.' });

		const res = await updateIncident(createServiceClient(), params.id, { status: parsed.data });
		if (!res.ok) {
			return fail(res.reason === 'not_found' ? 404 : 400, {
				message:
					res.reason === 'not_found' ? 'Reporte no encontrado.' : 'No se pudo actualizar el estado.'
			});
		}
		return { updated: true };
	},

	softDelete: async ({ params, locals }) => {
		requireAdmin(locals);
		const ok = await softDeleteIncident(createServiceClient(), params.id);
		if (!ok) return fail(404, { message: 'Reporte no encontrado o ya eliminado.' });
		// Removed from active reports → back to the list.
		throw redirect(303, '/');
	}
};
