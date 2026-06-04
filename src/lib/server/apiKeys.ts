/**
 * API key utilities (SPEC §3.3).
 *
 * Keys are stored only as a SHA-256 hash; the plaintext is shown once at
 * creation (Block 7). Format: `irk_<random>`.
 */
import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'irk_';
const PREFIX_DISPLAY_LENGTH = 12; // chars stored in `key_prefix` for UI identification

/** SHA-256 hex digest of a plaintext key. Deterministic — used for lookup. */
export function hashApiKey(plaintext: string): string {
	return createHash('sha256').update(plaintext).digest('hex');
}

export interface GeneratedApiKey {
	/** Full plaintext key — shown to the admin ONCE, never stored. */
	plaintext: string;
	/** SHA-256 hash to persist in `api_keys.key_hash`. */
	hash: string;
	/** First chars, persisted in `api_keys.key_prefix` for identification. */
	prefix: string;
}

/** Mint a new random API key (used by the admin key-issuing flow, Block 7). */
export function generateApiKey(): GeneratedApiKey {
	const secret = randomBytes(24).toString('base64url');
	const plaintext = `${API_KEY_PREFIX}${secret}`;
	return {
		plaintext,
		hash: hashApiKey(plaintext),
		prefix: plaintext.slice(0, PREFIX_DISPLAY_LENGTH)
	};
}

/** Parse a bearer token from an Authorization header. Returns null if absent/malformed. */
export function extractBearer(header: string | null): string | null {
	if (!header) return null;
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	return match ? match[1].trim() : null;
}
