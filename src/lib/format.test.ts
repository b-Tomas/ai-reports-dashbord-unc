import { describe, it, expect } from 'vitest';
import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUSES } from './domain/incident';
import {
	INCIDENT_TYPE_LABELS,
	SEVERITY_LABELS,
	STATUS_LABELS,
	SEVERITY_BADGE,
	STATUS_BADGE,
	formatDateTime
} from './format';

describe('label + badge maps', () => {
	it('have a Spanish label for every enum value', () => {
		for (const t of INCIDENT_TYPES) expect(INCIDENT_TYPE_LABELS[t]).toBeTruthy();
		for (const s of SEVERITY_LEVELS) expect(SEVERITY_LABELS[s]).toBeTruthy();
		for (const s of STATUSES) expect(STATUS_LABELS[s]).toBeTruthy();
	});

	it('have a badge class for every severity + status', () => {
		for (const s of SEVERITY_LEVELS) expect(SEVERITY_BADGE[s]).toContain('text-');
		for (const s of STATUSES) expect(STATUS_BADGE[s]).toContain('text-');
	});
});

describe('formatDateTime', () => {
	it('renders an instant in America/Argentina/Cordoba (UTC-3)', () => {
		// 02:30Z on Jun 4 is 23:30 (11:30 p.m.) on Jun 3 in Córdoba — proves the TZ is applied
		// (a UTC render would say Jun 4 / 2:30). es-AR uses a 12-hour clock.
		const out = formatDateTime('2026-06-04T02:30:00Z');
		expect(out).toContain('2026');
		expect(out).toContain('11:30');
		expect(out).toContain('3 jun');
	});

	it('echoes the raw value when it cannot be parsed', () => {
		expect(formatDateTime('not-a-date')).toBe('not-a-date');
	});
});
