import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSuperAdmin } from './bootstrap';

function fakeSupabase(opts: { error?: { message: string } } = {}) {
	const rpc = vi.fn(async () => ({ data: null, error: opts.error ?? null }));
	return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('ensureSuperAdmin', () => {
	it('calls ensure_super_admin with the trimmed email', async () => {
		const { client, rpc } = fakeSupabase();
		await ensureSuperAdmin(client, '  Tomas@UNC.edu.ar  ');
		expect(rpc).toHaveBeenCalledWith('ensure_super_admin', { p_email: 'Tomas@UNC.edu.ar' });
	});

	it('is a no-op when the email is blank or undefined', async () => {
		const { client, rpc } = fakeSupabase();
		await ensureSuperAdmin(client, undefined);
		await ensureSuperAdmin(client, '   ');
		expect(rpc).not.toHaveBeenCalled();
	});

	it('swallows a DB error (best-effort)', async () => {
		const { client } = fakeSupabase({ error: { message: 'boom' } });
		await expect(ensureSuperAdmin(client, 'a@b.com')).resolves.toBeUndefined();
	});
});
