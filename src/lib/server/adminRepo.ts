/**
 * Admin data layer (SPEC §3.3, §3.5, §5.1 `/admin`) — allowlist + API keys.
 * Service-role only; all callers are `requireAdmin`-guarded.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { generateApiKey } from './apiKeys';

function fail(error: unknown): never {
	const message = error instanceof Error ? error.message : String(error);
	throw new Error(`admin repo: ${message}`);
}

// ---------------------------------------------------------------------------
// Allowlist (dashboard_access)
// ---------------------------------------------------------------------------
export interface AccessEntry {
	id: string;
	type: 'email' | 'domain';
	value: string;
	role: 'admin' | 'viewer';
	created_at: string;
}

// email → must contain "@"; domain → must NOT (a bare host like "unc.edu.ar").
export const accessInputSchema = z
	.object({
		type: z.enum(['email', 'domain']),
		value: z.string().trim().toLowerCase().min(1),
		role: z.enum(['admin', 'viewer'])
	})
	.refine((v) => (v.type === 'email' ? v.value.includes('@') : !v.value.includes('@')), {
		message: 'El valor no coincide con el tipo (email debe contener @, dominio no).',
		path: ['value']
	});
export type AccessInput = z.infer<typeof accessInputSchema>;

export async function listAccess(supabase: SupabaseClient): Promise<AccessEntry[]> {
	const { data, error } = await supabase
		.from('dashboard_access')
		.select('id, type, value, role, created_at')
		.order('created_at', { ascending: true });
	if (error) fail(error);
	return (data ?? []) as AccessEntry[];
}

export type AddAccessResult =
	| { ok: true }
	| { ok: false; reason: 'duplicate' | 'error'; message: string };

export async function addAccess(
	supabase: SupabaseClient,
	input: AccessInput,
	createdBy: string | null
): Promise<AddAccessResult> {
	const { error } = await supabase.from('dashboard_access').insert({
		type: input.type,
		value: input.value,
		role: input.role,
		created_by: createdBy
	});
	if (error) {
		if (error.code === '23505') {
			return { ok: false, reason: 'duplicate', message: 'Esa entrada ya existe en la lista.' };
		}
		return { ok: false, reason: 'error', message: 'No se pudo agregar la entrada.' };
	}
	return { ok: true };
}

/** Remove an allowlist entry. Returns false if it did not exist. */
export async function removeAccess(supabase: SupabaseClient, id: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('dashboard_access')
		.delete()
		.eq('id', id)
		.select('id');
	if (error) fail(error);
	return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Per-user role overrides — an exact-email row in dashboard_access beats the
// user's domain rule (see `effectiveAccess` in auth.ts). Used by the /admin
// "Usuarios" panel to grant/change a single user's role.
// ---------------------------------------------------------------------------

/** Set/override a single user's role via an exact-email allowlist row (upsert on (type,value)). */
export async function setUserRole(
	supabase: SupabaseClient,
	email: string,
	role: 'admin' | 'viewer',
	createdBy: string | null
): Promise<void> {
	const { error } = await supabase
		.from('dashboard_access')
		.upsert(
			{ type: 'email', value: email.trim().toLowerCase(), role, created_by: createdBy },
			{ onConflict: 'type,value' }
		);
	if (error) fail(error);
}

/** Revert a user to their domain default by deleting their email override. False if none existed. */
export async function clearUserRole(supabase: SupabaseClient, email: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('dashboard_access')
		.delete()
		.eq('type', 'email')
		.eq('value', email.trim().toLowerCase())
		.select('id');
	if (error) fail(error);
	return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// API keys (api_keys)
// ---------------------------------------------------------------------------
export interface ApiKeyEntry {
	id: string;
	name: string;
	key_prefix: string;
	created_at: string;
	revoked_at: string | null;
}

export async function listApiKeys(supabase: SupabaseClient): Promise<ApiKeyEntry[]> {
	const { data, error } = await supabase
		.from('api_keys')
		.select('id, name, key_prefix, created_at, revoked_at')
		.order('created_at', { ascending: false });
	if (error) fail(error);
	return (data ?? []) as ApiKeyEntry[];
}

/** Issue a new key. Returns the plaintext ONCE (never stored) plus the new row's name. */
export async function createApiKey(
	supabase: SupabaseClient,
	name: string,
	createdBy: string | null
): Promise<{ plaintext: string; name: string }> {
	const key = generateApiKey();
	const { error } = await supabase.from('api_keys').insert({
		name,
		key_hash: key.hash,
		key_prefix: key.prefix,
		created_by: createdBy
	});
	if (error) fail(error);
	return { plaintext: key.plaintext, name };
}

/** Revoke a key (set revoked_at). Returns false if unknown or already revoked. */
export async function revokeApiKey(supabase: SupabaseClient, id: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('api_keys')
		.update({ revoked_at: new Date().toISOString() })
		.eq('id', id)
		.is('revoked_at', null)
		.select('id');
	if (error) fail(error);
	return (data?.length ?? 0) > 0;
}
