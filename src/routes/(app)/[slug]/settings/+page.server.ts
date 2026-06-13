import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase, getServiceSupabase } from '$lib/supabase/server';

const USER_LIMITS: Record<string, number> = { free: 2, starter: 5, pro: 999 };

export const load: PageServerLoad = async ({ locals, fetch, cookies }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;
	const currentRole = locals.tenant?.role;
	const tenantSlug = (locals.tenant as any)?.slug;

	// Guard: only admin can access settings
	if (currentRole !== 'admin') {
		throw redirect(303, `/${tenantSlug}`);
	}
	if (!tenantId) throw redirect(303, '/auth/login');

	const [
		{ data: tenant },
		{ data: layanan },
		{ data: users },
		{ count: userCount },
		{ data: gowaConfig }
	] = await Promise.all([
		supabase.from('tenants').select('*').eq('id', tenantId).single(),
		supabase.from('layanan').select('*').eq('tenant_id', tenantId).order('kategori').order('nama'),
		supabase.from('tenant_users').select('*').eq('tenant_id', tenantId).order('role').order('nama'),
		supabase.from('tenant_users').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
		supabase.from('tenant_configs').select('config_value').eq('tenant_id', tenantId).eq('config_key', 'gowa').maybeSingle()
	]);

	const paket = (tenant?.paket || 'free') as string;
	const limit = USER_LIMITS[paket] ?? 2;

	return {
		tenant: tenant ?? null,
		layanan: layanan ?? [],
		users: users ?? [],
		currentRole: locals.tenant?.role ?? '',
		userCount: userCount ?? 0,
		userLimit: limit,
		gowaConfig: (gowaConfig?.config_value ?? null) as { base_url?: string; username?: string; password?: string } | null
	};
};

export const actions: Actions = {
	update_profile: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const nama_toko = (formData.get('nama_toko') as string)?.trim();
		const alamat = (formData.get('alamat') as string)?.trim() || null;
		const nomor_hp = (formData.get('nomor_hp') as string)?.trim() || null;

		if (!nama_toko) return fail(400, { error: 'Nama toko wajib diisi' });

		const { error } = await supabase.from('tenants')
			.update({ nama: nama_toko, alamat, nomor_hp })
			.eq('id', tenantId);

		if (error) return fail(500, { error: error.message });
		return { success: true, message: 'Profil toko diperbarui' };
	},

	// ── Add a new user (admin only) ──
	add_user: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const serviceSupabase = getServiceSupabase();
		const tenantId = locals.tenant?.tenant_id;
		const currentRole = locals.tenant?.role;
		const tenantSlug = (locals.tenant as any)?.slug ?? '';

		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });
		if (currentRole !== 'admin') return fail(403, { error: 'Hanya admin yang bisa menambah pengguna' });

		const formData = await request.formData();
		const email = (formData.get('email') as string)?.trim().toLowerCase();
		const nama = (formData.get('nama') as string)?.trim();
		const password = (formData.get('password') as string);
		const role = (formData.get('role') as string);

		if (!email || !nama || !password || !role) {
			return fail(400, { error: 'Semua field wajib diisi' });
		}
		if (password.length < 6) {
			return fail(400, { error: 'Password minimal 6 karakter' });
		}
		if (!['kasir', 'driver'].includes(role)) {
			return fail(400, { error: 'Role hanya bisa kasir atau driver' });
		}

		// Check limit — use service client to bypass RLS
		const { count } = await serviceSupabase.from('tenant_users')
			.select('*', { count: 'exact', head: true })
			.eq('tenant_id', tenantId);

		const paket = (locals.tenant as any)?.paket || 'free';
		const limit = USER_LIMITS[paket] ?? 2;
		if ((count ?? 0) >= limit) {
			return fail(400, { error: `Paket ${paket} maksimal ${limit} pengguna. Upgrade untuk menambah` });
		}

		// Check if email already in tenant_users
		const { data: existing } = await serviceSupabase.from('tenant_users')
			.select('id').eq('tenant_id', tenantId).eq('email', email).maybeSingle();
		if (existing) {
			return fail(400, { error: 'Email sudah terdaftar di tenant ini' });
		}

		// Create auth user via service role
		const { data: authUser, error: authError } = await serviceSupabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: { nama }
		});

		if (authError) {
			if (authError.message?.includes('already') || authError.status === 422) {
				return fail(400, { error: 'Email sudah terdaftar di sistem. Coba email lain.' });
			}
			return fail(400, { error: authError.message || 'Gagal membuat akun' });
		}

		if (!authUser?.user?.id) {
			return fail(500, { error: 'Gagal membuat akun pengguna' });
		}

		// Insert into tenant_users — use service client to bypass RLS
		const { error: insertError } = await serviceSupabase.from('tenant_users').insert({
			tenant_id: tenantId,
			user_id: authUser.user.id,
			nama,
			email,
			role,
			aktif: true
		});

		if (insertError) {
			// Rollback: delete the auth user we just created
			await serviceSupabase.auth.admin.deleteUser(authUser.user.id);
			return fail(500, { error: insertError.message });
		}

		return { success: true, message: `${nama} berhasil ditambahkan sebagai ${role}` };
	},

	// ── Remove user from tenant ──
	remove_user: async ({ request, fetch, cookies, locals }) => {
		const serviceSupabase = getServiceSupabase();
		const tenantId = locals.tenant?.tenant_id;
		const currentRole = locals.tenant?.role;

		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });
		if (currentRole !== 'admin') return fail(403, { error: 'Hanya admin yang bisa menghapus pengguna' });

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim();
		const targetRole = (formData.get('target_role') as string)?.trim();

		if (!id) return fail(400, { error: 'ID pengguna tidak ditemukan' });
		if (targetRole === 'admin') return fail(400, { error: 'Tidak bisa menghapus admin' });

		const { error } = await serviceSupabase.from('tenant_users')
			.delete().eq('id', id).eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });
		return { success: true, message: 'Pengguna berhasil dihapus' };
	},

	add_layanan: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const nama = (formData.get('nama') as string)?.trim();
		const satuan = (formData.get('satuan') as string)?.trim() || 'kg';
		const harga = parseInt((formData.get('harga') as string) || '0');
		const kategori = (formData.get('kategori') as string)?.trim() || 'Lainnya';

		if (!nama) return fail(400, { error: 'Nama layanan wajib diisi' });
		if (!harga || harga <= 0) return fail(400, { error: 'Harga harus lebih dari 0' });

		const workflowJson = (formData.get('workflow') as string)?.trim() || '';
		let workflow: string[] = ['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'];
		if (workflowJson) {
			try { workflow = JSON.parse(workflowJson); } catch { /* keep default */ }
		}

		const { error } = await supabase.from('layanan').insert({
			tenant_id: tenantId, nama, satuan, harga, kategori, workflow
		});

		if (error) return fail(500, { error: error.message });
		return { success: true, message: 'Layanan berhasil ditambahkan' };
	},

	update_layanan: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim();
		const nama = (formData.get('nama') as string)?.trim();
		const satuan = (formData.get('satuan') as string)?.trim() || 'kg';
		const harga = parseInt((formData.get('harga') as string) || '0');
		const kategori = (formData.get('kategori') as string)?.trim() || 'Lainnya';
		const aktif = formData.get('aktif') === 'true';

		const workflowJson = (formData.get('workflow') as string)?.trim() || '';
		let workflow: string[] | undefined;
		if (workflowJson) {
			try { workflow = JSON.parse(workflowJson); } catch { /* ignore invalid */ }
		}

		if (!id) return fail(400, { error: 'ID layanan tidak ditemukan' });
		if (!nama) return fail(400, { error: 'Nama layanan wajib diisi' });

		const updateData: any = { nama, satuan, harga, kategori, aktif };
		if (workflow) updateData.workflow = workflow;

		const { error } = await supabase.from('layanan')
			.update(updateData)
			.eq('id', id).eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });
		return { success: true, message: 'Layanan diperbarui' };
	},

		delete_layanan: async ({ request, fetch, cookies, locals }) => {
			const supabase = getServerSupabase(fetch, cookies);
			const tenantId = locals.tenant?.tenant_id;
			if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

			const formData = await request.formData();
			const id = (formData.get('id') as string)?.trim();
			if (!id) return fail(400, { error: 'ID layanan tidak ditemukan' });

			const { error } = await supabase.from('layanan')
				.delete().eq('id', id).eq('tenant_id', tenantId);

			if (error) return fail(500, { error: error.message });
			return { success: true, message: 'Layanan dihapus' };
		},

		// ── Save GoWA configuration ──
		save_gowa: async ({ request, fetch, cookies, locals }) => {
			const supabase = getServerSupabase(fetch, cookies);
			const tenantId = locals.tenant?.tenant_id;
			if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

			const formData = await request.formData();
			const base_url = (formData.get('base_url') as string)?.trim().replace(/\/+$/, '');
			const username = (formData.get('username') as string)?.trim();
			const password = (formData.get('password') as string)?.trim();

			if (!base_url) return fail(400, { error: 'GoWA Base URL wajib diisi' });
			if (!username) return fail(400, { error: 'Username wajib diisi' });
			if (!password) return fail(400, { error: 'Password wajib diisi' });

			const configValue = { base_url, username, password };

			const { error } = await supabase
				.from('tenant_configs')
				.upsert({
					tenant_id: tenantId,
					config_key: 'gowa',
					config_value: configValue,
					updated_at: new Date().toISOString()
				}, { onConflict: 'tenant_id,config_key' });

			if (error) return fail(500, { error: error.message });
			return { success: true, message: 'Konfigurasi WhatsApp disimpan' };
		}
	};
