import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const supabase = getServerSupabase(fetch, cookies);
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);

		if (!error && data.session) {
			// Coba cari tenant user
			const { data: tenant } = await supabase.rpc('get_user_default_tenant', {
				p_user_id: data.session.user.id
			});

			if (tenant) {
				const t = tenant as { slug: string };
				throw redirect(303, `/${t.slug}`);
			}
		}
	}

	// Fallback: redirect ke register atau login
	throw redirect(303, next === '/' ? '/auth/login' : next);
};
