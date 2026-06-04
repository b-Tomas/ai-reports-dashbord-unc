/**
 * Server hooks.
 *
 * Block 3: authenticate + log every /api/v1/* request. Block 5 will compose
 * human (Supabase session) auth for the dashboard routes via `sequence`.
 */
import type { Handle } from '@sveltejs/kit';
import { createApiV1Handle } from '$lib/server/apiAuth';
import { createServiceClient } from '$lib/server/supabase';

const apiV1 = createApiV1Handle({ createClient: createServiceClient });

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/v1')) {
		return apiV1(event, resolve);
	}
	return resolve(event);
};
