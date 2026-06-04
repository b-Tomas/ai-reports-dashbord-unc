import { describe, it, expect } from 'vitest';
import { IncidentReportCreate } from './incident';
import { formatZodError, validationError, apiError } from './errors';

const validPayload = {
	timestamp: '2026-06-04T18:30:00Z',
	location: 'Lab',
	incident_type: 'DERRAME',
	severity_level: 'MEDIO',
	actions_taken: ['x'],
	medical_assistance_required: false,
	status: 'ABIERTO'
};

function errorFor(patch: Record<string, unknown>) {
	const r = IncidentReportCreate.safeParse({ ...validPayload, ...patch });
	if (r.success) throw new Error('expected a validation failure');
	return r.error;
}

describe('formatZodError', () => {
	it('produces field-level details for empty actions_taken', () => {
		const details = formatZodError(errorFor({ actions_taken: [] }));
		const d = details.find((x) => x.field === 'actions_taken');
		expect(d).toBeDefined();
		expect(d?.code).toBe('too_small');
		expect(typeof d?.message).toBe('string');
	});

	it('produces field-level details for a bad enum', () => {
		const details = formatZodError(errorFor({ incident_type: 'NOPE' }));
		expect(details.some((d) => d.field === 'incident_type')).toBe(true);
	});

	it('uses dotted paths for nested fields', () => {
		const details = formatZodError(errorFor({ chemicals_involved: [{ name: '' }] }));
		expect(details.some((d) => d.field === 'chemicals_involved.0.name')).toBe(true);
	});

	it('labels root-level issues (unknown key) as (root)', () => {
		const details = formatZodError(errorFor({ surprise: true }));
		expect(details.some((d) => d.field === '(root)' && d.code === 'unrecognized_keys')).toBe(true);
	});
});

describe('validationError', () => {
	it('wraps details in the standard envelope', () => {
		const body = validationError(errorFor({ actions_taken: [] }));
		expect(body.error.code).toBe('validation_error');
		expect(body.error.message).toBe('Validation failed');
		expect(Array.isArray(body.error.details)).toBe(true);
		expect(body.error.details?.length).toBeGreaterThan(0);
	});
});

describe('apiError', () => {
	it('builds an envelope without details', () => {
		const body = apiError('not_found', 'Incident not found');
		expect(body).toEqual({ error: { code: 'not_found', message: 'Incident not found' } });
	});
});
