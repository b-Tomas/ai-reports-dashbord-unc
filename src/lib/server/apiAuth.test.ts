import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApiV1Handle } from './apiAuth';
import { hashApiKey } from './apiKeys';
import type { ApiUsageRow } from './apiUsage';

const VALID_PLAINTEXT = 'irk_validkey';
const KEY_ROW = { id: 'key-1', name: 'agent', revoked_at: null as string | null };

/**
 * Minimal fake of the supabase-js query builder:
 *  - api_keys: .select().eq().maybeSingle() resolves to a configured row
 *  - api_usage: .insert(row) captures the row (or throws if `throwOnInsert`)
 */
function makeSupabase(opts: {
	keyRow?: { id: string; name: string; revoked_at: string | null } | null;
	throwOnInsert?: boolean;
}) {
	const inserts: ApiUsageRow[] = [];
	let lastHashQueried: string | null = null;

	const client = {
		from(table: string) {
			if (table === 'api_keys') {
				return {
					select() {
						return this;
					},
					eq(_col: string, value: string) {
						lastHashQueried = value;
						return this;
					},
					async maybeSingle() {
						return { data: opts.keyRow ?? null, error: null };
					}
				};
			}
			if (table === 'api_usage') {
				return {
					async insert(row: ApiUsageRow) {
						if (opts.throwOnInsert) throw new Error('db down');
						inserts.push(row);
						return { error: null };
					}
				};
			}
			throw new Error(`unexpected table: ${table}`);
		}
	} as unknown as SupabaseClient;

	return { client, inserts, getLastHashQueried: () => lastHashQueried };
}

function makeEvent(opts: { auth?: string; method?: string; pathname?: string }): RequestEvent {
	const headers = new Headers();
	if (opts.auth) headers.set('authorization', opts.auth);
	return {
		request: { method: opts.method ?? 'GET', headers },
		url: new URL(`http://localhost${opts.pathname ?? '/api/v1/incidents'}`),
		locals: {}
	} as unknown as RequestEvent;
}

describe('createApiV1Handle', () => {
	it('returns 401 and does NOT run the handler when no key is provided', async () => {
		const { client, inserts } = makeSupabase({ keyRow: null });
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const handle = createApiV1Handle({ createClient: () => client, now: () => 0 });

		const res = await handle(makeEvent({}), resolve);

		expect(res.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
		expect(inserts).toHaveLength(1);
		expect(inserts[0]).toMatchObject({
			status_code: 401,
			api_key_id: null,
			route: 'list_incidents'
		});
	});

	it('returns 401 for an unknown key (still logs with null key)', async () => {
		const { client, inserts } = makeSupabase({ keyRow: null });
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const handle = createApiV1Handle({ createClient: () => client, now: () => 0 });

		const res = await handle(makeEvent({ auth: 'Bearer irk_wrong' }), resolve);

		expect(res.status).toBe(401);
		expect(inserts[0].api_key_id).toBeNull();
	});

	it('returns 401 for a revoked key', async () => {
		const { client, inserts } = makeSupabase({
			keyRow: { ...KEY_ROW, revoked_at: '2026-01-01T00:00:00Z' }
		});
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const handle = createApiV1Handle({ createClient: () => client, now: () => 0 });

		const res = await handle(makeEvent({ auth: `Bearer ${VALID_PLAINTEXT}` }), resolve);

		expect(res.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
		expect(inserts[0].api_key_id).toBeNull();
	});

	it('authenticates a valid key, runs the handler, and logs a 200 usage row', async () => {
		const { client, inserts, getLastHashQueried } = makeSupabase({ keyRow: { ...KEY_ROW } });
		const resolve = vi.fn(async (e: RequestEvent) => {
			// handler can see the authenticated key
			expect(e.locals.apiKey).toEqual({ id: 'key-1', name: 'agent' });
			return new Response('pong', { status: 200 });
		});
		const handle = createApiV1Handle({ createClient: () => client, now: () => 0 });

		const res = await handle(makeEvent({ auth: `Bearer ${VALID_PLAINTEXT}` }), resolve);

		expect(res.status).toBe(200);
		expect(resolve).toHaveBeenCalledTimes(1);
		// lookup used the sha256 hash, not the plaintext
		expect(getLastHashQueried()).toBe(hashApiKey(VALID_PLAINTEXT));
		expect(inserts).toHaveLength(1);
		expect(inserts[0]).toMatchObject({
			status_code: 200,
			api_key_id: 'key-1',
			route: 'list_incidents'
		});
	});

	it('records incident_id set by the handler', async () => {
		const { client, inserts } = makeSupabase({ keyRow: { ...KEY_ROW } });
		const resolve = vi.fn(async (e: RequestEvent) => {
			e.locals.incidentId = 'inc-99';
			return new Response(null, { status: 201 });
		});
		const handle = createApiV1Handle({ createClient: () => client, now: () => 0 });

		await handle(
			makeEvent({
				auth: `Bearer ${VALID_PLAINTEXT}`,
				method: 'POST',
				pathname: '/api/v1/incidents'
			}),
			resolve
		);

		expect(inserts[0]).toMatchObject({
			status_code: 201,
			incident_id: 'inc-99',
			route: 'create_incident'
		});
	});

	it('measures latency from the injected clock', async () => {
		const { client, inserts } = makeSupabase({ keyRow: { ...KEY_ROW } });
		const clock = vi.fn();
		clock.mockReturnValueOnce(1000).mockReturnValueOnce(1175); // start, end
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const handle = createApiV1Handle({ createClient: () => client, now: clock });

		await handle(makeEvent({ auth: `Bearer ${VALID_PLAINTEXT}` }), resolve);

		expect(inserts[0].latency_ms).toBe(175);
	});

	it('is best-effort: a failed usage insert never breaks the response', async () => {
		const { client } = makeSupabase({ keyRow: { ...KEY_ROW }, throwOnInsert: true });
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const handle = createApiV1Handle({ createClient: () => client, now: () => 0 });

		const res = await handle(makeEvent({ auth: `Bearer ${VALID_PLAINTEXT}` }), resolve);

		expect(res.status).toBe(200); // logging swallowed
	});

	it('logs a 500 and rethrows when the handler throws', async () => {
		const { client, inserts } = makeSupabase({ keyRow: { ...KEY_ROW } });
		const resolve = vi.fn(async () => {
			throw new Error('handler boom');
		});
		const handle = createApiV1Handle({ createClient: () => client, now: () => 0 });

		await expect(handle(makeEvent({ auth: `Bearer ${VALID_PLAINTEXT}` }), resolve)).rejects.toThrow(
			'handler boom'
		);
		expect(inserts[0]).toMatchObject({ status_code: 500, api_key_id: 'key-1' });
	});
});
