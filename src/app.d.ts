// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Authenticated API key for /api/v1 requests (null otherwise). */
			apiKey: { id: string; name: string } | null;
			/** Incident touched by the handler, for the api_usage log. */
			incidentId: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
