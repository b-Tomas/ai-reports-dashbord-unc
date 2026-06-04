import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Sign out (POST from a form) and return to the login screen. */
export const POST: RequestHandler = async ({ locals: { supabase } }) => {
	await supabase.auth.signOut();
	throw redirect(303, '/login');
};
