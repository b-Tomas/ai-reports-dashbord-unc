import { describe, it, expect } from 'vitest';
import { parseRange, computeTotals, type DailyPoint } from './metricsRepo';

const sp = (q: string) => new URLSearchParams(q);
const NOW = new Date('2026-06-04T10:00:00Z');

describe('parseRange', () => {
	it('defaults to the last 30 days ending today', () => {
		const r = parseRange(sp(''), NOW);
		expect(r.toDate).toBe('2026-06-04');
		expect(r.fromDate).toBe('2026-05-06'); // 30-day inclusive window
		expect(r.from).toBe('2026-05-06T00:00:00Z');
		expect(r.to).toBe('2026-06-04T23:59:59.999Z');
	});

	it('uses valid query dates and ignores junk', () => {
		const r = parseRange(sp('from=2026-01-01&to=not-a-date'), NOW);
		expect(r.fromDate).toBe('2026-01-01');
		expect(r.toDate).toBe('2026-06-04'); // junk `to` falls back to the default
	});
});

describe('computeTotals', () => {
	const series: DailyPoint[] = [
		{ day: '2026-06-01', tool_calls: 10, retrievals: 6, creates: 2, errors: 1 },
		{ day: '2026-06-02', tool_calls: 30, retrievals: 20, creates: 5, errors: 3 }
	];

	it('sums the series and derives the error rate', () => {
		const t = computeTotals(series);
		expect(t).toMatchObject({ toolCalls: 40, retrievals: 26, creates: 7, errors: 4 });
		expect(t.errorRate).toBeCloseTo(0.1);
	});

	it('reports a zero error rate when there is no traffic', () => {
		expect(computeTotals([]).errorRate).toBe(0);
	});
});
