import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** OAuth redirect target: exchange the code for a session, then continue. */
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) throw redirect(303, next);
	}
	// Failed or missing code: back to login.
	throw redirect(303, '/login');
};
