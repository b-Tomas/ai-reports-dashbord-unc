// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Service-role Supabase client, set by the hook for /api/v1 routes. */
			serviceClient: import('@supabase/supabase-js').SupabaseClient;
			/** Authenticated API key for /api/v1 requests (null otherwise). */
			apiKey: { id: string; name: string } | null;
			/** Incident touched by the handler, for the api_usage log. */
			incidentId: string | null;
			/** Per-request Supabase SSR client (cookie-bound, anon key) — dashboard routes. */
			supabase: import('@supabase/supabase-js').SupabaseClient;
			/** Returns the validated session + user (or nulls). */
			safeGetSession: () => Promise<{
				session: import('@supabase/supabase-js').Session | null;
				user: import('@supabase/supabase-js').User | null;
			}>;
			session: import('@supabase/supabase-js').Session | null;
			user: import('@supabase/supabase-js').User | null;
			/** Allowlist role for the logged-in user (null = not allowlisted). */
			role: import('$lib/server/auth').Role | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
