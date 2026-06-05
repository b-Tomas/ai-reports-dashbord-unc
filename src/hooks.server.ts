/**
 * Server hooks: three composed handles (run in order via `sequence`):
 *
 *  1. apiV1Handle      API-key auth + usage logging for `/api/v1/*`.
 *  2. supabaseHandle   per-request Supabase SSR client + `safeGetSession`.
 *  3. authGuardHandle  derive allowlist role, guard all dashboard routes.
 *
 * Handles 2 and 3 skip `/api/v1/*` (agents use Bearer keys, not cookies); handle 1
 * passes non-API requests straight through.
 */
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { createApiV1Handle } from '$lib/server/apiAuth';
import { createServiceClient } from '$lib/server/supabase';
import { decideAccess, resolveRole } from '$lib/server/auth';
import { runBootstrapOnce } from '$lib/server/bootstrap';

const apiV1 = createApiV1Handle({ createClient: createServiceClient });

const apiV1Handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/v1')) return apiV1(event, resolve);
	return resolve(event);
};

const supabaseHandle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/v1')) return resolve(event);

	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		throw new Error(
			'Supabase is not configured: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY (see .env.example).'
		);
	}

	event.locals.supabase = createServerClient(url, anonKey, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	// Validate the session against the auth server (getSession alone is spoofable).
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return { session: null, user: null };
		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

const authGuardHandle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/v1')) return resolve(event);
	// Asset / unmatched requests have no route id, so never guard them.
	if (!event.route.id) return resolve(event);

	// Seed the first admin from SUPER_ADMIN_EMAIL once per server instance.
	await runBootstrapOnce();

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;
	event.locals.role = user?.email ? await resolveRole(createServiceClient(), user.email) : null;

	const decision = decideAccess({
		pathname: event.url.pathname,
		hasSession: !!session,
		role: event.locals.role
	});
	if (decision.type === 'redirect') throw redirect(303, decision.to);

	return resolve(event);
};

export const handle = sequence(apiV1Handle, supabaseHandle, authGuardHandle);
