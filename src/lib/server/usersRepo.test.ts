import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listDashboardUsers } from './usersRepo';
import type { AccessEntry } from './adminRepo';

type FakeUser = { id: string; email: string | null; last_sign_in_at?: string | null };

function fakeSupabase(pages: FakeUser[][], opts: { error?: boolean } = {}): SupabaseClient {
	return {
		auth: {
			admin: {
				listUsers: async ({ page }: { page: number; perPage: number }) =>
					opts.error
						? { data: null, error: { message: 'boom' } }
						: { data: { users: pages[page - 1] ?? [] }, error: null }
			}
		}
	} as unknown as SupabaseClient;
}

const access: AccessEntry[] = [
	{ id: '1', type: 'email', value: 'admin@unc.edu.ar', role: 'admin', created_at: 't' },
	{ id: '2', type: 'domain', value: 'unc.edu.ar', role: 'viewer', created_at: 't' }
];

describe('listDashboardUsers', () => {
	it('merges effective role/source and skips users without an email', async () => {
		const supabase = fakeSupabase([
			[
				{ id: 'a', email: 'admin@unc.edu.ar', last_sign_in_at: '2026-06-04T10:00:00Z' },
				{ id: 'b', email: 'bob@unc.edu.ar', last_sign_in_at: '2026-06-04T09:00:00Z' },
				{ id: 'c', email: 'stranger@gmail.com', last_sign_in_at: null },
				{ id: 'd', email: null, last_sign_in_at: '2026-06-04T11:00:00Z' }
			]
		]);
		const users = await listDashboardUsers(supabase, access);

		expect(users.map((u) => u.id)).toEqual(['a', 'b', 'c']); // null-email 'd' skipped
		expect(users.find((u) => u.id === 'a')).toMatchObject({ role: 'admin', source: 'email' });
		expect(users.find((u) => u.id === 'b')).toMatchObject({ role: 'viewer', source: 'domain' });
		expect(users.find((u) => u.id === 'c')).toMatchObject({ role: null, source: null });
	});

	it('sorts by most-recent sign-in (nulls last), then email', async () => {
		const supabase = fakeSupabase([
			[
				{ id: 'never2', email: 'zoe@unc.edu.ar', last_sign_in_at: null },
				{ id: 'never1', email: 'amy@unc.edu.ar', last_sign_in_at: null },
				{ id: 'old', email: 'old@unc.edu.ar', last_sign_in_at: '2026-06-01T00:00:00Z' },
				{ id: 'new', email: 'new@unc.edu.ar', last_sign_in_at: '2026-06-04T00:00:00Z' }
			]
		]);
		const users = await listDashboardUsers(supabase, access);
		expect(users.map((u) => u.id)).toEqual(['new', 'old', 'never1', 'never2']);
	});

	it('paginates past a full page until a short page', async () => {
		const fullPage: FakeUser[] = Array.from({ length: 1000 }, (_, i) => ({
			id: `p1-${i}`,
			email: `u${i}@unc.edu.ar`,
			last_sign_in_at: '2026-06-04T00:00:00Z'
		}));
		const supabase = fakeSupabase([fullPage, [{ id: 'p2', email: 'last@unc.edu.ar' }]]);
		const users = await listDashboardUsers(supabase, access);
		expect(users).toHaveLength(1001);
		expect(users.some((u) => u.id === 'p2')).toBe(true);
	});

	it('throws on a list error', async () => {
		await expect(listDashboardUsers(fakeSupabase([], { error: true }), access)).rejects.toThrow(
			/users repo/
		);
	});
});
