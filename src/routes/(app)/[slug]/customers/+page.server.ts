import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

export const load: PageServerLoad = async ({ locals, fetch, cookies, url }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;

	if (!tenantId) throw redirect(303, '/auth/login');

	const search = url.searchParams.get('search')?.trim() || '';

	// Query customers
	let query = supabase
		.from('customers')
		.select('id, nama, nomor_hp, alamat, total_belanja, created_at')
		.eq('tenant_id', tenantId)
		.order('nama');

	if (search) {
		query = query.or(`nama.ilike.%${search}%,nomor_hp.ilike.%${search}%`);
	}

	// Query all orders for this tenant (for order counts and expand detail)
	const ordersQuery = supabase
		.from('orders')
		.select('customer_id, id, nomor_order, total, status, status_bayar, created_at')
		.eq('tenant_id', tenantId)
		.order('created_at', { ascending: false });

	const [customersRes, ordersRes] = await Promise.all([query, ordersQuery]);

	const customers = customersRes.data ?? [];
	const orders = ordersRes.data ?? [];

	// Group orders by customer_id
	const ordersByCustomer: Record<
		string,
		{ count: number; orders: typeof orders }
	> = {};
	for (const order of orders) {
		if (!ordersByCustomer[order.customer_id]) {
			ordersByCustomer[order.customer_id] = { count: 0, orders: [] };
		}
		ordersByCustomer[order.customer_id].count++;
		ordersByCustomer[order.customer_id].orders.push(order);
	}

	// Merge customers with order counts + total belanja aktual (only lunas)
	const customersWithOrders = customers.map((c) => {
		const customerOrders = ordersByCustomer[c.id]?.orders ?? [];
		const totalBelanja = customerOrders
			.filter(o => o.status_bayar === 'lunas')
			.reduce((sum, o) => sum + (o.total || 0), 0);
		return {
			...c,
			order_count: ordersByCustomer[c.id]?.count ?? 0,
			total_belanja_aktual: totalBelanja,
			orders: customerOrders
		};
	});

	return {
		customers: customersWithOrders,
		search
	};
};

export const actions: Actions = {
	// ── Get customer detail + orders (for dashboard inline expand) ──
	customer_detail: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const customerId = formData.get('customer_id') as string;
		if (!customerId) return fail(400, { error: 'Customer ID diperlukan' });

		const { data: orders, error } = await supabase
			.from('orders')
			.select('id, nomor_order, total, status, created_at')
			.eq('tenant_id', tenantId).eq('customer_id', customerId)
			.order('created_at', { ascending: false }).limit(10);

		if (error) return fail(404, { error: error.message });
		return { type: 'success', data: { orders } };
	},

	create: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const nama = (formData.get('nama') as string)?.trim();
		const nomor_hp = (formData.get('nomor_hp') as string)?.trim();
		const alamat = (formData.get('alamat') as string)?.trim() || null;

		if (!nama) return fail(400, { error: 'Nama pelanggan wajib diisi' });
		if (!nomor_hp) return fail(400, { error: 'Nomor HP wajib diisi' });

		// Check for duplicate nomor_hp
		const { data: existing } = await supabase
			.from('customers')
			.select('id')
			.eq('tenant_id', tenantId)
			.eq('nomor_hp', nomor_hp)
			.maybeSingle();

		if (existing) {
			return fail(400, { error: 'Nomor HP sudah terdaftar' });
		}

		const { error } = await supabase.from('customers').insert({
			tenant_id: tenantId,
			nama,
			nomor_hp,
			alamat,
			total_belanja: 0
		});

		if (error) return fail(500, { error: error.message });

		return { success: true, message: 'Pelanggan berhasil ditambahkan' };
	},

	update: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim();
		const nama = (formData.get('nama') as string)?.trim();
		const nomor_hp = (formData.get('nomor_hp') as string)?.trim();
		const alamat = (formData.get('alamat') as string)?.trim() || null;

		if (!id) return fail(400, { error: 'ID pelanggan tidak ditemukan' });
		if (!nama) return fail(400, { error: 'Nama pelanggan wajib diisi' });
		if (!nomor_hp) return fail(400, { error: 'Nomor HP wajib diisi' });

		// Check duplicate (exclude self)
		const { data: existing } = await supabase
			.from('customers')
			.select('id')
			.eq('tenant_id', tenantId)
			.eq('nomor_hp', nomor_hp)
			.neq('id', id)
			.maybeSingle();

		if (existing) {
			return fail(400, { error: 'Nomor HP sudah digunakan pelanggan lain' });
		}

		const { error } = await supabase
			.from('customers')
			.update({ nama, nomor_hp, alamat })
			.eq('id', id)
			.eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });

		return { success: true, message: 'Pelanggan berhasil diperbarui' };
	},

	delete: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim();

		if (!id) return fail(400, { error: 'ID pelanggan tidak ditemukan' });

		// Check if customer has orders
		const { count } = await supabase
			.from('orders')
			.select('id', { count: 'exact', head: true })
			.eq('customer_id', id)
			.eq('tenant_id', tenantId);

		if (count && count > 0) {
			return fail(400, {
				error: `Pelanggan memiliki ${count} pesanan. Hapus semua pesanan terlebih dahulu.`
			});
		}

		const { error } = await supabase
			.from('customers')
			.delete()
			.eq('id', id)
			.eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });

		return { success: true, message: 'Pelanggan berhasil dihapus' };
	}
};
