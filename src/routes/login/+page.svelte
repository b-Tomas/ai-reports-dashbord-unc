<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<section class="mx-auto mt-10 max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm">
	<h2 class="text-center text-2xl font-semibold text-teal-primary">Acceso al panel</h2>
	<p class="mt-2 text-center text-sm text-muted">
		Reportes de incidentes de laboratorio — FCEFyN, UNC.
	</p>

	{#if form?.message}
		<p
			class="mt-4 rounded border border-severity-critico/40 bg-severity-critico/10 px-3 py-2 text-sm text-severity-critico"
		>
			{form.message}
		</p>
	{/if}

	<form method="POST" use:enhance class="mt-6">
		<button
			type="submit"
			class="w-full rounded bg-teal-primary px-4 py-2.5 font-medium text-white transition hover:bg-teal-dark"
		>
			Iniciar sesión con Google
		</button>
	</form>

	<p class="mt-4 text-center text-xs text-muted">
		Solo cuentas autorizadas por un administrador pueden ingresar.
	</p>
</section>
