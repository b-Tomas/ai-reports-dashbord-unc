<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Panel de Reportes de Incidentes — FCEFyN</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- Branding header (placeholder shell — Block 9 finalizes) -->
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

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="border-t border-border bg-surface text-muted">
		<div class="mx-auto max-w-6xl px-4 py-3 text-center text-xs">
			FCEFyN · UNC — Laboratorio · Reportes de incidentes
		</div>
	</footer>
</div>
