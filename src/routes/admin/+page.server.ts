/**
 * Admin console for the allowlist and API keys. Admin-only:
 * `requireAdmin` guards the load and every action (viewers get 403).
 */
import { fail } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import { requireAdmin } from '$lib/server/auth';
import {
	accessInputSchema,
	addAccess,
	clearUserRole,
	createApiKey,
	listAccess,
	listApiKeys,
	removeAccess,
	revokeApiKey,
	setUserRole
} from '$lib/server/adminRepo';
import { listDashboardUsers } from '$lib/server/usersRepo';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const supabase = createServiceClient();
	const access = await listAccess(supabase);
	const [keys, users] = await Promise.all([
		listApiKeys(supabase),
		listDashboardUsers(supabase, access)
	]);
	return { access, keys, users, currentEmail: locals.user?.email ?? null };
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
		// Plaintext returned once here, shown by the page, never persisted.
		return { createdKey: created };
	},

	revokeKey: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const ok = await revokeApiKey(createServiceClient(), id);
		if (!ok) return fail(404, { message: 'La clave no existe o ya fue revocada.' });
		return { revokedKey: true };
	},

	// Set/override a single user's role (writes an exact-email allowlist row).
	setUserRole: async ({ request, locals }) => {
		requireAdmin(locals);
		const f = await request.formData();
		const email = String(f.get('email') ?? '')
			.trim()
			.toLowerCase();
		const role = String(f.get('role') ?? '');
		if (!email.includes('@')) return fail(400, { message: 'Email inválido.' });
		if (role !== 'admin' && role !== 'viewer') return fail(400, { message: 'Rol inválido.' });
		// Self-lockout guard: an admin cannot downgrade their own account.
		if (email === locals.user?.email?.toLowerCase() && role !== 'admin') {
			return fail(400, { message: 'No puede quitarse a sí mismo el rol de administrador.' });
		}
		await setUserRole(createServiceClient(), email, role, locals.user?.id ?? null);
		return { userRoleUpdated: true };
	},

	// Revert a user to their domain default (deletes their email override).
	clearUserRole: async ({ request, locals }) => {
		requireAdmin(locals);
		const email = String((await request.formData()).get('email') ?? '')
			.trim()
			.toLowerCase();
		// Self-lockout guard: reverting could drop the current admin's own access.
		if (email === locals.user?.email?.toLowerCase()) {
			return fail(400, { message: 'No puede revertir su propio acceso.' });
		}
		const ok = await clearUserRole(createServiceClient(), email);
		if (!ok) return fail(404, { message: 'El usuario no tiene un rol explícito.' });
		return { userRoleCleared: true };
	}
};
