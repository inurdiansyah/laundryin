import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

export const GET: RequestHandler = async ({ cookies, fetch }) => {
	const supabase = getServerSupabase(fetch, cookies);
	await supabase.auth.signOut();
	throw redirect(303, '/auth/login?message=logout');
};

export const POST: RequestHandler = async ({ cookies, fetch }) => {
	const supabase = getServerSupabase(fetch, cookies);
	await supabase.auth.signOut();
	throw redirect(303, '/auth/login?message=logout');
};
