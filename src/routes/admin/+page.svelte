<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatDateTime } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const typeLabel = (t: string) => (t === 'email' ? 'Email' : 'Dominio');
	const roleLabel = (r: string) => (r === 'admin' ? 'Administrador' : 'Visualizador');
</script>

<section class="space-y-8">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-xl font-semibold text-teal-primary">Administración</h2>
		<a href={resolve('/admin/trash')} class="text-sm text-teal-primary hover:underline">
			Papelera →
		</a>
	</div>

	{#if form?.message}
		<p
			class="rounded border border-severity-critico/40 bg-severity-critico/10 px-3 py-2 text-sm text-severity-critico"
		>
			{form.message}
		</p>
	{/if}

	<!-- Freshly issued key — shown ONCE -->
	{#if form?.createdKey}
		<div class="rounded-lg border border-gold/60 bg-gold/10 p-4 shadow-sm">
			<h3 class="text-sm font-semibold text-gold-dark">
				Clave «{form.createdKey.name}» creada
			</h3>
			<p class="mt-1 text-xs text-muted">Cópiela ahora: por seguridad no se volverá a mostrar.</p>
			<code
				class="mt-2 block overflow-x-auto rounded border border-border bg-surface px-3 py-2 text-sm"
			>
				{form.createdKey.plaintext}
			</code>
		</div>
	{/if}

	<!-- ===================== Allowlist ===================== -->
	<div class="space-y-3">
		<h3 class="text-lg font-semibold text-teal-primary">Lista de acceso</h3>

		<form
			method="POST"
			action="?/addAccess"
			use:enhance
			class="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:grid-cols-4"
		>
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted">Tipo</span>
				<select name="type" class="rounded border border-border px-2 py-1.5">
					<option value="email">Email</option>
					<option value="domain">Dominio</option>
				</select>
			</label>
			<label class="flex flex-col gap-1 text-sm sm:col-span-2">
				<span class="text-muted">Valor</span>
				<input
					name="value"
					placeholder="jdoe@unc.edu.ar o unc.edu.ar"
					class="rounded border border-border px-2 py-1.5"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-muted">Rol</span>
				<select name="role" class="rounded border border-border px-2 py-1.5">
					<option value="viewer">Visualizador</option>
					<option value="admin">Administrador</option>
				</select>
			</label>
			<div class="sm:col-span-4">
				<button
					type="submit"
					class="rounded bg-teal-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-dark"
				>
					Agregar
				</button>
			</div>
		</form>

		{#if data.access.length === 0}
			<p
				class="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted shadow-sm"
			>
				No hay entradas en la lista de acceso.
			</p>
		{:else}
			<div class="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
				<table class="w-full text-sm">
					<thead class="bg-bg text-left text-xs tracking-wide text-muted uppercase">
						<tr>
							<th class="px-3 py-2 font-semibold">Tipo</th>
							<th class="px-3 py-2 font-semibold">Valor</th>
							<th class="px-3 py-2 font-semibold">Rol</th>
							<th class="px-3 py-2 font-semibold">Agregado</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.access as entry (entry.id)}
							<tr class="border-t border-border">
								<td class="px-3 py-2">{typeLabel(entry.type)}</td>
								<td class="px-3 py-2">{entry.value}</td>
								<td class="px-3 py-2">{roleLabel(entry.role)}</td>
								<td class="px-3 py-2 whitespace-nowrap text-muted"
									>{formatDateTime(entry.created_at)}</td
								>
								<td class="px-3 py-2 text-right">
									<form
										method="POST"
										action="?/removeAccess"
										use:enhance
										onsubmit={(e) => {
											if (!confirm(`¿Quitar ${entry.value} de la lista?`)) e.preventDefault();
										}}
									>
										<input type="hidden" name="id" value={entry.id} />
										<button type="submit" class="text-severity-critico hover:underline"
											>Quitar</button
										>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- ===================== API keys ===================== -->
	<div class="space-y-3">
		<h3 class="text-lg font-semibold text-teal-primary">Claves de API</h3>

		<form
			method="POST"
			action="?/createKey"
			use:enhance
			class="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm"
		>
			<label class="flex flex-1 flex-col gap-1 text-sm">
				<span class="text-muted">Nombre</span>
				<input
					name="name"
					placeholder="langchain-agent-prod"
					class="rounded border border-border px-2 py-1.5"
				/>
			</label>
			<button
				type="submit"
				class="rounded bg-teal-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-dark"
			>
				Emitir clave
			</button>
		</form>

		{#if data.keys.length === 0}
			<p
				class="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted shadow-sm"
			>
				No hay claves de API.
			</p>
		{:else}
			<div class="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
				<table class="w-full text-sm">
					<thead class="bg-bg text-left text-xs tracking-wide text-muted uppercase">
						<tr>
							<th class="px-3 py-2 font-semibold">Nombre</th>
							<th class="px-3 py-2 font-semibold">Prefijo</th>
							<th class="px-3 py-2 font-semibold">Creada</th>
							<th class="px-3 py-2 font-semibold">Estado</th>
							<th class="px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.keys as key (key.id)}
							<tr class="border-t border-border">
								<td class="px-3 py-2">{key.name}</td>
								<td class="px-3 py-2 font-mono text-xs">{key.key_prefix}…</td>
								<td class="px-3 py-2 whitespace-nowrap text-muted"
									>{formatDateTime(key.created_at)}</td
								>
								<td class="px-3 py-2">
									{#if key.revoked_at}
										<span class="rounded bg-muted/15 px-2 py-0.5 text-xs font-semibold text-muted">
											Revocada
										</span>
									{:else}
										<span
											class="rounded bg-severity-bajo/10 px-2 py-0.5 text-xs font-semibold text-severity-bajo"
										>
											Activa
										</span>
									{/if}
								</td>
								<td class="px-3 py-2 text-right">
									{#if !key.revoked_at}
										<form
											method="POST"
											action="?/revokeKey"
											use:enhance
											onsubmit={(e) => {
												if (!confirm(`¿Revocar la clave «${key.name}»? Dejará de funcionar.`))
													e.preventDefault();
											}}
										>
											<input type="hidden" name="id" value={key.id} />
											<button type="submit" class="text-severity-critico hover:underline"
												>Revocar</button
											>
										</form>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>
