import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

export const load: PageServerLoad = async ({ locals, fetch, cookies }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;
	if (!tenantId) throw redirect(303, '/auth/login');

	const today = new Date().toISOString().slice(0, 10);
	const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
	const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

	// Query semua paralel
	const [
		{ data: ordersToday, count: ordersTodayCount },
		{ data: ordersYesterday, count: ordersYesterdayCount },
		{ data: pendingOrders },
		{ data: ordersTodayRevenue },
		{ data: ordersYesterdayRevenue },
		{ data: recentOrders },
		{ data: recentCustomers },
		{ data: newCustomersWeek }
	] = await Promise.all([
		// Order count today
		supabase.from('orders').select('id', { count: 'exact', head: true })
			.eq('tenant_id', tenantId).gte('created_at', today).lt('created_at', today + 'T23:59:59'),
		// Order count yesterday
		supabase.from('orders').select('id', { count: 'exact', head: true })
			.eq('tenant_id', tenantId).gte('created_at', yesterday).lt('created_at', today),
		// Pending orders
		supabase.from('orders').select('id, nomor_order, status, total, created_at, customers(nama)')
			.eq('tenant_id', tenantId)
			.in('status', ['diterima','menunggu_jemput','dijemput_driver','proses_cuci','proses_kering','setrika'])
			.order('created_at', { ascending: false }).limit(5),
		// Revenue today
		supabase.from('orders').select('total')
			.eq('tenant_id', tenantId).gte('created_at', today).lt('created_at', today + 'T23:59:59'),
		// Revenue yesterday
		supabase.from('orders').select('total')
			.eq('tenant_id', tenantId).gte('created_at', yesterday).lt('created_at', today),
		// Recent orders
		supabase.from('orders').select('id, nomor_order, status, total, created_at, customers(nama)')
			.eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
		// Recent customers
		supabase.from('customers').select('id, nama, nomor_hp, total_belanja, created_at')
			.eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
		// New customers this week
		supabase.from('customers').select('id', { count: 'exact', head: true })
			.eq('tenant_id', tenantId).gte('created_at', weekAgo)
	]);

	const todayRevenue = (ordersTodayRevenue ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);
	const yesterdayRevenue = (ordersYesterdayRevenue ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);

	return {
		stats: {
			ordersToday: ordersTodayCount ?? 0,
			ordersYesterday: ordersYesterdayCount ?? 0,
			todayRevenue,
			yesterdayRevenue,
			pendingCount: (pendingOrders ?? []).length,
			newCustomersWeek: newCustomersWeek ?? 0
		},
		pendingOrders: pendingOrders ?? [],
		recentOrders: recentOrders ?? [],
		recentCustomers: recentCustomers ?? []
	};
};
