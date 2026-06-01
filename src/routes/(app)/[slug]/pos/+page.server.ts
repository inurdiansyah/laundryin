import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';
import { generateNomorOrder } from '$lib/utils/format';

export const load: PageServerLoad = async ({ locals, fetch, cookies }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;

	if (!tenantId) throw redirect(303, '/auth/login');

	const [customersRes, layananRes] = await Promise.all([
		supabase.from('customers').select('id, nama, nomor_hp').eq('tenant_id', tenantId).order('nama'),
		supabase.from('layanan').select('id, nama, satuan, harga, kategori, workflow').eq('tenant_id', tenantId).eq('aktif', true).order('kategori').order('nama')
	]);

	return {
		customers: customersRes.data ?? [],
		layanan: layananRes.data ?? []
	};
};

export const actions: Actions = {
	default: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const customer_id = (formData.get('customer_id') as string)?.trim();
		const nomor_hp = (formData.get('nomor_hp') as string)?.trim();
		const nama_customer = (formData.get('nama_customer') as string)?.trim();
		const jalur = (formData.get('jalur') as string) || 'drop_ambil';
		const catatan = (formData.get('catatan') as string)?.trim() || null;
		const metode_bayar = (formData.get('metode_bayar') as string) || 'tunai';
		const waktu_bayar = (formData.get('waktu_bayar') as string) || 'awal';
		const nominal_bayar = parseInt((formData.get('nominal_bayar') as string) || '0', 10) || 0;
		const diskon = parseInt((formData.get('diskon') as string) || '0', 10) || 0;

		// Parse order items: layanan_X = qty
		const items: { layanan_id: string; qty: number }[] = [];
		for (const [key, value] of formData.entries()) {
			const match = key.match(/^layanan_(.+)$/);
			if (match) {
				const qty = parseFloat(value.toString()) || 0;
				if (qty > 0) items.push({ layanan_id: match[1], qty });
			}
		}

		if (items.length === 0) {
			return fail(400, { error: 'Minimal satu layanan harus dipilih' });
		}

		// 1. Create or find customer
		let finalCustomerId = customer_id;
		if (!finalCustomerId && nama_customer && nomor_hp) {
			const { data: existingCustomer } = await supabase
				.from('customers')
				.select('id')
				.eq('tenant_id', tenantId)
				.eq('nomor_hp', nomor_hp)
				.maybeSingle();

			if (existingCustomer) {
				finalCustomerId = existingCustomer.id;
			} else {
				const { data: newCustomer, error: custError } = await supabase
					.from('customers')
					.insert({ tenant_id: tenantId, nama: nama_customer, nomor_hp })
					.select('id')
					.single();

				if (custError || !newCustomer) {
					return fail(400, { error: 'Gagal membuat data pelanggan' });
				}
				finalCustomerId = newCustomer.id;
			}
		}

		if (!finalCustomerId) {
			return fail(400, { error: 'Pilih pelanggan atau isi nama + nomor HP' });
		}

		// 2. Hitung total dari layanan
		const layananIds = items.map(i => i.layanan_id);
		const { data: layananList, error: layError } = await supabase
			.from('layanan')
			.select('id, nama, satuan, harga, workflow')
			.in('id', layananIds);

		if (layError || !layananList) {
			return fail(400, { error: 'Gagal mengambil data layanan' });
		}

		const layananMap = new Map(layananList.map(l => [l.id, l]));
		let subtotal = 0;
		const orderItems = items.map(item => {
			const layanan = layananMap.get(item.layanan_id);
			if (!layanan) throw new Error('Layanan not found');
			const itemSubtotal = layanan.harga * item.qty;
			subtotal += itemSubtotal;
			return {
				layanan_id: item.layanan_id,
				nama_layanan: layanan.nama,
				qty: item.qty,
				satuan: layanan.satuan,
				harga_satuan: layanan.harga,
				subtotal: itemSubtotal
			};
		});

		const total = Math.max(0, Math.round(subtotal - diskon));

		// Generate workflow from layanan items + jalur
		function generateWorkflow(layananList: any[], jalur: string): string[] {
			// 1. Union all workflows from selected layanan
			const allStatuses = new Set<string>();
			for (const l of layananList) {
				if (l.workflow && l.workflow.length > 0) {
					for (const s of l.workflow) allStatuses.add(s);
				}
			}
			// Default fallback
			if (allStatuses.size === 0) {
				allStatuses.add('diterima');
				allStatuses.add('proses_cuci');
				allStatuses.add('proses_kering');
				allStatuses.add('setrika');
				allStatuses.add('siap_diambil');
				allStatuses.add('selesai');
			}

			// 2. Define canonical order
			const CANONICAL_ORDER = [
				'diterima',
				'proses_cuci', 'proses_kering', 'setrika',
				'siap_diambil', 'siap_diantar',
				'dalam_pengiriman', 'terkirim',
				'selesai'
			];

			// 3. Sort by canonical order
			const merged = CANONICAL_ORDER.filter(s => allStatuses.has(s));

			// 4. Jalur modifiers
			// Pickup (jemput) variants: jemput_ambil, jemput_antar
			if (jalur === 'jemput_ambil' || jalur === 'jemput_antar') {
				const diterimaIdx = merged.indexOf('diterima');
				if (diterimaIdx !== -1) {
					merged.splice(diterimaIdx, 0, 'menunggu_jemput', 'dijemput_driver');
				} else {
					merged.unshift('menunggu_jemput', 'dijemput_driver');
				}
			}
			// Dropoff (antar) variants: drop_antar, jemput_antar
			if (jalur === 'drop_antar' || jalur === 'jemput_antar') {
				const siapIdx = merged.indexOf('siap_diambil');
				if (siapIdx !== -1) {
					merged.splice(siapIdx + 1, 0, 'siap_diantar', 'dalam_pengiriman', 'terkirim');
				}
			}

			return merged;
		}

		const selectedLayanan = items.map(i => layananMap.get(i.layanan_id)).filter(Boolean);
		const workflow = generateWorkflow(selectedLayanan, jalur);

		// 3. Generate nomor order
		const { data: lastOrder } = await supabase
			.from('orders')
			.select('nomor_order')
			.eq('tenant_id', tenantId)
			.order('created_at', { ascending: false })
			.limit(1);

		const prefix = (locals.tenant as any)?.slug?.slice(0, 4).toUpperCase() || 'LD';
		const nomor_order = generateNomorOrder(prefix, 1);

		// 4. Insert order
		const orderStatus = workflow[0] || 'diterima';
		const { data: order, error: orderError } = await supabase
			.from('orders')
			.insert({
				tenant_id: tenantId,
				nomor_order,
				customer_id: finalCustomerId,
				status: orderStatus,
				jalur,
				waktu_bayar,
				berat_total: 0,
				subtotal: Math.round(subtotal),
				diskon,
				total,
				catatan,
				workflow
			})
			.select('id, nomor_order')
			.single();

		if (orderError || !order) {
			return fail(400, { error: orderError?.message || 'Gagal membuat pesanan' });
		}

		// 5. Insert order items
		const { error: itemsError } = await supabase
			.from('order_items')
			.insert(orderItems.map(oi => ({ ...oi, order_id: order.id })));

		if (itemsError) {
			return fail(400, { error: 'Gagal menyimpan item pesanan' });
		}

		// 6. Insert status log
		await supabase.from('order_status_log').insert({
			order_id: order.id,
			status: orderStatus,
			user_nama: (locals.tenant as any)?.nama_user || 'Admin'
		});

		// 7. Insert payment jika waktu_bayar = 'awal'
		if (waktu_bayar === 'awal' && nominal_bayar > 0) {
			await supabase.from('payments').insert({
				tenant_id: tenantId,
				order_id: order.id,
				metode: metode_bayar,
				nominal: Math.min(nominal_bayar, total),
				status: nominal_bayar >= total ? 'lunas' : 'sebagian'
			});
		}

		// 8. Auto-create delivery schedule for jemput variants
		if (jalur === 'jemput_ambil' || jalur === 'jemput_antar') {
			let alamat_jemput = (formData.get('alamat') as string)?.trim() || null;
			// Fallback: use customer address if available
			if (!alamat_jemput) {
				const { data: cust } = await supabase.from('customers')
					.select('alamat').eq('id', finalCustomerId).eq('tenant_id', tenantId).maybeSingle();
				alamat_jemput = (cust as any)?.alamat || 'Alamat belum diisi';
			}
			const today = new Date().toISOString().slice(0, 10);
			const { error: jemputErr } = await supabase.from('delivery_schedules').insert({
				tenant_id: tenantId,
				order_id: order.id,
				alamat: alamat_jemput,
				tanggal: today,
				slot_waktu: 'pagi',
				tipe: 'jemput',
				status: 'terjadwal'
			});
			if (jemputErr) console.error('Gagal buat jadwal jemput:', jemputErr.message);
		}
		// Auto-create delivery schedule for dropoff (antar) variants
		if (jalur === 'drop_antar' || jalur === 'jemput_antar') {
			let alamat_antar = (formData.get('alamat_antar') as string)?.trim() || null;
			if (!alamat_antar) {
				const { data: cust } = await supabase.from('customers')
					.select('alamat').eq('id', finalCustomerId).eq('tenant_id', tenantId).maybeSingle();
				alamat_antar = (cust as any)?.alamat || 'Alamat belum diisi';
			}
			const today = new Date().toISOString().slice(0, 10);
			const { error: antarErr } = await supabase.from('delivery_schedules').insert({
				tenant_id: tenantId,
				order_id: order.id,
				alamat: alamat_antar,
				tanggal: today,
				slot_waktu: 'sore',
				tipe: 'antar',
				status: 'terjadwal'
			});
			if (antarErr) console.error('Gagal buat jadwal antar:', antarErr.message);
		}

		return { success: true, nomor_order: order.nomor_order, order_id: order.id, total };
	}
};
