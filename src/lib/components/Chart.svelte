<script lang="ts">
	import { Chart, type ChartConfiguration } from 'chart.js/auto';

	let { config }: { config: ChartConfiguration } = $props();

	let canvas: HTMLCanvasElement;

	// Effects run client-side only, so Chart never touches the DOM during SSR.
	// Reading `config` makes the chart rebuild whenever the data changes.
	$effect(() => {
		const chart = new Chart(canvas, config);
		return () => chart.destroy();
	});
</script>

<canvas bind:this={canvas}></canvas>
