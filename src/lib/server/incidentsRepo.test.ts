import { describe, it, expect } from 'vitest';
import { parseListParams, mergePatch, isUuid } from './incidentsRepo';
import type { IncidentReport } from '../domain/incident';

const sp = (q: string) => new URLSearchParams(q);

describe('isUuid', () => {
	it('accepts a v4-shaped uuid and rejects junk', () => {
		expect(isUuid('51d6a8c4-cf74-47e5-b965-d086c8110871')).toBe(true);
		expect(isUuid('not-a-uuid')).toBe(false);
		expect(isUuid('123')).toBe(false);
	});
});

describe('parseListParams', () => {
	it('applies defaults when empty', () => {
		const r = parseListParams(sp(''));
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.params).toMatchObject({ limit: 25, offset: 0 });
	});

	it('clamps limit to [1,100] and floors offset at 0', () => {
		const a = parseListParams(sp('limit=500'));
		const b = parseListParams(sp('limit=0&offset=-5'));
		if (a.ok) expect(a.params.limit).toBe(100);
		if (b.ok) expect(b.params).toMatchObject({ limit: 1, offset: 0 });
	});

	it('passes through valid filters', () => {
		const r = parseListParams(sp('status=ABIERTO&incident_type=DERRAME&severity_level=ALTO'));
		expect(r.ok).toBe(true);
		if (r.ok)
			expect(r.params).toMatchObject({
				status: 'ABIERTO',
				incident_type: 'DERRAME',
				severity_level: 'ALTO'
			});
	});

	it('ignores empty-string filter params', () => {
		const r = parseListParams(sp('status='));
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.params.status).toBeUndefined();
	});

	it('accepts ISO date range with offset', () => {
		const r = parseListParams(sp('from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z'));
		expect(r.ok).toBe(true);
	});

	it('rejects a bad enum filter', () => {
		expect(parseListParams(sp('status=CERRADO')).ok).toBe(false);
	});

	it('rejects a from date without an offset', () => {
		expect(parseListParams(sp('from=2026-01-01T00:00:00')).ok).toBe(false);
	});
});

describe('mergePatch', () => {
	const existing: IncidentReport = {
		id: 'abc',
		created_at: '2026-06-04T18:30:05Z',
		updated_at: '2026-06-04T18:30:05Z',
		timestamp: '2026-06-04T18:30:00Z',
		location: 'Lab',
		incident_type: 'DERRAME',
		severity_level: 'MEDIO',
		chemicals_involved: [{ name: 'Agua' }],
		actions_taken: ['x'],
		medical_assistance_required: false,
		status: 'ABIERTO'
	};

	it('overlays provided fields and drops operational columns', () => {
		const merged = mergePatch(existing, { status: 'RESUELTO' });
		expect(merged.status).toBe('RESUELTO');
		expect(merged.location).toBe('Lab');
		expect('id' in merged).toBe(false);
		expect('created_at' in merged).toBe(false);
		expect('updated_at' in merged).toBe(false);
	});

	it('replaces array fields wholesale', () => {
		const merged = mergePatch(existing, { chemicals_involved: [] });
		expect(merged.chemicals_involved).toEqual([]);
	});
});
