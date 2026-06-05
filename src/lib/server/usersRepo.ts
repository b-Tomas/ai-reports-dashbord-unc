/**
 * Dashboard users data layer (SPEC §3.5, §5.1 `/admin`).
 *
 * Lists the real Supabase Auth users (everyone who has completed Google OAuth,
 * including currently-denied accounts that only reached `/access-denied`) and
 * merges in each one's effective role from the allowlist. Service-role only;
 * the caller is `requireAdmin`-guarded.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveAccess, type AccessSource, type Role } from './auth';
import type { AccessEntry } from './adminRepo';

function fail(error: unknown): never {
	const message = error instanceof Error ? error.message : String(error);
	throw new Error(`users repo: ${message}`);
}

export interface DashboardUser {
	id: string;
	email: string;
	lastSignInAt: string | null;
	role: Role | null;
	/** 'email' = explicit override, 'domain' = via domain rule, null = no access. */
	source: AccessSource;
}

const PER_PAGE = 1000;

/**
 * List all authenticated users with their effective role derived from `access`
 * (the dashboard_access rows). Sorted by most-recent sign-in (nulls last), then
 * email. Reuses `effectiveAccess` so this matches request-time role resolution.
 */
export async function listDashboardUsers(
	supabase: SupabaseClient,
	access: AccessEntry[]
): Promise<DashboardUser[]> {
	const users: DashboardUser[] = [];

	// Page defensively; a single lab fits in one page in practice.
	for (let page = 1; ; page++) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
		if (error) fail(error);
		const batch = data?.users ?? [];
		for (const u of batch) {
			if (!u.email) continue;
			const { role, source } = effectiveAccess(access, u.email);
			users.push({
				id: u.id,
				email: u.email,
				lastSignInAt: u.last_sign_in_at ?? null,
				role,
				source
			});
		}
		if (batch.length < PER_PAGE) break;
	}

	return users.sort((a, b) => {
		if (a.lastSignInAt !== b.lastSignInAt) {
			if (!a.lastSignInAt) return 1;
			if (!b.lastSignInAt) return -1;
			return b.lastSignInAt.localeCompare(a.lastSignInAt);
		}
		return a.email.localeCompare(b.email);
	});
}
