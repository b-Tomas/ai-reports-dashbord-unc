/**
 * Server-only Supabase client factory.
 *
 * Uses the service-role key, so never import this from client code. supabase-js
 * talks to PostgREST over HTTP (not raw Postgres TCP), which is what Netlify
 * functions need to avoid connection exhaustion.
 *
 * Env is read via `$env/dynamic/*` so `npm run build` succeeds without secrets
 * present; the values are resolved at runtime.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export function createServiceClient(): SupabaseClient {
	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !serviceRoleKey) {
		throw new Error(
			'Supabase is not configured: set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).'
		);
	}
	return createClient(url, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}
