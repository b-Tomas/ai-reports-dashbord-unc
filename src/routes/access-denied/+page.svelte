<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section
	class="mx-auto mt-10 max-w-md rounded-lg border border-border bg-surface p-8 text-center shadow-sm"
>
	<h2 class="text-2xl font-semibold text-severity-critico">Acceso denegado</h2>
	<p class="mt-3 text-muted">
		La cuenta{#if data.email}
			<span class="font-medium text-text">&nbsp;{data.email}</span>{/if} no está autorizada para acceder
		a este panel.
	</p>
	<p class="mt-2 text-sm text-muted">
		Solicite acceso a un administrador o ingrese con otra cuenta.
	</p>

	<form method="POST" action="/auth/signout" class="mt-6">
		<button
			type="submit"
			class="rounded bg-teal-primary px-4 py-2 font-medium text-white transition hover:bg-teal-dark"
		>
			Cerrar sesión
		</button>
	</form>
</section>
