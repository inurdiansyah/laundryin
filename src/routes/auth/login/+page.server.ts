import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

export const load: PageServerLoad = async ({ url, locals }) => {
	const session = await locals.getSession();
	if (session) {
		const tenant = await locals.getTenant();
		if (tenant) {
			throw redirect(303, `/${tenant.slug}`);
		}
		// Session exists but no tenant — stale cookie. Sign out to clear it.
		await locals.supabase.auth.signOut();
	}

	return {
		message: url.searchParams.get('message') ?? null
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		const supabase = getServerSupabase(fetch, cookies);

		const email = (formData.get('email') as string)?.trim().toLowerCase();
		const password = formData.get('password') as string;

		const errors: Record<string, string> = {};
		if (!email) errors.email = 'Email wajib diisi';
		if (!password) errors.password = 'Password wajib diisi';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { email } });
		}

		// Cek apakah email terdaftar
		const { data: emailRegistered } = await supabase.rpc('email_exists', { p_email: email });
		if (!emailRegistered) {
			return fail(401, {
				errors: { email: 'Email belum terdaftar' },
				values: { email }
			});
		}

		// Coba login
		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (signInError) {
			// Email ada tapi password salah
			return fail(401, {
				errors: { password: 'Password salah' },
				values: { email }
			});
		}

		if (!data.session) {
			return fail(401, {
				errors: { general: 'Gagal membuat sesi' },
				values: { email }
			});
		}

		// Ambil tenant info
		const { data: tenant } = await supabase.rpc('get_user_default_tenant', {
			p_user_id: data.session.user.id
		});

		if (tenant) {
			const t = tenant as { slug: string };
			throw redirect(303, `/${t.slug}`);
		}

		throw redirect(303, '/auth/register');
	}
};
