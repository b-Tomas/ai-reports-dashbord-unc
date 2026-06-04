import { describe, it, expect } from 'vitest';
import { accessInputSchema } from './adminRepo';

describe('accessInputSchema', () => {
	it('accepts an email entry and normalizes (trim + lowercase)', () => {
		const r = accessInputSchema.safeParse({
			type: 'email',
			value: '  JDoe@UNC.edu.ar ',
			role: 'admin'
		});
		expect(r.success).toBe(true);
		if (r.success)
			expect(r.data).toEqual({ type: 'email', value: 'jdoe@unc.edu.ar', role: 'admin' });
	});

	it('accepts a bare domain entry', () => {
		const r = accessInputSchema.safeParse({ type: 'domain', value: 'unc.edu.ar', role: 'viewer' });
		expect(r.success).toBe(true);
	});

	it('rejects an email value without @', () => {
		const r = accessInputSchema.safeParse({ type: 'email', value: 'unc.edu.ar', role: 'viewer' });
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues[0].path).toEqual(['value']);
	});

	it('rejects a domain value that contains @', () => {
		const r = accessInputSchema.safeParse({
			type: 'domain',
			value: 'a@unc.edu.ar',
			role: 'viewer'
		});
		expect(r.success).toBe(false);
	});

	it('rejects unknown type/role and empty value', () => {
		expect(
			accessInputSchema.safeParse({ type: 'x', value: 'a@b.com', role: 'admin' }).success
		).toBe(false);
		expect(
			accessInputSchema.safeParse({ type: 'email', value: 'a@b.com', role: 'root' }).success
		).toBe(false);
		expect(accessInputSchema.safeParse({ type: 'domain', value: '', role: 'admin' }).success).toBe(
			false
		);
	});
});
