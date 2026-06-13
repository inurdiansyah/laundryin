import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase, getServiceSupabase } from '$lib/supabase/server';
import { getGoWAConfig } from '$lib/whatsapp/gowa-config';
import { GoWAClient } from '$lib/whatsapp/gowa-client';

const USER_LIMITS: Record<string, number> = { free: 2, starter: 5, pro: 999 };

// ── Shared GoWA client (env-level) ──
let _gowaClient: GoWAClient | null = null;
function getGoWAClient(): GoWAClient | null {
	const config = getGoWAConfig();
	if (!config.enabled) return null;
	if (!_gowaClient) {
		_gowaClient = new GoWAClient({
			base_url: config.base_url,
			username: config.username,
			password: config.password
		});
	}
	return _gowaClient;
}

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
		{ count: userCount }
	] = await Promise.all([
		supabase.from('tenants').select('*').eq('id', tenantId).single(),
		supabase.from('layanan').select('*').eq('tenant_id', tenantId).order('kategori').order('nama'),
		supabase.from('tenant_users').select('*').eq('tenant_id', tenantId).order('role').order('nama'),
		supabase.from('tenant_users').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
	]);

	// ── GoWA status (env-level, optionally fetched) ──
	let gowaStatus: { is_connected: boolean; is_logged_in: boolean; jid: string } | null = null;
	let gowaQr: string | null = null;
	if (getGoWAConfig().enabled) {
		try {
			const client = getGoWAClient();
			if (client) {
				const status = await client.getStatus();
				if (status.success && status.status) {
					gowaStatus = status.status;
				}
			}
		} catch { /* ignore — GoWA might be down */ }
	}

	const paket = (tenant?.paket || 'free') as string;
	const limit = USER_LIMITS[paket] ?? 2;

	return {
		tenant: tenant ?? null,
		layanan: layanan ?? [],
		users: users ?? [],
		currentRole: locals.tenant?.role ?? '',
		userCount: userCount ?? 0,
		userLimit: limit,
		gowaStatus,
		gowaQr
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

		// ── GoWA status checker (POST from settings page) ──
		gowa_status: async () => {
			if (!getGoWAConfig().enabled) return fail(503, { error: 'GoWA disabled' });
			const client = getGoWAClient();
			if (!client) return fail(503, { error: 'GoWA not configured' });
			try {
				const result = await client.getStatus();
				if (result.success && result.status) {
					return { connected: result.status.is_connected, jid: result.status.jid };
				}
				return { connected: false, error: result.error };
			} catch (err: any) {
				return { connected: false, error: err?.message || 'Network error' };
			}
		},

		// ── GoWA QR code (POST from settings page) ──
		gowa_qr: async () => {
			if (!getGoWAConfig().enabled) return fail(503, { error: 'GoWA disabled' });
			const client = getGoWAClient();
			if (!client) return fail(503, { error: 'GoWA not configured' });
			try {
				const result = await client.getQR();
				if (result.success && result.qr) {
					return { qr: result.qr };
				}
				return { error: result.error || 'QR not available' };
			} catch (err: any) {
				return { error: err?.message || 'Network error' };
			}
		}
	};
