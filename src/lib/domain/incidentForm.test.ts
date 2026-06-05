import { describe, it, expect } from 'vitest';
import { cordobaLocalToIso, parseIncidentForm } from './incidentForm';

/** Build a FormData from scalar fields + repeated (array) fields. */
function makeForm(
	scalars: Record<string, string>,
	arrays: Record<string, string[]> = {}
): FormData {
	const f = new FormData();
	for (const [k, val] of Object.entries(scalars)) f.set(k, val);
	for (const [k, vals] of Object.entries(arrays)) for (const v of vals) f.append(k, v);
	return f;
}

const validScalars = {
	location: 'Laboratorio Central - Mesa 4',
	timestamp: '2026-06-04T18:30',
	incident_type: 'DERRAME',
	severity_level: 'MEDIO',
	status: 'ABIERTO',
	medical_assistance_required: 'on'
};

describe('cordobaLocalToIso', () => {
	it('anchors a datetime-local value to the Córdoba (-03:00) offset', () => {
		expect(cordobaLocalToIso('2026-06-04T18:30')).toBe('2026-06-04T18:30:00-03:00');
	});
	it('keeps seconds when present', () => {
		expect(cordobaLocalToIso('2026-06-04T18:30:45')).toBe('2026-06-04T18:30:45-03:00');
	});
	it('returns empty string for empty input (lets zod report required)', () => {
		expect(cordobaLocalToIso('  ')).toBe('');
	});
});

describe('parseIncidentForm', () => {
	it('parses a valid submission into IncidentReportData', () => {
		const res = parseIncidentForm(
			makeForm(validScalars, { actions_taken: ['Evacuar el área', '  '] })
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data.timestamp).toBe('2026-06-04T18:30:00-03:00');
		expect(res.data.medical_assistance_required).toBe(true);
		// Empty action rows are dropped (UI scaffolding, not data).
		expect(res.data.actions_taken).toEqual(['Evacuar el área']);
		expect(res.data.chemicals_involved).toEqual([]);
	});

	it('treats a missing checkbox as false', () => {
		const { medical_assistance_required: _omit, ...rest } = validScalars;
		void _omit;
		const res = parseIncidentForm(makeForm(rest, { actions_taken: ['x'] }));
		expect(res.ok).toBe(true);
		if (res.ok) expect(res.data.medical_assistance_required).toBe(false);
	});

	it('keeps only named chemicals and omits blank optional fields', () => {
		const res = parseIncidentForm(
			makeForm(validScalars, {
				actions_taken: ['x'],
				chemical_name: ['Ácido Acético', ''],
				chemical_hazard: ['Clase B', ''],
				chemical_qty: ['', '']
			})
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data.chemicals_involved).toEqual([
			{ name: 'Ácido Acético', hazard_class: 'Clase B' }
		]);
	});

	it('fails with a field error when no action is provided', () => {
		const res = parseIncidentForm(makeForm(validScalars, { actions_taken: ['', '   '] }));
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(res.fieldErrors.actions_taken).toBeTruthy();
		// Raw values are echoed back to repopulate the form.
		expect(res.values.location).toBe(validScalars.location);
	});

	it('fails with field errors for a bad enum and missing required fields', () => {
		const res = parseIncidentForm(
			makeForm({ ...validScalars, incident_type: 'NOPE', location: '' }, { actions_taken: ['x'] })
		);
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(res.fieldErrors.incident_type).toBeTruthy();
		expect(res.fieldErrors.location).toBeTruthy();
	});
});
