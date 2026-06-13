import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';
import { formatRupiah } from '$lib/utils/format';
import { sendNotification } from '$lib/whatsapp/dispatcher';

export const load: PageServerLoad = async ({ locals, fetch, cookies, url }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;

	if (!tenantId) throw redirect(303, '/auth/login');

	const tab = url.searchParams.get('tab') || 'semua';
	const status = url.searchParams.get('status') || '';
	const search = url.searchParams.get('search') || '';
	const dari = url.searchParams.get('dari') || '';
	const sampai = url.searchParams.get('sampai') || '';
	const page = parseInt(url.searchParams.get('page') || '1', 10) || 1;
	const openOrder = url.searchParams.get('open') || '';
	const perPage = 20;

	// Build base query — fetch all orders for this tenant (NO tab filtering in DB)
	const baseQuery = supabase.from('orders')
		.select('id, nomor_order, customer_id, status, jalur, workflow, berat_total, subtotal, diskon, total, status_bayar, waktu_bayar, estimasi_selesai, catatan, created_at, customers(nama, nomor_hp), order_items(id, order_id, layanan_id, nama_layanan, qty, satuan, harga_satuan, subtotal), payments(id, metode, nominal, status)')
		.eq('tenant_id', tenantId);

	// Additional filters (simple, no chain issues)
	if (status) baseQuery.eq('status', status);
	if (search) baseQuery.ilike('nomor_order', '%' + search + '%');
	if (dari) baseQuery.gte('created_at', dari);
	if (sampai) baseQuery.lte('created_at', sampai + 'T23:59:59');

	// Fetch all orders, then filter in JS (Supabase SDK chaining .in()+.neq() is broken)
	const { data: allOrders } = await baseQuery
		.order('created_at', { ascending: false });

	const doneStatuses = ['selesai', 'dibatalkan', 'batal'];
	const deliveryJalurs = ['jemput', 'jemput_ambil', 'jemput_antar', 'drop_antar'];

	// Filter by tab
	let filteredOrders = allOrders ?? [];
	if (tab === 'aktif') {
		filteredOrders = filteredOrders.filter(o => !doneStatuses.includes(o.status));
	} else if (tab === 'pengantaran') {
		filteredOrders = filteredOrders.filter(o => deliveryJalurs.includes(o.jalur) && !doneStatuses.includes(o.status));
	} else if (tab === 'selesai') {
		filteredOrders = filteredOrders.filter(o => doneStatuses.includes(o.status));
	}

	const totalCount = filteredOrders.length;

	// Paginate
	const orders = filteredOrders.slice((page - 1) * perPage, page * perPage);

	// Fetch ALL active drivers (not just for current page — needed for driver dropdowns)
	const { data: drivers } = await supabase
		.from('drivers')
		.select('id, nama, nomor_hp, status')
		.eq('tenant_id', tenantId)
		.eq('status', 'aktif')
		.order('nama');

	// Fetch delivery schedules for loaded orders
	const orderIds = (orders ?? []).map(o => o.id);
	let deliveryMap: Record<string, { jemput: any | null; antar: any | null }> = {};

	if (orderIds.length > 0) {
		const { data: deliveries } = await supabase
			.from('delivery_schedules')
			.select('id, order_id, driver_id, alamat, tanggal, slot_waktu, tipe, status, catatan, created_at')
			.in('order_id', orderIds);

		// Fetch assigned drivers for deliveries
		const driverIds = [...new Set((deliveries ?? []).map(d => d.driver_id).filter(Boolean))];
		const driverMap: Record<string, any> = {};
		if (driverIds.length > 0) {
			const { data: assignedDrivers } = await supabase
				.from('drivers')
				.select('id, nama, nomor_hp')
				.in('id', driverIds);
			for (const d of (assignedDrivers ?? [])) driverMap[d.id] = d;
		}

		// Build delivery map per order
		for (const oid of orderIds) deliveryMap[oid] = { jemput: null, antar: null };
		for (const d of (deliveries ?? [])) {
			const enriched = { ...d, driver: d.driver_id ? (driverMap[d.driver_id] ?? null) : null };
			if (d.tipe === 'jemput') deliveryMap[d.order_id].jemput = enriched;
			if (d.tipe === 'antar') deliveryMap[d.order_id].antar = enriched;
		}
	}

	// Collect all workflow statuses for filter dropdown
	const allStatuses = new Set<string>();
	for (const o of (orders ?? [])) {
		if (o.workflow && Array.isArray(o.workflow)) {
			for (const s of o.workflow) allStatuses.add(s);
		}
	}
	const allWorkflowStatuses = Array.from(allStatuses).sort();

	// Count active drivers
	const activeDriverCount = (drivers ?? []).length;

	return {
		orders: orders ?? [],
		totalCount: totalCount ?? 0,
		totalPages: Math.max(1, Math.ceil((totalCount ?? 0) / perPage)),
		page,
		perPage,
		filters: { status, search, dari, sampai },
		tab,
		openOrder,
		allWorkflowStatuses,
		drivers: drivers ?? [],
		activeDriverCount,
		deliveryMap
	};
};

// ── Delivery status sequence ──
const DELIVERY_SEQ = ['terjadwal', 'driver_berangkat', 'dijemput', 'tiba_di_laundry', 'selesai'];
const DELIVERY_LABELS: Record<string, string> = {
	terjadwal: 'Terjadwal',
	driver_berangkat: 'Driver Berangkat',
	dijemput: 'Dijemput',
	tiba_di_laundry: 'Tiba di Laundry',
	selesai: 'Selesai'
};

export const actions: Actions = {
	// ── Get order detail (for dashboard inline expand) ──
	get_detail: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const orderId = formData.get('order_id') as string;
		if (!orderId) return fail(400, { error: 'Order ID diperlukan' });

		const { data, error } = await supabase
			.from('orders')
			.select('id, nomor_order, total, status, order_items(id, nama_layanan, qty, subtotal), delivery_schedules(id, tipe, tanggal, slot, status), order_status_log(id, status, created_at)')
			.eq('id', orderId).eq('tenant_id', tenantId).single();

		if (error) return fail(404, { error: error.message });
		return { type: 'success', data };
	},

	// ── Advance order workflow (existing, enhanced) ──
	update_status: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const orderId = formData.get('order_id') as string;
		if (!orderId) return fail(400, { error: 'Order ID diperlukan' });

		const { data: order, error: fetchError } = await supabase
			.from('orders')
			.select('id, status, workflow, jalur, nomor_order, customer_id')
			.eq('id', orderId).eq('tenant_id', tenantId).single();

		if (fetchError || !order) return fail(404, { error: 'Pesanan tidak ditemukan' });

		const workflow = order.workflow || ['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'];
		const currentIndex = workflow.indexOf(order.status);
		if (currentIndex === -1 || currentIndex >= workflow.length - 1) {
			return fail(400, { error: 'Pesanan sudah selesai atau status tidak valid' });
		}

				const nextStatus = workflow[currentIndex + 1];

				// Update order status
				const { error: updateError } = await supabase
					.from('orders').update({ status: nextStatus })
					.eq('id', orderId).eq('tenant_id', tenantId);
				if (updateError) return fail(400, { error: updateError.message });

				// Auto-create delivery WITHOUT driver (driver assigned via delivery card)
				if (nextStatus === 'dijemput_driver') {
					const { data: existingJemput } = await supabase
						.from('delivery_schedules').select('id')
						.eq('order_id', orderId).eq('tipe', 'jemput').eq('tenant_id', tenantId).maybeSingle();

					if (!existingJemput) {
						let alamatJemput = 'Alamat belum diisi';
						const { data: cust } = await supabase.from('customers')
							.select('alamat').eq('id', order.customer_id).eq('tenant_id', tenantId).maybeSingle();
						if ((cust as any)?.alamat) alamatJemput = (cust as any).alamat;

						await supabase.from('delivery_schedules').insert({
							tenant_id: tenantId, order_id: orderId, driver_id: null,
							alamat: alamatJemput, tipe: 'jemput', status: 'terjadwal',
							tanggal: new Date().toISOString().split('T')[0], slot_waktu: 'pagi'
						});
					}
				}

				if (nextStatus === 'dalam_pengiriman') {
					const { data: existingAntar } = await supabase
						.from('delivery_schedules').select('id')
						.eq('order_id', orderId).eq('tipe', 'antar').eq('tenant_id', tenantId).maybeSingle();

					if (!existingAntar) {
						let alamatAntar = 'Alamat belum diisi';
						const { data: cust } = await supabase.from('customers')
							.select('alamat').eq('id', order.customer_id).eq('tenant_id', tenantId).maybeSingle();
						if ((cust as any)?.alamat) alamatAntar = (cust as any).alamat;

						await supabase.from('delivery_schedules').insert({
							tenant_id: tenantId, order_id: orderId, driver_id: null,
							alamat: alamatAntar, tipe: 'antar', status: 'terjadwal',
							tanggal: new Date().toISOString().split('T')[0], slot_waktu: 'sore'
						});
					}
				}

				// Log
				await supabase.from('order_status_log').insert({
					order_id: orderId, status: nextStatus,
					user_nama: (locals.tenant as any)?.nama_user || 'Admin'
				});

				// Send WhatsApp notification for milestone statuses (fire-and-forget)
				const notifiableStatuses = ['siap_diambil', 'dalam_pengiriman', 'terkirim'];
				if (notifiableStatuses.includes(nextStatus)) {
					try {
						const { data: custData } = await supabase.from('customers')
							.select('nama, nomor_hp').eq('id', order.customer_id).single();
						if (custData?.nomor_hp) {
							sendNotification(supabase, tenantId, custData.nomor_hp, nextStatus, {
								nama: custData.nama || 'Pelanggan',
								nomor_order: order.nomor_order,
								total: formatRupiah(0) // total not in this query, but template uses it optionally
							}).catch(e => console.error('WA notify failed:', e));
						}
					} catch (e) {
						console.error('Failed to fetch customer for WA notification:', e);
					}
				}

				return { success: true, message: 'Status diperbarui ke ' + nextStatus.replace(/_/g, ' ') };
	},

	// ── Assign driver to existing delivery schedule ──
	assign_driver: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const delivery_id = (formData.get('delivery_id') as string)?.trim();
		const driver_id = (formData.get('driver_id') as string)?.trim();

		if (!delivery_id) return fail(400, { error: 'Jadwal tidak ditemukan' });
		if (!driver_id) return fail(400, { error: 'Pilih driver terlebih dahulu' });

		// Validate driver
		const { data: driver } = await supabase
			.from('drivers').select('id, nama').eq('id', driver_id)
			.eq('tenant_id', tenantId).eq('status', 'aktif').single();
		if (!driver) return fail(400, { error: 'Driver tidak aktif atau tidak ditemukan' });

		const { error } = await supabase
			.from('delivery_schedules')
			.update({ driver_id, status: 'driver_berangkat' })
			.eq('id', delivery_id).eq('tenant_id', tenantId);
		if (error) return fail(500, { error: error.message });

		return { success: true, message: driver.nama + ' ditugaskan sebagai driver' };
	},

	// ── Advance delivery status ──
	update_delivery: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const delivery_id = (formData.get('delivery_id') as string)?.trim();
		if (!delivery_id) return fail(400, { error: 'Jadwal tidak ditemukan' });

		const { data: delivery } = await supabase
			.from('delivery_schedules')
			.select('id, status, order_id, tipe, driver_id')
			.eq('id', delivery_id).eq('tenant_id', tenantId).maybeSingle();
		if (!delivery) return fail(404, { error: 'Jadwal tidak ditemukan' });

		const idx = DELIVERY_SEQ.indexOf(delivery.status);
		if (idx < 0 || idx >= DELIVERY_SEQ.length - 1) {
			return fail(400, { error: 'Tugas sudah selesai' });
		}
		const next = DELIVERY_SEQ[idx + 1];

		const { error } = await supabase
			.from('delivery_schedules')
			.update({ status: next })
			.eq('id', delivery_id).eq('tenant_id', tenantId);
		if (error) return fail(500, { error: error.message });

		// Sync order status on delivery completion
		if (next === 'selesai' && delivery.tipe === 'jemput') {
			await supabase.from('orders').update({ status: 'diterima' })
				.eq('id', delivery.order_id).eq('status', 'dijemput_driver');
		} else if (next === 'selesai' && delivery.tipe === 'antar') {
			await supabase.from('orders').update({ status: 'terkirim' })
				.eq('id', delivery.order_id).eq('status', 'dalam_pengiriman');
		}

		return { success: true, message: 'Status pengantaran: ' + (DELIVERY_LABELS[next] ?? next) };
	},

	// ── Add new driver ──
	add_driver: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const nama = (formData.get('nama') as string)?.trim();
		const nomor_hp = (formData.get('nomor_hp') as string)?.trim();

		if (!nama) return fail(400, { error: 'Nama driver wajib diisi' });
		if (!nomor_hp) return fail(400, { error: 'Nomor HP driver wajib diisi' });

		const { error } = await supabase.from('drivers').insert({
			tenant_id: tenantId, nama, nomor_hp, status: 'aktif'
		});
		if (error) return fail(500, { error: error.message });

		return { success: true, message: 'Driver "' + nama + '" berhasil ditambahkan' };
	},

		// ── Update delivery detail (tanggal, slot, alamat, catatan) ──
		update_delivery_detail: async ({ request, fetch, cookies, locals }) => {
			const supabase = getServerSupabase(fetch, cookies);
			const tenantId = locals.tenant?.tenant_id;
			if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

			const formData = await request.formData();
			const delivery_id = (formData.get('delivery_id') as string)?.trim();
			const field = (formData.get('field') as string)?.trim();
			const value = (formData.get('value') as string)?.trim();

			if (!delivery_id) return fail(400, { error: 'Jadwal tidak ditemukan' });
			if (!field) return fail(400, { error: 'Field diperlukan' });

			const allowedFields = ['tanggal', 'slot_waktu', 'alamat', 'catatan'];
			if (!allowedFields.includes(field)) return fail(400, { error: 'Field tidak valid' });

			const { data: delivery } = await supabase
				.from('delivery_schedules').select('id, status')
				.eq('id', delivery_id).eq('tenant_id', tenantId).maybeSingle();

			if (!delivery) return fail(404, { error: 'Jadwal tidak ditemukan' });
			if (delivery.status === 'selesai') return fail(400, { error: 'Jadwal sudah selesai' });

			const update: Record<string, string> = {};
			update[field] = value;

			const { error } = await supabase
				.from('delivery_schedules')
				.update(update)
				.eq('id', delivery_id).eq('tenant_id', tenantId);
			if (error) return fail(500, { error: error.message });

			const fieldLabel: Record<string, string> = {
				tanggal: 'Tanggal', slot_waktu: 'Slot waktu', alamat: 'Alamat', catatan: 'Catatan'
			};
			return { success: true, message: (fieldLabel[field] ?? field) + ' diperbarui' };
		},

		// ── Toggle payment status (for completed orders) ──
	toggle_bayar: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const orderId = formData.get('order_id') as string;
		if (!orderId) return fail(400, { error: 'Order ID diperlukan' });

		const { data: order } = await supabase
			.from('orders')
			.select('id, status, status_bayar, nomor_order')
			.eq('id', orderId).eq('tenant_id', tenantId).maybeSingle();

		if (!order) return fail(404, { error: 'Pesanan tidak ditemukan' });
		if (order.status !== 'selesai') return fail(400, { error: 'Hanya pesanan selesai yang bisa diubah status bayarnya' });

		const newBayar = order.status_bayar === 'lunas' ? 'belum_lunas' : 'lunas';

		const { error } = await supabase
			.from('orders')
			.update({ status_bayar: newBayar })
			.eq('id', orderId).eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });

		return { success: true, message: `Pesanan #${order.nomor_order} ${newBayar === 'lunas' ? 'LUNAS ✅' : 'BELUM LUNAS ⚠️'}` };
	},

	// ── Cancel order ──
	cancel_order: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const orderId = formData.get('order_id') as string;
		if (!orderId) return fail(400, { error: 'Order ID diperlukan' });

		await supabase.from('delivery_schedules').delete().eq('order_id', orderId);
		await supabase.from('order_items').delete().eq('order_id', orderId);
		await supabase.from('order_status_log').delete().eq('order_id', orderId);
		await supabase.from('payments').delete().eq('order_id', orderId);

		const { error } = await supabase
			.from('orders').delete().eq('id', orderId).eq('tenant_id', tenantId);
		if (error) return fail(400, { error: error.message });

		return { success: true, message: 'Pesanan dibatalkan dan dihapus' };
	}
};
