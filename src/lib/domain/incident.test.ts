import { describe, it, expect } from 'vitest';
import {
	IncidentReportCreate,
	IncidentReportPatch,
	chemicalSchema,
	toIncidentReport,
	INCIDENT_TYPES,
	type IncidentReportData
} from './incident';

// A representative valid payload.
const validPayload = {
	timestamp: '2026-06-04T18:30:00Z',
	location: 'Laboratorio Central - Mesa 4',
	incident_type: 'DERRAME',
	severity_level: 'MEDIO',
	chemicals_involved: [
		{
			name: 'Ácido Acético Glacial',
			hazard_class: 'Clase B y Clase E',
			estimated_quantity: '250 ml'
		}
	],
	actions_taken: ['Se evacuó el área inmediata.', 'Se utilizó EPP.'],
	medical_assistance_required: false,
	status: 'RESUELTO'
};

describe('IncidentReportCreate', () => {
	it('accepts a valid payload', () => {
		const r = IncidentReportCreate.safeParse(validPayload);
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.chemicals_involved).toHaveLength(1);
	});

	it('defaults chemicals_involved to [] when omitted', () => {
		const { chemicals_involved, ...withoutChem } = validPayload;
		void chemicals_involved;
		const r = IncidentReportCreate.safeParse(withoutChem);
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.chemicals_involved).toEqual([]);
	});

	it('rejects empty actions_taken (min 1)', () => {
		const r = IncidentReportCreate.safeParse({ ...validPayload, actions_taken: [] });
		expect(r.success).toBe(false);
		if (!r.success) {
			const fields = r.error.issues.map((i) => i.path.join('.'));
			expect(fields).toContain('actions_taken');
			expect(r.error.issues[0].code).toBe('too_small');
		}
	});

	it('rejects a bad incident_type enum', () => {
		const r = IncidentReportCreate.safeParse({ ...validPayload, incident_type: 'EXPLOSION' });
		expect(r.success).toBe(false);
		if (!r.success) {
			const issue = r.error.issues.find((i) => i.path.join('.') === 'incident_type');
			expect(issue).toBeDefined();
		}
	});

	it('rejects a missing required field (location)', () => {
		const { location, ...withoutLocation } = validPayload;
		void location;
		const r = IncidentReportCreate.safeParse(withoutLocation);
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(r.error.issues.some((i) => i.path.join('.') === 'location')).toBe(true);
		}
	});

	it('rejects unknown keys (strict)', () => {
		const r = IncidentReportCreate.safeParse({ ...validPayload, foo: 'bar' });
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(r.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
		}
	});

	it('rejects a timestamp without an offset (local time)', () => {
		const r = IncidentReportCreate.safeParse({ ...validPayload, timestamp: '2026-06-04T18:30:00' });
		expect(r.success).toBe(false);
	});

	it('accepts a timestamp with a numeric offset', () => {
		const r = IncidentReportCreate.safeParse({
			...validPayload,
			timestamp: '2026-06-04T18:30:00-03:00'
		});
		expect(r.success).toBe(true);
	});

	it('covers every declared incident_type', () => {
		for (const t of INCIDENT_TYPES) {
			expect(IncidentReportCreate.safeParse({ ...validPayload, incident_type: t }).success).toBe(
				true
			);
		}
	});
});

describe('chemicalSchema', () => {
	it('requires a name', () => {
		expect(chemicalSchema.safeParse({ estimated_quantity: '1 L' }).success).toBe(false);
	});

	it('accepts name only (optional fields omitted)', () => {
		expect(chemicalSchema.safeParse({ name: 'Agua' }).success).toBe(true);
	});
});

describe('IncidentReportPatch', () => {
	it('accepts a partial update (status only)', () => {
		const r = IncidentReportPatch.safeParse({ status: 'EN_PROGRESO' });
		expect(r.success).toBe(true);
	});

	it('does NOT inject a chemicals_involved default when omitted', () => {
		const r = IncidentReportPatch.safeParse({ status: 'EN_PROGRESO' });
		expect(r.success).toBe(true);
		if (r.success) expect('chemicals_involved' in r.data).toBe(false);
	});

	it('still validates provided fields (bad status enum)', () => {
		expect(IncidentReportPatch.safeParse({ status: 'CERRADO' }).success).toBe(false);
	});

	it('rejects unknown keys (strict)', () => {
		expect(IncidentReportPatch.safeParse({ nope: 1 }).success).toBe(false);
	});

	it('accepts an empty patch', () => {
		expect(IncidentReportPatch.safeParse({}).success).toBe(true);
	});
});

describe('toIncidentReport', () => {
	const data = IncidentReportCreate.parse(validPayload) as IncidentReportData;

	it('merges operational columns with the data payload', () => {
		const out = toIncidentReport({
			id: 'abc-123',
			created_at: '2026-06-04T18:30:05Z',
			updated_at: '2026-06-04T18:31:00Z',
			data
		});
		expect(out.id).toBe('abc-123');
		expect(out.created_at).toBe('2026-06-04T18:30:05Z');
		expect(out.updated_at).toBe('2026-06-04T18:31:00Z');
		expect(out.location).toBe(validPayload.location);
		expect(out.status).toBe('RESUELTO');
	});

	it('normalizes Date columns to ISO strings', () => {
		const created = new Date('2026-06-04T18:30:05Z');
		const out = toIncidentReport({ id: 'x', created_at: created, updated_at: created, data });
		expect(out.created_at).toBe('2026-06-04T18:30:05.000Z');
	});

	it('keeps columns authoritative over a malformed data blob', () => {
		const dirty = {
			...data,
			id: 'SPOOFED',
			created_at: 'SPOOFED'
		} as unknown as IncidentReportData;
		const out = toIncidentReport({
			id: 'real',
			created_at: 'real-ts',
			updated_at: 'real-ts',
			data: dirty
		});
		expect(out.id).toBe('real');
		expect(out.created_at).toBe('real-ts');
	});
});
