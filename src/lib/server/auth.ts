/**
 * Human (dashboard) auth helpers (SPEC §2, §3.5, §5.1).
 *
 * Login is Google OAuth via Supabase Auth. Access is gated by the
 * `dashboard_access` allowlist: a logging-in user's role is the best match —
 * exact email beats domain — and no match means access denied.
 */
import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'admin' | 'viewer';

/** Where an effective role came from: an exact-email override, a domain rule, or no match. */
export type AccessSource = 'email' | 'domain' | null;
export interface EffectiveAccess {
	role: Role | null;
	source: AccessSource;
}

/**
 * Pure best-match of an email against dashboard_access rows: an exact `email`
 * entry wins over a `domain` entry; no match ⇒ `{ role: null, source: null }`.
 * Single source of truth for precedence — used by `resolveRole` (request-time)
 * and the admin user list (`listDashboardUsers`).
 */
export function effectiveAccess(
	rows: { type: string; value: string; role: string }[],
	email: string
): EffectiveAccess {
	const lower = email.trim().toLowerCase();
	const domain = lower.split('@')[1] ?? '';
	const exact = rows.find((r) => r.type === 'email' && r.value === lower);
	if (exact) return { role: exact.role as Role, source: 'email' };
	const byDomain = rows.find((r) => r.type === 'domain' && r.value === domain);
	if (byDomain) return { role: byDomain.role as Role, source: 'domain' };
	return { role: null, source: null };
}

/**
 * Resolve a user's role from the allowlist. Exact email match wins over a domain
 * match; null = not allowlisted (access denied). Uses the service-role client
 * (the anon role has no grants on dashboard_access).
 */
export async function resolveRole(supabase: SupabaseClient, email: string): Promise<Role | null> {
	const lower = email.trim().toLowerCase();
	const domain = lower.split('@')[1] ?? '';
	const { data, error: dbError } = await supabase
		.from('dashboard_access')
		.select('type, value, role')
		.in('value', [lower, domain]);
	if (dbError || !data) return null;
	return effectiveAccess(data, email).role;
}

export type AccessDecision = { type: 'allow' } | { type: 'redirect'; to: string };

/**
 * Decide what to do with a request given its path, whether there's a session,
 * and the allowlist role. Pure — unit tested exhaustively.
 *
 * - `/api/v1/*` is handled by the API-key hook, never here.
 * - Public routes: `/login`, `/access-denied`, `/auth/*`.
 */
export function decideAccess(input: {
	pathname: string;
	hasSession: boolean;
	role: Role | null;
}): AccessDecision {
	const { pathname, hasSession, role } = input;
	if (pathname.startsWith('/api/v1')) return { type: 'allow' };

	const isAuthRoute = pathname.startsWith('/auth');
	const isLogin = pathname === '/login';
	const isDenied = pathname === '/access-denied';

	if (!hasSession) {
		// Not logged in: only the login + auth-callback routes are reachable.
		return isLogin || isAuthRoute ? { type: 'allow' } : { type: 'redirect', to: '/login' };
	}

	if (!role) {
		// Logged in but not allowlisted: only the denied screen + auth (sign-out).
		return isDenied || isAuthRoute ? { type: 'allow' } : { type: 'redirect', to: '/access-denied' };
	}

	// Logged in + allowlisted: keep them out of login/denied.
	if (isLogin || isDenied) return { type: 'redirect', to: '/' };
	return { type: 'allow' };
}

/** Guard for admin-only actions/loads (Blocks 6–7). Throws 403 for non-admins. */
export function requireAdmin(locals: App.Locals): void {
	if (locals.role !== 'admin') {
		throw error(403, 'Solo los administradores pueden realizar esta acción.');
	}
}
