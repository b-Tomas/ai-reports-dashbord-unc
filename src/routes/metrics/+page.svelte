<script lang="ts">
	import { resolve } from '$app/paths';
	import Chart from '$lib/components/Chart.svelte';
	import type { ChartConfiguration } from 'chart.js/auto';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const metrics = $derived(data.metrics);
	const totals = $derived(metrics?.totals);
	const hasTraffic = $derived((totals?.toolCalls ?? 0) > 0);

	const COLORS = {
		teal: '#205650',
		tealAlt: '#2c5f66',
		green: '#2e7d32',
		red: '#c0392b',
		gold: '#ddcf82'
	};

	const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
	const keyLabel = (k: { api_key_id: string | null; name: string | null }) =>
		k.name ?? (k.api_key_id ? '(clave eliminada)' : '(sin clave / inválida)');

	const lineConfig = $derived<ChartConfiguration>({
		type: 'line',
		data: {
			labels: metrics?.series.map((p) => p.day) ?? [],
			datasets: [
				{
					label: 'Llamadas',
					data: metrics?.series.map((p) => p.tool_calls) ?? [],
					borderColor: COLORS.teal,
					backgroundColor: COLORS.teal,
					tension: 0.25
				},
				{
					label: 'Lecturas (GET)',
					data: metrics?.series.map((p) => p.retrievals) ?? [],
					borderColor: COLORS.tealAlt,
					backgroundColor: COLORS.tealAlt,
					tension: 0.25
				},
				{
					label: 'Creaciones',
					data: metrics?.series.map((p) => p.creates) ?? [],
					borderColor: COLORS.green,
					backgroundColor: COLORS.green,
					tension: 0.25
				},
				{
					label: 'Errores',
					data: metrics?.series.map((p) => p.errors) ?? [],
					borderColor: COLORS.red,
					backgroundColor: COLORS.red,
					tension: 0.25
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index', intersect: false },
			scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
		}
	});

	const barConfig = $derived<ChartConfiguration>({
		type: 'bar',
		data: {
			labels: metrics?.byKey.map(keyLabel) ?? [],
			datasets: [
				{
					label: 'Llamadas',
					data: metrics?.byKey.map((k) => k.tool_calls) ?? [],
					backgroundColor: COLORS.teal
				},
				{
					label: 'Errores',
					data: metrics?.byKey.map((k) => k.errors) ?? [],
					backgroundColor: COLORS.red
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
		}
	});
</script>

<section class="space-y-6">
	<h2 class="text-xl font-semibold text-teal-primary">Métricas de la API del agente</h2>

	<!-- Date range (GET form, serialized to the query string) -->
	<form
		method="GET"
		class="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
	>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-muted">Desde</span>
			<input
				type="date"
				name="from"
				value={data.range.fromDate}
				class="rounded border border-border px-2 py-1.5"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-muted">Hasta</span>
			<input
				type="date"
				name="to"
				value={data.range.toDate}
				class="rounded border border-border px-2 py-1.5"
			/>
		</label>
		<button
			type="submit"
			class="rounded bg-teal-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-dark"
		>
			Aplicar
		</button>
		<a
			href={resolve('/metrics')}
			class="rounded border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-bg"
		>
			Últimos 30 días
		</a>
	</form>

	{#if data.loadError}
		<div
			class="rounded-lg border border-severity-critico/40 bg-severity-critico/10 p-6 text-center text-severity-critico"
		>
			{data.loadError}
		</div>
	{:else if totals}
		<!-- Headline cards -->
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each [{ label: 'Llamadas (tool calls)', value: totals.toolCalls }, { label: 'Lecturas (GET)', value: totals.retrievals }, { label: 'Creaciones', value: totals.creates }, { label: 'Tasa de error', value: pct(totals.errorRate) }] as card (card.label)}
				<div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
					<p class="text-xs tracking-wide text-muted uppercase">{card.label}</p>
					<p class="mt-1 text-2xl font-semibold text-teal-primary">{card.value}</p>
				</div>
			{/each}
		</div>

		{#if !hasTraffic}
			<div class="rounded-lg border border-border bg-surface p-10 text-center text-muted shadow-sm">
				No hay actividad de la API en este rango.
			</div>
		{:else}
			<!-- Time series -->
			<div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
				<h3 class="mb-3 text-sm font-semibold text-teal-primary">Actividad por día</h3>
				<div class="h-72">
					<Chart config={lineConfig} />
				</div>
			</div>

			<!-- Per-key breakdown -->
			<div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
				<h3 class="mb-3 text-sm font-semibold text-teal-primary">Por clave de API</h3>
				<div class="h-64">
					<Chart config={barConfig} />
				</div>
				<div class="mt-4 overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-bg text-left text-xs tracking-wide text-muted uppercase">
							<tr>
								<th class="px-3 py-2 font-semibold">Clave</th>
								<th class="px-3 py-2 font-semibold">Llamadas</th>
								<th class="px-3 py-2 font-semibold">Errores</th>
								<th class="px-3 py-2 font-semibold">Tasa de error</th>
							</tr>
						</thead>
						<tbody>
							{#each metrics?.byKey ?? [] as k (k.api_key_id ?? 'none')}
								<tr class="border-t border-border">
									<td class="px-3 py-2">{keyLabel(k)}</td>
									<td class="px-3 py-2">{k.tool_calls}</td>
									<td class="px-3 py-2">{k.errors}</td>
									<td class="px-3 py-2">{pct(k.tool_calls ? k.errors / k.tool_calls : 0)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</section>
