import type { PageServerLoad } from './$types';

// The guard only routes a logged-in, non-allowlisted user here.
export const load: PageServerLoad = async ({ locals }) => {
	return { email: locals.user?.email ?? null };
};
