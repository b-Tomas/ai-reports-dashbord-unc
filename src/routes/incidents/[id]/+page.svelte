<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { STATUSES } from '$lib/domain/incident';
	import {
		INCIDENT_TYPE_LABELS,
		SEVERITY_LABELS,
		STATUS_LABELS,
		SEVERITY_BADGE,
		STATUS_BADGE,
		formatDateTime
	} from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const report = $derived(data.report);
	const isAdmin = $derived(data.role === 'admin');
</script>

<section class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<a href={resolve('/')} class="text-sm text-teal-primary hover:underline">← Volver a reportes</a>
		<div class="flex items-center gap-2">
			<span
				class={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[report.severity_level]}`}
			>
				{SEVERITY_LABELS[report.severity_level]}
			</span>
			<span class={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[report.status]}`}>
				{STATUS_LABELS[report.status]}
			</span>
		</div>
	</div>

	<div>
		<h2 class="text-xl font-semibold text-teal-primary">
			{INCIDENT_TYPE_LABELS[report.incident_type]} — {report.location}
		</h2>
		<p class="mt-1 text-sm text-muted">{formatDateTime(report.timestamp)}</p>
	</div>

	{#if form?.message}
		<p
			class="rounded border border-severity-critico/40 bg-severity-critico/10 px-3 py-2 text-sm text-severity-critico"
		>
			{form.message}
		</p>
	{:else if form?.updated}
		<p
			class="rounded border border-severity-bajo/40 bg-severity-bajo/10 px-3 py-2 text-sm text-severity-bajo"
		>
			Estado actualizado.
		</p>
	{/if}

	<!-- Core fields -->
	<dl
		class="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:grid-cols-2"
	>
		<div>
			<dt class="text-xs tracking-wide text-muted uppercase">Tipo</dt>
			<dd class="text-text">{INCIDENT_TYPE_LABELS[report.incident_type]}</dd>
		</div>
		<div>
			<dt class="text-xs tracking-wide text-muted uppercase">Ubicación</dt>
			<dd class="text-text">{report.location}</dd>
		</div>
		<div>
			<dt class="text-xs tracking-wide text-muted uppercase">Severidad</dt>
			<dd class="text-text">{SEVERITY_LABELS[report.severity_level]}</dd>
		</div>
		<div>
			<dt class="text-xs tracking-wide text-muted uppercase">Estado</dt>
			<dd class="text-text">{STATUS_LABELS[report.status]}</dd>
		</div>
		<div>
			<dt class="text-xs tracking-wide text-muted uppercase">Asistencia médica</dt>
			<dd class="text-text">{report.medical_assistance_required ? 'Sí' : 'No'}</dd>
		</div>
		<div>
			<dt class="text-xs tracking-wide text-muted uppercase">Fecha/hora del incidente</dt>
			<dd class="text-text">{formatDateTime(report.timestamp)}</dd>
		</div>
	</dl>

	<!-- Chemicals -->
	<div class="rounded-lg border border-border bg-surface p-5 shadow-sm">
		<h3 class="text-sm font-semibold text-teal-primary">Sustancias involucradas</h3>
		{#if report.chemicals_involved.length === 0}
			<p class="mt-2 text-sm text-muted">Ninguna registrada.</p>
		{:else}
			<ul class="mt-3 space-y-2">
				{#each report.chemicals_involved as chem, i (i)}
					<li class="rounded border border-border bg-bg px-3 py-2 text-sm">
						<span class="font-medium text-text">{chem.name}</span>
						{#if chem.hazard_class}<span class="text-muted">
								· Clase: {chem.hazard_class}</span
							>{/if}
						{#if chem.estimated_quantity}<span class="text-muted">
								· Cantidad: {chem.estimated_quantity}</span
							>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Actions taken -->
	<div class="rounded-lg border border-border bg-surface p-5 shadow-sm">
		<h3 class="text-sm font-semibold text-teal-primary">Acciones tomadas</h3>
		<ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-text">
			{#each report.actions_taken as action, i (i)}
				<li>{action}</li>
			{/each}
		</ul>
	</div>

	<!-- Admin controls -->
	{#if isAdmin}
		<div class="rounded-lg border border-gold/60 bg-gold/10 p-5 shadow-sm">
			<h3 class="text-sm font-semibold text-gold-dark">Acciones de administrador</h3>

			<form
				method="POST"
				action="?/updateStatus"
				use:enhance
				class="mt-3 flex flex-wrap items-end gap-2"
			>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-muted">Cambiar estado</span>
					<select
						name="status"
						value={report.status}
						class="rounded border border-border bg-surface px-2 py-1.5"
					>
						{#each STATUSES as s (s)}
							<option value={s}>{STATUS_LABELS[s]}</option>
						{/each}
					</select>
				</label>
				<button
					type="submit"
					class="rounded bg-teal-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-dark"
				>
					Guardar
				</button>
			</form>

			<form
				method="POST"
				action="?/softDelete"
				use:enhance
				class="mt-4 border-t border-gold/40 pt-4"
				onsubmit={(e) => {
					if (!confirm('¿Eliminar este reporte? Pasará a la papelera.')) e.preventDefault();
				}}
			>
				<button
					type="submit"
					class="rounded border border-severity-critico px-3 py-1.5 text-sm font-medium text-severity-critico transition hover:bg-severity-critico hover:text-white"
				>
					Eliminar reporte
				</button>
			</form>
		</div>
	{/if}

	<!-- Audit metadata -->
	<dl class="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-3">
		<div>
			<dt class="inline">ID:</dt>
			<dd class="inline font-mono">{report.id}</dd>
		</div>
		<div>
			<dt class="inline">Creado:</dt>
			<dd class="inline">{formatDateTime(report.created_at)}</dd>
		</div>
		<div>
			<dt class="inline">Actualizado:</dt>
			<dd class="inline">{formatDateTime(report.updated_at)}</dd>
		</div>
	</dl>
</section>
