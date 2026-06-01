import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

// WIB offset helper — all DB times are UTC, report boundaries are WIB
function wibDate(y: number, m: number, d: number, h = 0, min = 0, s = 0): string {
	return new Date(Date.UTC(y, m, d, h - 7, min, s)).toISOString();
}
function todayEndWIB(now: Date): string {
	return wibDate(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, -1);
}

function computeRange(
	period: string,
	offset: number,
	dateFrom: string | null,
	dateTo: string | null,
	now: Date
): { dateStart: string; dateEnd: string; periodLabel: string; prevStart: string; prevEnd: string } {
	// Custom range takes precedence
	if (dateFrom && dateTo) {
		const from = new Date(dateFrom);
		const to = new Date(dateTo);
		from.setHours(0, 0, 0, 0);
		to.setHours(23, 59, 59, 999);
		const ms = to.getTime() - from.getTime();
		const days = Math.ceil(ms / 86400000);
		const prevTo = new Date(from.getTime() - 1);
		const prevFrom = new Date(prevTo.getTime() - ms);
		return {
			dateStart: wibDate(from.getFullYear(), from.getMonth(), from.getDate()),
			dateEnd: wibDate(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, -1),
			periodLabel: `${from.toLocaleDateString('id-ID')} – ${to.toLocaleDateString('id-ID')}`,
			prevStart: wibDate(prevFrom.getFullYear(), prevFrom.getMonth(), prevFrom.getDate()),
			prevEnd: wibDate(prevTo.getFullYear(), prevTo.getMonth(), prevTo.getDate() + 1, 0, 0, -1),
		};
	}

	const y = now.getFullYear();
	const m = now.getMonth(); // 0-indexed
	const d = now.getDate();

	if (period === 'today') {
		const target = new Date(now);
		target.setDate(d + offset);
		const td = target.getDate();
		const tm = target.getMonth();
		const ty = target.getFullYear();
		return {
			dateStart: wibDate(ty, tm, td),
			dateEnd: wibDate(ty, tm, td + 1, 0, 0, -1),
			periodLabel: offset === 0 ? `Hari ini, ${td} ${target.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
				: offset === -1 ? `Kemarin, ${td} ${target.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
				: `${td} ${target.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
			prevStart: wibDate(ty, tm, td - 1),
			prevEnd: wibDate(ty, tm, td, 0, 0, -1),
		};
	}

	if (period === 'week') {
		const target = new Date(now);
		target.setDate(d + offset * 7);
		const day = target.getDay();
		const weekStart = new Date(target);
		weekStart.setDate(target.getDate() - day);
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);
		return {
			dateStart: wibDate(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()),
			dateEnd: wibDate(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate() + 1, 0, 0, -1),
			periodLabel: offset === 0 ? `Minggu ini, ${weekStart.toLocaleDateString('id-ID')} – ${weekEnd.toLocaleDateString('id-ID')}`
				: offset === -1 ? `Minggu lalu, ${weekStart.toLocaleDateString('id-ID')} – ${weekEnd.toLocaleDateString('id-ID')}`
				: `${weekStart.toLocaleDateString('id-ID')} – ${weekEnd.toLocaleDateString('id-ID')}`,
			prevStart: wibDate(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7),
			prevEnd: wibDate(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, -1),
		};
	}

	if (period === 'month') {
		const target = new Date(y, m + offset, 1);
		const tmy = target.getFullYear();
		const tmm = target.getMonth();
		const lastDay = new Date(tmy, tmm + 1, 0).getDate();
		return {
			dateStart: wibDate(tmy, tmm, 1),
			dateEnd: wibDate(tmy, tmm, lastDay + 1, 0, 0, -1),
			periodLabel: offset === 0 ? `Bulan ${target.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
				: target.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
			prevStart: wibDate(tmy, tmm - 1, 1),
			prevEnd: wibDate(tmy, tmm, 1, 0, 0, -1),
		};
	}

	// year
	const ty = y + offset;
	return {
		dateStart: wibDate(ty, 0, 1),
		dateEnd: wibDate(ty, 11, 31 + 1, 0, 0, -1),
		periodLabel: offset === 0 ? `Tahun ${ty}` : `${ty}`,
		prevStart: wibDate(ty - 1, 0, 1),
		prevEnd: wibDate(ty, 0, 1, 0, 0, -1),
	};
}

async function fetchPeriodData(supabase: any, tenantId: string, dateStart: string, dateEnd: string) {
	const [ordersRes, paymentsRes] = await Promise.all([
		supabase.from('orders')
			.select('id, nomor_order, status, status_bayar, total, created_at, order_items(nama_layanan, subtotal, qty)')
			.eq('tenant_id', tenantId)
			.gte('created_at', dateStart)
			.lte('created_at', dateEnd)
			.order('created_at', { ascending: false }),
		supabase.from('payments')
			.select('metode, nominal, created_at')
			.eq('tenant_id', tenantId)
			.gte('created_at', dateStart)
			.lte('created_at', dateEnd),
	]);
	return { orders: ordersRes.data ?? [], payments: paymentsRes.data ?? [] };
}

function computeStats(orders: any[], payments: any[]) {
	const revenue = payments.reduce((sum, p) => sum + (p.nominal ?? 0), 0);
	const piutang = orders
		.filter(o => o.status === 'selesai' && o.status_bayar !== 'lunas')
		.reduce((sum, o) => sum + (o.total ?? 0), 0);

	const statusCounts: Record<string, number> = {};
	for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
	const ordersByStatus = Object.entries(statusCounts)
		.map(([status, count]) => ({ status, count }))
		.sort((a, b) => b.count - a.count);

	const methodRevenue: Record<string, number> = {};
	for (const p of payments) methodRevenue[p.metode] = (methodRevenue[p.metode] ?? 0) + (p.nominal ?? 0);
	const revenueByMethod = Object.entries(methodRevenue)
		.map(([metode, total]) => ({ metode, total }))
		.sort((a, b) => b.total - a.total);

	const serviceRevenue: Record<string, { total: number; qty: number }> = {};
	for (const o of orders) {
		for (const item of (o.order_items ?? [])) {
			const name = item.nama_layanan || 'Tidak Diketahui';
			if (!serviceRevenue[name]) serviceRevenue[name] = { total: 0, qty: 0 };
			serviceRevenue[name].total += (item.subtotal ?? 0);
			serviceRevenue[name].qty += (item.qty ?? 0);
		}
	}
	const topServices = Object.entries(serviceRevenue)
		.map(([nama_layanan, data]) => ({ nama_layanan, total: data.total, qty: data.qty }))
		.sort((a, b) => b.total - a.total)
		.slice(0, 10);

	return { revenue, piutang, orderCount: orders.length, ordersByStatus, revenueByMethod, topServices };
}

export const load: PageServerLoad = async ({ locals, fetch, cookies, url }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;
	const currentRole = locals.tenant?.role;
	const tenantSlug = (locals.tenant as any)?.slug;

	// Guard: only admin can view reports
	if (currentRole !== 'admin') {
		throw redirect(303, `/${tenantSlug}`);
	}
	if (!tenantId) throw redirect(303, '/auth/login');

	const period = url.searchParams.get('period') || 'month';
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const dateFrom = url.searchParams.get('date_from');
	const dateTo = url.searchParams.get('date_to');
	const now = new Date();

	const { dateStart, dateEnd, periodLabel, prevStart, prevEnd } = computeRange(period, offset, dateFrom, dateTo, now);

	// Fetch current + previous period in parallel
	const [current, previous, topCustomers] = await Promise.all([
		fetchPeriodData(supabase, tenantId, dateStart, dateEnd),
		fetchPeriodData(supabase, tenantId, prevStart, prevEnd),
		supabase.from('customers')
			.select('nama, nomor_hp, total_belanja')
			.eq('tenant_id', tenantId)
			.order('total_belanja', { ascending: false })
			.limit(10),
	]);

	const stats = computeStats(current.orders, current.payments);
	const prevStats = computeStats(previous.orders, previous.payments);

	// Revenue delta
	const revenueDelta = prevStats.revenue > 0
		? Math.round(((stats.revenue - prevStats.revenue) / prevStats.revenue) * 100)
		: stats.revenue > 0 ? 100 : 0;

	const orderDelta = prevStats.orderCount > 0
		? Math.round(((stats.orderCount - prevStats.orderCount) / prevStats.orderCount) * 100)
		: stats.orderCount > 0 ? 100 : 0;

	return {
		period,
		offset,
		dateFrom: dateFrom || '',
		dateTo: dateTo || '',
		summary: {
			revenue: stats.revenue,
			piutang: stats.piutang,
			orderCount: stats.orderCount,
			periodLabel,
			revenueDelta,
			orderDelta,
			prevRevenue: prevStats.revenue,
			prevOrderCount: prevStats.orderCount,
		},
		ordersByStatus: stats.ordersByStatus,
		revenueByMethod: stats.revenueByMethod,
		topServices: stats.topServices,
		topCustomers: topCustomers.data ?? [],
	};
};
