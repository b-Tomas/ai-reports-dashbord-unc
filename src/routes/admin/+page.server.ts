/**
 * Admin console (SPEC §5.1 `/admin`) — allowlist + API keys. Admin-only:
 * `requireAdmin` guards the load and every action (viewers get 403).
 */
import { fail } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import { requireAdmin } from '$lib/server/auth';
import {
	accessInputSchema,
	addAccess,
	createApiKey,
	listAccess,
	listApiKeys,
	removeAccess,
	revokeApiKey
} from '$lib/server/adminRepo';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const supabase = createServiceClient();
	const [access, keys] = await Promise.all([listAccess(supabase), listApiKeys(supabase)]);
	return { access, keys };
};

export const actions: Actions = {
	addAccess: async ({ request, locals }) => {
		requireAdmin(locals);
		const f = await request.formData();
		const parsed = accessInputSchema.safeParse({
			type: f.get('type'),
			value: f.get('value'),
			role: f.get('role')
		});
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' });
		}
		const res = await addAccess(createServiceClient(), parsed.data, locals.user?.id ?? null);
		if (!res.ok) return fail(res.reason === 'duplicate' ? 409 : 500, { message: res.message });
		return { addedAccess: true };
	},

	removeAccess: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const ok = await removeAccess(createServiceClient(), id);
		if (!ok) return fail(404, { message: 'La entrada no existe.' });
		return { removedAccess: true };
	},

	createKey: async ({ request, locals }) => {
		requireAdmin(locals);
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'El nombre de la clave es obligatorio.' });
		const created = await createApiKey(createServiceClient(), name, locals.user?.id ?? null);
		// Plaintext returned ONCE here — shown by the page, never persisted.
		return { createdKey: created };
	},

	revokeKey: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const ok = await revokeApiKey(createServiceClient(), id);
		if (!ok) return fail(404, { message: 'La clave no existe o ya fue revocada.' });
		return { revokedKey: true };
	}
};
