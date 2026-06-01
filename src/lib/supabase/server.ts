import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import type { Database } from '$lib/types/supabase';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export function getServerSupabase(fetch: typeof globalThis.fetch, cookies: Cookies) {
	return createServerClient<Database>(
		import.meta.env.VITE_SUPABASE_URL!,
		import.meta.env.VITE_SUPABASE_ANON_KEY!,
		{
			global: { fetch },
			cookies: {
				getAll() {
					return cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) => {
						cookies.set(name, value, { ...options, path: '/' });
					});
				}
			}
		}
	);
}

/** Supabase client with service role key — for admin operations (create user, etc.) */
export function getServiceSupabase() {
	return createClient<Database>(
		import.meta.env.VITE_SUPABASE_URL!,
		SUPABASE_SERVICE_ROLE_KEY,
		{
			auth: { autoRefreshToken: false, persistSession: false }
		}
	);
}
