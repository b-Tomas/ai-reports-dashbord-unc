<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	const roleLabel = $derived(data.role === 'admin' ? 'Administrador' : 'Visualizador');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Panel de Reportes de Incidentes — FCEFyN</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- FCEFyN brand bar: gold accent over the teal-bordered header (palette §5.3). -->
	<div class="h-1 bg-gold"></div>
	<header class="border-b-4 border-teal-primary bg-surface shadow-sm">
		<div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
			<img src="/FCEFyN.png" alt="FCEFyN" class="h-11 w-auto sm:h-12" />
			<div class="min-w-0 flex-1 text-center">
				<h1 class="truncate text-lg font-semibold text-teal-primary sm:text-xl">
					Panel de Reportes de Incidentes
				</h1>
				<p class="text-xs text-teal-alt sm:text-sm">FCEFyN · Universidad Nacional de Córdoba</p>
			</div>
			<img src="/UNC.jpg" alt="UNC" class="h-11 w-auto sm:h-12" />
		</div>
	</header>

	{#if data.user}
		<div class="border-b border-border bg-surface">
			<div
				class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
			>
				<nav class="flex items-center gap-4">
					<a href={resolve('/')} class="font-medium text-teal-primary hover:underline">Reportes</a>
					<a href={resolve('/incidents/new')} class="font-medium text-teal-primary hover:underline">
						Nuevo reporte
					</a>
					<a href={resolve('/metrics')} class="font-medium text-teal-primary hover:underline">
						Métricas
					</a>
					{#if data.role === 'admin'}
						<a href={resolve('/admin')} class="font-medium text-teal-primary hover:underline">
							Administración
						</a>
					{/if}
				</nav>
				<div class="flex items-center gap-3 text-muted">
					<span class="truncate">{data.user.email} · {roleLabel}</span>
					<form method="POST" action="/auth/signout">
						<button
							type="submit"
							class="rounded border border-border px-2 py-1 transition hover:bg-bg"
						>
							Cerrar sesión
						</button>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="border-t border-border bg-surface text-muted">
		<div class="mx-auto max-w-6xl px-4 py-3 text-center text-xs">
			FCEFyN · UNC — Laboratorio · Reportes de incidentes
		</div>
	</footer>
</div>
