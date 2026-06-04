import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decideAccess, resolveRole, type Role } from './auth';

describe('decideAccess', () => {
	it('always allows /api/v1 (handled by the key hook)', () => {
		expect(
			decideAccess({ pathname: '/api/v1/incidents', hasSession: false, role: null }).type
		).toBe('allow');
	});

	describe('no session', () => {
		it('allows /login and /auth/*', () => {
			expect(decideAccess({ pathname: '/login', hasSession: false, role: null }).type).toBe(
				'allow'
			);
			expect(decideAccess({ pathname: '/auth/callback', hasSession: false, role: null }).type).toBe(
				'allow'
			);
		});
		it('redirects protected routes to /login', () => {
			expect(decideAccess({ pathname: '/', hasSession: false, role: null })).toEqual({
				type: 'redirect',
				to: '/login'
			});
			expect(decideAccess({ pathname: '/admin', hasSession: false, role: null })).toEqual({
				type: 'redirect',
				to: '/login'
			});
		});
	});

	describe('session but not allowlisted', () => {
		it('allows /access-denied and /auth/* (to sign out)', () => {
			expect(decideAccess({ pathname: '/access-denied', hasSession: true, role: null }).type).toBe(
				'allow'
			);
			expect(decideAccess({ pathname: '/auth/signout', hasSession: true, role: null }).type).toBe(
				'allow'
			);
		});
		it('redirects everything else to /access-denied', () => {
			expect(decideAccess({ pathname: '/', hasSession: true, role: null })).toEqual({
				type: 'redirect',
				to: '/access-denied'
			});
			expect(decideAccess({ pathname: '/admin', hasSession: true, role: null })).toEqual({
				type: 'redirect',
				to: '/access-denied'
			});
		});
	});

	describe('session + allowlisted', () => {
		for (const role of ['admin', 'viewer'] as Role[]) {
			it(`allows dashboard routes (${role}) and bounces login/denied to /`, () => {
				expect(decideAccess({ pathname: '/', hasSession: true, role }).type).toBe('allow');
				expect(decideAccess({ pathname: '/incidents/abc', hasSession: true, role }).type).toBe(
					'allow'
				);
				expect(decideAccess({ pathname: '/login', hasSession: true, role })).toEqual({
					type: 'redirect',
					to: '/'
				});
				expect(decideAccess({ pathname: '/access-denied', hasSession: true, role })).toEqual({
					type: 'redirect',
					to: '/'
				});
			});
		}
	});
});

function fakeSupabase(
	rows: { type: string; value: string; role: Role }[],
	opts: { error?: boolean } = {}
): SupabaseClient {
	return {
		from: () => ({
			select: () => ({
				in: async (_col: string, values: string[]) =>
					opts.error
						? { data: null, error: { message: 'boom' } }
						: { data: rows.filter((r) => values.includes(r.value)), error: null }
			})
		})
	} as unknown as SupabaseClient;
}

describe('resolveRole', () => {
	const rows = [
		{ type: 'email', value: 'jdoe@unc.edu.ar', role: 'admin' as Role },
		{ type: 'domain', value: 'unc.edu.ar', role: 'viewer' as Role }
	];

	it('matches an exact email (case-insensitive) and beats the domain', async () => {
		expect(await resolveRole(fakeSupabase(rows), 'JDoe@UNC.edu.ar')).toBe('admin');
	});

	it('falls back to a domain match', async () => {
		expect(await resolveRole(fakeSupabase(rows), 'someone@unc.edu.ar')).toBe('viewer');
	});

	it('returns null when neither matches', async () => {
		expect(await resolveRole(fakeSupabase(rows), 'x@gmail.com')).toBeNull();
	});

	it('returns null on a DB error', async () => {
		expect(await resolveRole(fakeSupabase(rows, { error: true }), 'jdoe@unc.edu.ar')).toBeNull();
	});
});
