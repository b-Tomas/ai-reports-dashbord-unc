import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals: { supabase }, url }) => {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${url.origin}/auth/callback` }
		});
		// signInWithOAuth (server) returns the provider URL to redirect the user to.
		if (error || !data?.url) {
			return fail(500, { message: 'No se pudo iniciar sesión con Google. Intente nuevamente.' });
		}
		throw redirect(303, data.url);
	}
};
