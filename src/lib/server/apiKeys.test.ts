import { describe, it, expect } from 'vitest';
import { hashApiKey, generateApiKey, extractBearer, API_KEY_PREFIX } from './apiKeys';

describe('hashApiKey', () => {
	it('is a deterministic 64-char sha256 hex digest', () => {
		const a = hashApiKey('irk_abc');
		expect(a).toBe(hashApiKey('irk_abc'));
		expect(a).toMatch(/^[0-9a-f]{64}$/);
	});

	it('differs for different inputs', () => {
		expect(hashApiKey('irk_a')).not.toBe(hashApiKey('irk_b'));
	});
});

describe('generateApiKey', () => {
	it('mints an irk_-prefixed key whose hash matches', () => {
		const k = generateApiKey();
		expect(k.plaintext.startsWith(API_KEY_PREFIX)).toBe(true);
		expect(k.hash).toBe(hashApiKey(k.plaintext));
		expect(k.prefix).toBe(k.plaintext.slice(0, 12));
	});

	it('is random across calls', () => {
		expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
	});
});

describe('extractBearer', () => {
	it('parses a bearer token', () => {
		expect(extractBearer('Bearer irk_xyz')).toBe('irk_xyz');
		expect(extractBearer('bearer irk_xyz')).toBe('irk_xyz'); // case-insensitive
	});

	it('returns null for missing/malformed headers', () => {
		expect(extractBearer(null)).toBeNull();
		expect(extractBearer('')).toBeNull();
		expect(extractBearer('Basic abc')).toBeNull();
		expect(extractBearer('irk_xyz')).toBeNull();
	});
});
