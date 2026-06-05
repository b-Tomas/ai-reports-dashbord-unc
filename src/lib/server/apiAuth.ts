/**
 * /api/v1 authentication + usage-logging hook.
 *
 * For every /api/v1/* request this:
 *   1. reads `Authorization: Bearer <key>`, hashes it, looks it up in api_keys,
 *      rejecting missing/unknown/revoked keys with 401;
 *   2. attaches the key to `locals.apiKey` for the handlers;
 *   3. measures latency and writes ONE best-effort `api_usage` row (even on 401,
 *      with a null key).
 *
 * The core is dependency-injected (`createClient`, `now`) so it can be unit
 * tested without a live Supabase. `hooks.server.ts` wires the real deps.
 */
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractBearer, hashApiKey } from './apiKeys';
import { logApiUsage, resolveRouteName } from './apiUsage';
import { apiError } from '../domain/errors';

export interface ApiKeyRecord {
	id: string;
	name: string;
}

export interface ApiV1Deps {
	/** Service-role Supabase client factory (one per request). */
	createClient: () => SupabaseClient;
	/** Monotonic clock for latency, injectable for tests. Defaults to performance.now. */
	now?: () => number;
}

type Resolve = (event: RequestEvent) => Response | Promise<Response>;

function unauthorized(): Response {
	return new Response(JSON.stringify(apiError('unauthorized', 'Missing or invalid API key')), {
		status: 401,
		headers: { 'content-type': 'application/json' }
	});
}

/** Look up a (non-revoked) API key by its plaintext token. Returns null otherwise. */
async function authenticate(supabase: SupabaseClient, token: string): Promise<ApiKeyRecord | null> {
	const { data, error } = await supabase
		.from('api_keys')
		.select('id, name, revoked_at')
		.eq('key_hash', hashApiKey(token))
		.maybeSingle();
	if (error || !data || data.revoked_at) return null;
	return { id: data.id, name: data.name };
}

/** Build the /api/v1 handle from injected dependencies. */
export function createApiV1Handle(deps: ApiV1Deps) {
	const now = deps.now ?? (() => performance.now());

	return async function handleApiV1(event: RequestEvent, resolve: Resolve): Promise<Response> {
		const start = now();
		const supabase = deps.createClient();
		// Share this single service-role client with the route handlers (one
		// PostgREST client per request, not two). The human anon/SSR client is
		// a separate `locals.supabase`; keep the names distinct to avoid mixing
		// service-role and anon privileges.
		event.locals.serviceClient = supabase;
		const method = event.request.method;
		const path = event.url.pathname;
		const route = resolveRouteName(method, path);

		event.locals.apiKey = null;
		event.locals.incidentId = null;

		const token = extractBearer(event.request.headers.get('authorization'));
		const key = token ? await authenticate(supabase, token) : null;

		// Unauthenticated: do NOT run the handler, but still log (with a null key).
		if (!key) {
			const response = unauthorized();
			await logApiUsage(supabase, {
				route,
				method,
				path,
				status_code: 401,
				latency_ms: Math.round(now() - start),
				api_key_id: null,
				incident_id: null
			});
			return response;
		}

		event.locals.apiKey = key;

		let response: Response;
		try {
			response = await resolve(event);
		} catch (err) {
			await logApiUsage(supabase, {
				route,
				method,
				path,
				status_code: 500,
				latency_ms: Math.round(now() - start),
				api_key_id: key.id,
				incident_id: event.locals.incidentId ?? null
			});
			throw err;
		}

		await logApiUsage(supabase, {
			route,
			method,
			path,
			status_code: response.status,
			latency_ms: Math.round(now() - start),
			api_key_id: key.id,
			// Handlers set locals.incidentId when they actually touch an incident.
			incident_id: event.locals.incidentId ?? null
		});
		return response;
	};
}
