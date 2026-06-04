<script lang="ts">
	import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUSES } from '$lib/domain/incident';
	import {
		INCIDENT_TYPE_LABELS,
		SEVERITY_LABELS,
		STATUS_LABELS,
		SEVERITY_BADGE,
		STATUS_BADGE,
		formatDateTime
	} from '$lib/format';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const result = $derived(data.result);
	const items = $derived(result?.items ?? []);
	const total = $derived(result?.total ?? 0);
	const limit = $derived(result?.limit ?? 25);
	const offset = $derived(result?.offset ?? 0);
	const from = $derived(offset + 1);
	const to = $derived(Math.min(offset + limit, total));
	const hasPrev = $derived(offset > 0);
	const hasNext = $derived(offset + limit < total);

	/** Build a list URL that keeps the active filters but changes the offset. */
	function pageHref(nextOffset: number): ResolvedPathname {
		const parts: string[] = [];
		for (const [k, v] of Object.entries(data.filters)) {
			if (v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
		}
		if (nextOffset > 0) parts.push(`offset=${nextOffset}`);
		const base = resolve('/');
		return (parts.length ? `${base}?${parts.join('&')}` : base) as ResolvedPathname;
	}
</script>

<section class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-teal-primary">Reportes de incidentes</h2>
		{#if result}
			<span class="text-sm text-muted">{total} {total === 1 ? 'reporte' : 'reportes'}</span>
		{/if}
	</div>

	<!-- Filters (GET → query string) -->
	<form
		method="GET"
		class="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6"
	>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-muted">Tipo</span>
			<select
				name="incident_type"
				value={data.filters.incident_type}
				class="rounded border border-border px-2 py-1.5"
			>
				<option value="">Todos</option>
				{#each INCIDENT_TYPES as t (t)}
					<option value={t}>{INCIDENT_TYPE_LABELS[t]}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="text-muted">Severidad</span>
			<select
				name="severity_level"
				value={data.filters.severity_level}
				class="rounded border border-border px-2 py-1.5"
			>
				<option value="">Todas</option>
				{#each SEVERITY_LEVELS as s (s)}
					<option value={s}>{SEVERITY_LABELS[s]}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="text-muted">Estado</span>
			<select
				name="status"
				value={data.filters.status}
				class="rounded border border-border px-2 py-1.5"
			>
				<option value="">Todos</option>
				{#each STATUSES as s (s)}
					<option value={s}>{STATUS_LABELS[s]}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="text-muted">Desde</span>
			<input
				type="date"
				name="from"
				value={data.filters.from}
				class="rounded border border-border px-2 py-1.5"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			<span class="text-muted">Hasta</span>
			<input
				type="date"
				name="to"
				value={data.filters.to}
				class="rounded border border-border px-2 py-1.5"
			/>
		</label>

		<div class="flex items-end gap-2">
			<button
				type="submit"
				class="rounded bg-teal-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-dark"
			>
				Filtrar
			</button>
			<a
				href={resolve('/')}
				class="rounded border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-bg"
			>
				Limpiar
			</a>
		</div>
	</form>

	{#if data.loadError}
		<div
			class="rounded-lg border border-severity-critico/40 bg-severity-critico/10 p-6 text-center text-severity-critico"
		>
			{data.loadError}
		</div>
	{:else if items.length === 0}
		<div class="rounded-lg border border-border bg-surface p-10 text-center text-muted shadow-sm">
			No hay reportes que coincidan con los filtros.
		</div>
	{:else}
		<!-- Desktop table -->
		<div
			class="hidden overflow-hidden rounded-lg border border-border bg-surface shadow-sm sm:block"
		>
			<table class="w-full text-sm">
				<thead class="bg-bg text-left text-xs tracking-wide text-muted uppercase">
					<tr>
						<th class="px-3 py-2 font-semibold">Fecha/hora</th>
						<th class="px-3 py-2 font-semibold">Ubicación</th>
						<th class="px-3 py-2 font-semibold">Tipo</th>
						<th class="px-3 py-2 font-semibold">Severidad</th>
						<th class="px-3 py-2 font-semibold">Estado</th>
						<th class="px-3 py-2 text-center font-semibold">Asist. médica</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						{@const href = resolve('/incidents/[id]', { id: item.id })}
						<tr class="cursor-pointer border-t border-border transition hover:bg-bg">
							<td class="px-3 py-2 whitespace-nowrap">
								<a {href} class="block text-text">{formatDateTime(item.timestamp)}</a>
							</td>
							<td class="px-3 py-2"><a {href} class="block">{item.location}</a></td>
							<td class="px-3 py-2"
								><a {href} class="block">{INCIDENT_TYPE_LABELS[item.incident_type]}</a></td
							>
							<td class="px-3 py-2">
								<a {href} class="block">
									<span
										class={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[item.severity_level]}`}
									>
										{SEVERITY_LABELS[item.severity_level]}
									</span>
								</a>
							</td>
							<td class="px-3 py-2">
								<a {href} class="block">
									<span
										class={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[item.status]}`}
									>
										{STATUS_LABELS[item.status]}
									</span>
								</a>
							</td>
							<td class="px-3 py-2 text-center">
								<a {href} class="block">{item.medical_assistance_required ? 'Sí' : 'No'}</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile cards -->
		<ul class="space-y-3 sm:hidden">
			{#each items as item (item.id)}
				<li>
					<a
						href={resolve('/incidents/[id]', { id: item.id })}
						class="block rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:bg-bg"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="font-medium text-text">{INCIDENT_TYPE_LABELS[item.incident_type]}</span>
							<span
								class={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[item.severity_level]}`}
							>
								{SEVERITY_LABELS[item.severity_level]}
							</span>
						</div>
						<p class="mt-1 text-sm text-muted">{item.location}</p>
						<div class="mt-2 flex items-center justify-between text-xs text-muted">
							<span>{formatDateTime(item.timestamp)}</span>
							<span class={`rounded px-2 py-0.5 font-semibold ${STATUS_BADGE[item.status]}`}>
								{STATUS_LABELS[item.status]}
							</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>

		<!-- Pagination -->
		<div class="flex items-center justify-between text-sm">
			<span class="text-muted">{from}–{to} de {total}</span>
			<div class="flex gap-2">
				{#if hasPrev}
					<a
						href={pageHref(Math.max(0, offset - limit))}
						class="rounded border border-border px-3 py-1.5 transition hover:bg-bg">Anterior</a
					>
				{:else}
					<span class="rounded border border-border px-3 py-1.5 text-muted/50">Anterior</span>
				{/if}
				{#if hasNext}
					<a
						href={pageHref(offset + limit)}
						class="rounded border border-border px-3 py-1.5 transition hover:bg-bg">Siguiente</a
					>
				{:else}
					<span class="rounded border border-border px-3 py-1.5 text-muted/50">Siguiente</span>
				{/if}
			</div>
		</div>
	{/if}
</section>
