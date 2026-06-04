<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		INCIDENT_TYPE_LABELS,
		SEVERITY_LABELS,
		SEVERITY_BADGE,
		formatDateTime
	} from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-xl font-semibold text-teal-primary">Papelera</h2>
		<a href={resolve('/admin')} class="text-sm text-teal-primary hover:underline"
			>← Administración</a
		>
	</div>

	{#if form?.message}
		<p
			class="rounded border border-severity-critico/40 bg-severity-critico/10 px-3 py-2 text-sm text-severity-critico"
		>
			{form.message}
		</p>
	{:else if form?.restored}
		<p
			class="rounded border border-severity-bajo/40 bg-severity-bajo/10 px-3 py-2 text-sm text-severity-bajo"
		>
			Reporte restaurado.
		</p>
	{:else if form?.purged}
		<p class="rounded border border-border bg-bg px-3 py-2 text-sm text-muted">
			Reporte eliminado de forma permanente.
		</p>
	{/if}

	{#if data.items.length === 0}
		<div class="rounded-lg border border-border bg-surface p-10 text-center text-muted shadow-sm">
			La papelera está vacía.
		</div>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
			<table class="w-full text-sm">
				<thead class="bg-bg text-left text-xs tracking-wide text-muted uppercase">
					<tr>
						<th class="px-3 py-2 font-semibold">Eliminado</th>
						<th class="px-3 py-2 font-semibold">Ubicación</th>
						<th class="px-3 py-2 font-semibold">Tipo</th>
						<th class="px-3 py-2 font-semibold">Severidad</th>
						<th class="px-3 py-2"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as item (item.id)}
						<tr class="border-t border-border">
							<td class="px-3 py-2 whitespace-nowrap text-muted"
								>{formatDateTime(item.deleted_at)}</td
							>
							<td class="px-3 py-2">{item.location}</td>
							<td class="px-3 py-2">{INCIDENT_TYPE_LABELS[item.incident_type]}</td>
							<td class="px-3 py-2">
								<span
									class={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[item.severity_level]}`}
								>
									{SEVERITY_LABELS[item.severity_level]}
								</span>
							</td>
							<td class="px-3 py-2">
								<div class="flex justify-end gap-3">
									<form method="POST" action="?/restore" use:enhance>
										<input type="hidden" name="id" value={item.id} />
										<button type="submit" class="text-teal-primary hover:underline"
											>Restaurar</button
										>
									</form>
									<form
										method="POST"
										action="?/hardDelete"
										use:enhance
										onsubmit={(e) => {
											if (
												!confirm(
													'¿Eliminar este reporte de forma permanente? Esta acción no se puede deshacer.'
												)
											)
												e.preventDefault();
										}}
									>
										<input type="hidden" name="id" value={item.id} />
										<button type="submit" class="text-severity-critico hover:underline">
											Eliminar definitivamente
										</button>
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
