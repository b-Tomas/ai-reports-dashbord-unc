import { defineConfig } from 'vitest/config';

// Domain/unit tests run in a plain Node environment — no SvelteKit plugin needed.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
