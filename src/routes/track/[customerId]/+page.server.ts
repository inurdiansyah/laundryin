import type { PageServerLoad } from './$types';
import { getServiceSupabase } from '$lib/supabase/server';

const supabase = getServiceSupabase();

interface OrderItem {
	id: string;
	tenant_id: string;
	tenant_nama: string;
	nomor_order: string;
	tanggal: string;
	total: number;
	status_bayar: string;
	status: string;
	items: { nama: string; qty: number; satuan: string; harga: number }[];
}

export const load: PageServerLoad = async ({ params }) => {
	const { customerId } = params;

	// Get customer info (service role — bypasses RLS for public route)
	const { data: customer } = await supabase
		.from('customers')
		.select('id, nama, nomor_hp, tenant_id')
		.eq('id', customerId)
		.single();

	if (!customer) {
		return { customer: null, orders: [] };
	}

	// Get all orders for this customer
	const { data: orders } = await supabase
		.from('orders')
		.select(`
			id,
			nomor_order,
			total,
			status_bayar,
			created_at,
			status,
			tenant:tenant_id(nama)
		`)
		.eq('customer_id', customerId)
		.order('created_at', { ascending: false });

	return {
		customer: {
			nama: customer.nama,
			nomor_hp: customer.nomor_hp
		},
		orders: (orders || []).map(o => ({
			id: o.id,
			nomor_order: o.nomor_order,
			total: o.total,
			status_bayar: o.status_bayar,
			tanggal: o.created_at,
			status: o.status,
			tenant_nama: (o.tenant as any)?.nama ?? 'LaundryIn'
		}))
	};
};
