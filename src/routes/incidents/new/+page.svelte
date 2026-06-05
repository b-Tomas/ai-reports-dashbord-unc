<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUSES } from '$lib/domain/incident';
	import type { ChemicalFormRow } from '$lib/domain/incidentForm';
	import { INCIDENT_TYPE_LABELS, SEVERITY_LABELS, STATUS_LABELS } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fieldErrors = $derived(form?.fieldErrors ?? {});
	const v = $derived(form?.values);

	// Dynamic rows. Intentionally seeded once from the submitted values on a failed
	// POST: this is a plain form submit (no `enhance`), so the component remounts
	// and this initial capture is exactly the repopulated state we want. `untrack`
	// marks the one-time read so it isn't treated as a stale reactive reference.
	// `actions` rows are wrapped as objects so each row binds to a stable reference
	// (primitive aliases can't be bound back); the input keeps name="actions_taken".
	let actions = $state<{ value: string }[]>(
		untrack(() =>
			v?.actions_taken?.length ? v.actions_taken.map((value) => ({ value })) : [{ value: '' }]
		)
	);
	let chemicals = $state<ChemicalFormRow[]>(
		untrack(() => (v?.chemicals?.length ? v.chemicals.map((c) => ({ ...c })) : []))
	);

	function addAction() {
		actions = [...actions, { value: '' }];
	}
	function removeAction(i: number) {
		actions = actions.filter((_, idx) => idx !== i);
		if (actions.length === 0) actions = [{ value: '' }];
	}
	function addChemical() {
		chemicals = [...chemicals, { name: '', hazard_class: '', estimated_quantity: '' }];
	}
	function removeChemical(i: number) {
		chemicals = chemicals.filter((_, idx) => idx !== i);
	}
</script>

<section class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<a href={resolve('/')} class="text-sm text-teal-primary hover:underline">← Volver a reportes</a>
	</div>

	<h2 class="text-xl font-semibold text-teal-primary">Nuevo reporte de incidente</h2>

	{#if form?.message}
		<p
			class="rounded border border-severity-critico/40 bg-severity-critico/10 px-3 py-2 text-sm text-severity-critico"
		>
			{form.message}
		</p>
	{/if}

	<form method="POST" action="?/create" class="space-y-6">
		<!-- Core fields -->
		<div
			class="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:grid-cols-2"
		>
			<label class="flex flex-col gap-1 text-sm sm:col-span-2">
				<span class="text-muted">Ubicación</span>
				<input
					type="text"
					name="location"
					value={v?.location ?? ''}
					placeholder="Laboratorio Central - Mesa 4"
					class="rounded border border-border px-2 py-1.5"
				/>
				{#if fieldErrors.location}
					<span class="text-xs text-severity-critico">{fieldErrors.location}</span>
				{/if}
			</label>

			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted">Fecha/hora del incidente</span>
				<input
					type="datetime-local"
					name="timestamp"
					value={v?.timestamp ?? data.nowLocal}
					class="rounded border border-border px-2 py-1.5"
				/>
				{#if fieldErrors.timestamp}
					<span class="text-xs text-severity-critico">{fieldErrors.timestamp}</span>
				{/if}
			</label>

			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted">Asistencia médica requerida</span>
				<span class="flex items-center gap-2 py-1.5">
					<input
						type="checkbox"
						name="medical_assistance_required"
						checked={v?.medical_assistance_required ?? false}
						class="h-4 w-4 rounded border-border"
					/>
					<span class="text-text">Sí</span>
				</span>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted">Tipo</span>
				<select
					name="incident_type"
					value={v?.incident_type ?? ''}
					class="rounded border border-border px-2 py-1.5"
				>
					<option value="" disabled>Seleccioná…</option>
					{#each INCIDENT_TYPES as t (t)}
						<option value={t}>{INCIDENT_TYPE_LABELS[t]}</option>
					{/each}
				</select>
				{#if fieldErrors.incident_type}
					<span class="text-xs text-severity-critico">{fieldErrors.incident_type}</span>
				{/if}
			</label>

			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted">Severidad</span>
				<select
					name="severity_level"
					value={v?.severity_level ?? ''}
					class="rounded border border-border px-2 py-1.5"
				>
					<option value="" disabled>Seleccioná…</option>
					{#each SEVERITY_LEVELS as s (s)}
						<option value={s}>{SEVERITY_LABELS[s]}</option>
					{/each}
				</select>
				{#if fieldErrors.severity_level}
					<span class="text-xs text-severity-critico">{fieldErrors.severity_level}</span>
				{/if}
			</label>

			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted">Estado</span>
				<select
					name="status"
					value={v?.status ?? 'ABIERTO'}
					class="rounded border border-border px-2 py-1.5"
				>
					{#each STATUSES as s (s)}
						<option value={s}>{STATUS_LABELS[s]}</option>
					{/each}
				</select>
				{#if fieldErrors.status}
					<span class="text-xs text-severity-critico">{fieldErrors.status}</span>
				{/if}
			</label>
		</div>

		<!-- Actions taken (≥1 required) -->
		<div class="rounded-lg border border-border bg-surface p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-semibold text-teal-primary">Acciones tomadas</h3>
				<button
					type="button"
					onclick={addAction}
					class="rounded border border-border px-2 py-1 text-xs transition hover:bg-bg"
				>
					+ Agregar acción
				</button>
			</div>
			{#if fieldErrors.actions_taken}
				<p class="mt-2 text-xs text-severity-critico">Agregá al menos una acción.</p>
			{/if}
			<div class="mt-3 space-y-2">
				{#each actions as action, i (i)}
					<div class="flex items-center gap-2">
						<input
							type="text"
							name="actions_taken"
							bind:value={action.value}
							placeholder="Acción tomada…"
							class="flex-1 rounded border border-border px-2 py-1.5 text-sm"
						/>
						<button
							type="button"
							onclick={() => removeAction(i)}
							aria-label="Quitar acción"
							class="rounded border border-border px-2 py-1.5 text-xs text-muted transition hover:bg-bg"
						>
							✕
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Chemicals (optional) -->
		<div class="rounded-lg border border-border bg-surface p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-semibold text-teal-primary">Sustancias involucradas</h3>
				<button
					type="button"
					onclick={addChemical}
					class="rounded border border-border px-2 py-1 text-xs transition hover:bg-bg"
				>
					+ Agregar sustancia
				</button>
			</div>
			{#if chemicals.length === 0}
				<p class="mt-2 text-sm text-muted">Ninguna registrada.</p>
			{:else}
				<div class="mt-3 space-y-3">
					{#each chemicals as chem, i (i)}
						<div
							class="grid grid-cols-1 gap-2 rounded border border-border bg-bg p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
						>
							<input
								type="text"
								name="chemical_name"
								bind:value={chem.name}
								placeholder="Nombre"
								class="rounded border border-border px-2 py-1.5 text-sm"
							/>
							<input
								type="text"
								name="chemical_hazard"
								bind:value={chem.hazard_class}
								placeholder="Clase de peligro (opc.)"
								class="rounded border border-border px-2 py-1.5 text-sm"
							/>
							<input
								type="text"
								name="chemical_qty"
								bind:value={chem.estimated_quantity}
								placeholder="Cantidad estimada (opc.)"
								class="rounded border border-border px-2 py-1.5 text-sm"
							/>
							<button
								type="button"
								onclick={() => removeChemical(i)}
								aria-label="Quitar sustancia"
								class="rounded border border-border px-2 py-1.5 text-xs text-muted transition hover:bg-bg"
							>
								✕
							</button>
						</div>
					{/each}
				</div>
			{/if}
			<p class="mt-2 text-xs text-muted">
				Solo se guardan las sustancias con nombre. El nombre es obligatorio por sustancia.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="submit"
				class="rounded bg-teal-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-dark"
			>
				Crear reporte
			</button>
			<a
				href={resolve('/')}
				class="rounded border border-border px-4 py-2 text-sm text-muted transition hover:bg-bg"
			>
				Cancelar
			</a>
		</div>
	</form>
</section>
