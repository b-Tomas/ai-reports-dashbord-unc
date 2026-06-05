/**
 * Metrics aggregation. Reads `api_usage` via the SQL aggregation RPCs so
 * counts are exact regardless of row volume. Service-role only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 30;

export interface DateRange {
	/** Inclusive instant bounds passed to the RPCs. */
	from: string;
	to: string;
	/** Date-only values (YYYY-MM-DD) to repopulate the range form. */
	fromDate: string;
	toDate: string;
}

const dateOnly = z.iso.date();

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * Resolve the {from,to} range from query params, defaulting to the last
 * {@link DEFAULT_WINDOW_DAYS} days ending at `now`. `now` is injected so this
 * stays pure/testable.
 */
export function parseRange(searchParams: URLSearchParams, now: Date): DateRange {
	const get = (k: string) => {
		const v = searchParams.get(k);
		return v && dateOnly.safeParse(v).success ? v : undefined;
	};
	const toDate = get('to') ?? isoDate(now);
	const fromDate =
		get('from') ?? isoDate(new Date(now.getTime() - (DEFAULT_WINDOW_DAYS - 1) * DAY_MS));
	return {
		fromDate,
		toDate,
		from: `${fromDate}T00:00:00Z`,
		to: `${toDate}T23:59:59.999Z`
	};
}

export interface DailyPoint {
	day: string;
	tool_calls: number;
	retrievals: number;
	creates: number;
	errors: number;
}

export interface KeyBreakdown {
	api_key_id: string | null;
	name: string | null;
	tool_calls: number;
	errors: number;
}

export interface Totals {
	toolCalls: number;
	retrievals: number;
	creates: number;
	errors: number;
	/** errors / toolCalls, in [0,1]; 0 when there is no traffic. */
	errorRate: number;
}

export interface Metrics {
	totals: Totals;
	series: DailyPoint[];
	byKey: KeyBreakdown[];
}

/** Sum a daily series into the headline totals + error rate. Pure. */
export function computeTotals(series: DailyPoint[]): Totals {
	const t = series.reduce(
		(acc, p) => {
			acc.toolCalls += p.tool_calls;
			acc.retrievals += p.retrievals;
			acc.creates += p.creates;
			acc.errors += p.errors;
			return acc;
		},
		{ toolCalls: 0, retrievals: 0, creates: 0, errors: 0 }
	);
	return { ...t, errorRate: t.toolCalls ? t.errors / t.toolCalls : 0 };
}

const n = (v: unknown) => Number(v ?? 0);

export async function getMetrics(supabase: SupabaseClient, range: DateRange): Promise<Metrics> {
	const args = { p_from: range.from, p_to: range.to };
	const [daily, byKey] = await Promise.all([
		supabase.rpc('api_usage_daily', args),
		supabase.rpc('api_usage_by_key', args)
	]);
	if (daily.error) throw new Error(`metrics daily: ${daily.error.message}`);
	if (byKey.error) throw new Error(`metrics by-key: ${byKey.error.message}`);

	const series: DailyPoint[] = (daily.data ?? []).map((r: Record<string, unknown>) => ({
		day: String(r.day),
		tool_calls: n(r.tool_calls),
		retrievals: n(r.retrievals),
		creates: n(r.creates),
		errors: n(r.errors)
	}));
	const breakdown: KeyBreakdown[] = (byKey.data ?? []).map((r: Record<string, unknown>) => ({
		api_key_id: (r.api_key_id as string) ?? null,
		name: (r.name as string) ?? null,
		tool_calls: n(r.tool_calls),
		errors: n(r.errors)
	}));

	return { totals: computeTotals(series), series, byKey: breakdown };
}
