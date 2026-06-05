import type { LayoutServerLoad } from './$types';

// Expose the logged-in user + role to all pages.
export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user ? { email: locals.user.email } : null,
		role: locals.role
	};
};
