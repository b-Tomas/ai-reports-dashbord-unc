/**
 * First-admin bootstrap.
 *
 * Reads SUPER_ADMIN_EMAIL at runtime and calls the idempotent
 * `ensure_super_admin` DB function (seeds an admin only if none exists). This is
 * what makes "deploy with SUPER_ADMIN_EMAIL set" work without any manual SQL.
 *
 * `$env` / the service client are imported lazily inside `runBootstrapOnce` so
 * `ensureSuperAdmin` stays importable in unit tests (no SvelteKit virtual deps).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Idempotently seed the first admin from the given email. No-op when email is blank. */
export async function ensureSuperAdmin(
	supabase: SupabaseClient,
	email: string | undefined
): Promise<void> {
	const trimmed = email?.trim();
	if (!trimmed) return;
	const { error } = await supabase.rpc('ensure_super_admin', { p_email: trimmed });
	if (error) console.error('[bootstrap] ensure_super_admin failed:', error.message);
}

let started: Promise<void> | null = null;

/** Run the admin bootstrap once per server instance (memoized, best-effort). */
export function runBootstrapOnce(): Promise<void> {
	if (!started) {
		started = (async () => {
			const { env } = await import('$env/dynamic/private');
			const email = env.SUPER_ADMIN_EMAIL?.trim();
			if (!email) return; // nothing configured, nothing to seed
			try {
				const { createServiceClient } = await import('./supabase');
				await ensureSuperAdmin(createServiceClient(), email);
			} catch (e) {
				console.error('[bootstrap] error:', e);
			}
		})();
	}
	return started;
}
