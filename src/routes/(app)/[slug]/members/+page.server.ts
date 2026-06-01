import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

export const load: PageServerLoad = async ({ locals, fetch, cookies }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;

	if (!tenantId) throw redirect(303, '/auth/login');

	// Fetch members joined with customers for nama & nomor_hp
	const { data: members, error: membersError } = await supabase
		.from('members')
		.select(`
			id,
			tenant_id,
			customer_id,
			nomor_member,
			tier,
			poin,
			kode_referral,
			created_at,
			customers!inner (
				id,
				nama,
				nomor_hp
			)
		`)
		.eq('tenant_id', tenantId)
		.order('created_at', { ascending: false });

	if (membersError) {
		console.error('Members load error:', membersError);
		return { members: [], availableCustomers: [], pointsLog: [] };
	}

	// Fetch all points_log for these members (for expand detail)
	const memberIds = (members ?? []).map((m) => m.id);
	let pointsLog: Array<Record<string, unknown>> = [];

	if (memberIds.length > 0) {
		const { data: pts } = await supabase
			.from('points_log')
			.select('id, member_id, poin, tipe, keterangan, created_at')
			.in('member_id', memberIds)
			.order('created_at', { ascending: false })
			.limit(200);

		pointsLog = pts ?? [];
	}

	// Fetch customers without members (for dropdown in add modal)
	const { data: nonMemberCustomers } = await supabase
		.from('customers')
		.select('id, nama, nomor_hp')
		.eq('tenant_id', tenantId)
		.order('nama');

	// Get set of customer IDs that already have members
	const memberCustomerIds = new Set(
		(members ?? []).map((m) => m.customer_id)
	);

	const availableCustomers = (nonMemberCustomers ?? []).filter(
		(c) => !memberCustomerIds.has(c.id)
	);

	return {
		members: members ?? [],
		availableCustomers,
		pointsLog
	};
};

export const actions: Actions = {
	add_member: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const customer_id = (formData.get('customer_id') as string)?.trim();
		const tier = (formData.get('tier') as string)?.trim() || 'regular';

		if (!customer_id) return fail(400, { error: 'Pilih pelanggan terlebih dahulu' });

		// Validate customer belongs to this tenant
		const { data: customer } = await supabase
			.from('customers')
			.select('id, nama')
			.eq('id', customer_id)
			.eq('tenant_id', tenantId)
			.maybeSingle();

		if (!customer) return fail(400, { error: 'Pelanggan tidak ditemukan' });

		// Check if customer already has a member
		const { data: existingMember } = await supabase
			.from('members')
			.select('id')
			.eq('customer_id', customer_id)
			.eq('tenant_id', tenantId)
			.maybeSingle();

		if (existingMember) {
			return fail(400, { error: 'Pelanggan ini sudah terdaftar sebagai member' });
		}

		// Count existing members for this tenant to generate nomor_member
		const { count } = await supabase
			.from('members')
			.select('id', { count: 'exact', head: true })
			.eq('tenant_id', tenantId);

		const nextNumber = (count ?? 0) + 1;
		const nomor_member = `MBR-${String(nextNumber).padStart(3, '0')}`;

		const validTiers = ['regular', 'silver', 'gold', 'platinum'];
		const memberTier = validTiers.includes(tier) ? tier : 'regular';

		const { error } = await supabase.from('members').insert({
			tenant_id: tenantId,
			customer_id,
			nomor_member,
			tier: memberTier,
			poin: 0
		});

		if (error) return fail(500, { error: error.message });

		return { success: true, message: `Member ${nomor_member} berhasil ditambahkan` };
	},

	update_tier: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const member_id = (formData.get('member_id') as string)?.trim();
		const tier = (formData.get('tier') as string)?.trim();

		if (!member_id) return fail(400, { error: 'Member tidak ditemukan' });
		if (!tier) return fail(400, { error: 'Pilih tier terlebih dahulu' });

		const validTiers = ['regular', 'silver', 'gold', 'platinum'];
		if (!validTiers.includes(tier)) {
			return fail(400, { error: 'Tier tidak valid' });
		}

		const { data: member } = await supabase
			.from('members')
			.select('id, nomor_member, tier')
			.eq('id', member_id)
			.eq('tenant_id', tenantId)
			.maybeSingle();

		if (!member) return fail(400, { error: 'Member tidak ditemukan' });

		if (member.tier === tier) {
			return fail(400, { error: `Member sudah berada di tier ${tier}` });
		}

		const { error } = await supabase
			.from('members')
			.update({ tier })
			.eq('id', member_id)
			.eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });

		return {
			success: true,
			message: `Tier ${member.nomor_member} berhasil diubah ke ${tier}`
		};
	},

	add_points: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const member_id = (formData.get('member_id') as string)?.trim();
		const poinStr = (formData.get('poin') as string)?.trim();
		const tipe = (formData.get('tipe') as string)?.trim(); // 'masuk' or 'keluar'
		const keterangan = (formData.get('keterangan') as string)?.trim() || null;

		if (!member_id) return fail(400, { error: 'Member tidak ditemukan' });
		if (!poinStr) return fail(400, { error: 'Jumlah poin wajib diisi' });
		if (!tipe || !['masuk', 'keluar'].includes(tipe)) {
			return fail(400, { error: 'Tipe poin tidak valid' });
		}

		const poin = parseInt(poinStr, 10);
		if (isNaN(poin) || poin <= 0) {
			return fail(400, { error: 'Jumlah poin harus lebih dari 0' });
		}

		// Fetch current member
		const { data: member } = await supabase
			.from('members')
			.select('id, nomor_member, poin')
			.eq('id', member_id)
			.eq('tenant_id', tenantId)
			.maybeSingle();

		if (!member) return fail(400, { error: 'Member tidak ditemukan' });

		// For 'keluar' (redeem), check sufficient points
		if (tipe === 'keluar' && member.poin < poin) {
			return fail(400, {
				error: `Poin tidak mencukupi. Poin saat ini: ${member.poin}`
			});
		}

		// Calculate new poin
		const newPoin = tipe === 'masuk' ? member.poin + poin : member.poin - poin;

		// Insert into points_log
		const { error: logError } = await supabase.from('points_log').insert({
			member_id,
			poin: tipe === 'masuk' ? poin : -poin,
			tipe,
			keterangan
		});

		if (logError) return fail(500, { error: logError.message });

		// Update member poin
		const { error: updateError } = await supabase
			.from('members')
			.update({ poin: newPoin })
			.eq('id', member_id)
			.eq('tenant_id', tenantId);

		if (updateError) return fail(500, { error: updateError.message });

		const label = tipe === 'masuk' ? 'ditambahkan' : 'dikurangi';
		return {
			success: true,
			message: `${poin} poin ${label} untuk ${member.nomor_member}. Total: ${newPoin} poin`
		};
	}
};
