import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';
import { generateSlug } from '$lib/utils/format';

export const load: PageServerLoad = async ({ url }) => {
	// NOTE: Don't clear session here — hooks may redirect authenticated users here
	// if getTenant() fails. Clearing session would create a loop.
	return {
		redirectTo: url.searchParams.get('redirectTo') ?? '/'
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		const supabase = getServerSupabase(fetch, cookies);

		const nama_toko = (formData.get('nama_toko') as string)?.trim();
		const slug_input = (formData.get('slug') as string)?.trim().toLowerCase();
		const nama_pemilik = (formData.get('nama_pemilik') as string)?.trim();
		const email = (formData.get('email') as string)?.trim().toLowerCase();
		const nomor_hp = (formData.get('nomor_hp') as string)?.trim();
		const password = formData.get('password') as string;

		// Validasi
		const errors: Record<string, string> = {};
		if (!nama_toko || nama_toko.length < 3) errors.nama_toko = 'Nama toko minimal 3 karakter';
		if (!nama_pemilik || nama_pemilik.length < 2) errors.nama_pemilik = 'Nama pemilik wajib diisi';
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email tidak valid';
		if (!nomor_hp || nomor_hp.length < 10) errors.nomor_hp = 'Nomor HP minimal 10 digit';
		if (!password || password.length < 8) errors.password = 'Password minimal 8 karakter';

		let slug = slug_input || generateSlug(nama_toko);
		if (!slug || slug.length < 2) slug = generateSlug(nama_toko);
		if (!/^[a-z0-9-]+$/.test(slug)) errors.slug = 'Slug hanya boleh huruf, angka, dan strip';

		// Cek slug tersedia
		const { data: slugTaken } = await supabase.rpc('slug_exists', { p_slug: slug });
		if (slugTaken) errors.slug = 'Slug sudah digunakan, coba yang lain';

		// Cek email tersedia
		const { data: emailTaken } = await supabase.rpc('email_exists', { p_email: email });
		if (emailTaken) errors.email = 'Email sudah terdaftar';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { nama_toko, slug, nama_pemilik, email, nomor_hp } });
		}

		// 1. Daftar user di Supabase Auth
		const { data: authData, error: authError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: { nama: nama_pemilik, nomor_hp }
			}
		});

		if (authError || !authData.user) {
			return fail(400, {
				errors: { general: authError?.message ?? 'Gagal mendaftarkan akun' },
				values: { nama_toko, slug, nama_pemilik, email, nomor_hp }
			});
		}

		// 2. Buat tenant + link user via SECURITY DEFINER function
		const { error: rpcError } = await supabase.rpc('create_tenant_and_user', {
			p_nama_toko: nama_toko,
			p_slug: slug,
			p_nama_pemilik: nama_pemilik,
			p_email: email,
			p_nomor_hp: nomor_hp,
			p_user_id: authData.user.id
		});

		if (rpcError) {
			return fail(400, {
				errors: { general: rpcError.message ?? 'Gagal membuat workspace' },
				values: { nama_toko, slug, nama_pemilik, email, nomor_hp }
			});
		}

		// 3. Sign out user agar tidak auto-login — user harus login manual
		await supabase.auth.signOut();

		// Redirect ke halaman login dengan toast sukses
		throw redirect(303, '/auth/login?message=pendaftaran_berhasil');
	}
};
