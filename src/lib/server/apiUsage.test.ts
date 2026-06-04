import { describe, it, expect } from 'vitest';
import { resolveRouteName } from './apiUsage';

describe('resolveRouteName', () => {
	it('maps incident endpoints to logical names', () => {
		expect(resolveRouteName('POST', '/api/v1/incidents')).toBe('create_incident');
		expect(resolveRouteName('GET', '/api/v1/incidents')).toBe('list_incidents');
		expect(resolveRouteName('GET', '/api/v1/incidents/abc-123')).toBe('get_incident');
		expect(resolveRouteName('PATCH', '/api/v1/incidents/abc-123')).toBe('update_incident');
		expect(resolveRouteName('DELETE', '/api/v1/incidents/abc-123')).toBe('delete_incident');
	});

	it('tolerates a trailing slash on the collection', () => {
		expect(resolveRouteName('GET', '/api/v1/incidents/')).toBe('list_incidents');
	});

	it('falls back to the first segment for unknown api routes', () => {
		expect(resolveRouteName('GET', '/api/v1/health')).toBe('health');
		expect(resolveRouteName('GET', '/api/v1/')).toBe('unknown');
	});
});
