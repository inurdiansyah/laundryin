import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getServerSupabase } from '$lib/supabase/server';

export const load: PageServerLoad = async ({ locals, fetch, cookies }) => {
	const supabase = getServerSupabase(fetch, cookies);
	const tenantId = locals.tenant?.tenant_id;
	if (!tenantId) throw redirect(303, '/auth/login');

	// Fetch all inventory items for this tenant
	const { data: items } = await supabase
		.from('inventory_items')
		.select('*')
		.eq('tenant_id', tenantId)
		.order('nama');

	// Fetch recent movements for all items belonging to this tenant
	const { data: itemIds } = await supabase
		.from('inventory_items')
		.select('id')
		.eq('tenant_id', tenantId);

	const ids = (itemIds ?? []).map((i) => i.id);

	let movements: unknown[] = [];
	let systemStocks: Record<string, number> = {};

	if (ids.length > 0) {
		// Fetch recent movements (including opname) for the history table
		const { data: mov } = await supabase
			.from('inventory_movements')
			.select('id, item_id, tipe, qty, keterangan, created_at, inventory_items(nama, satuan)')
			.in('item_id', ids)
			.order('created_at', { ascending: false })
			.limit(50);
		movements = mov ?? [];

		// Calculate system stock for each item:
		// system_stok = total_masuk - total_keluar + total_opname (past adjustments)
		const { data: stockAgg } = await supabase
			.from('inventory_movements')
			.select('item_id, tipe, qty')
			.in('item_id', ids);

		if (stockAgg) {
			for (const item of stockAgg) {
				const itemId = item.item_id;
				if (!systemStocks[itemId]) systemStocks[itemId] = 0;
				if (item.tipe === 'masuk') {
					systemStocks[itemId] += Number(item.qty);
				} else if (item.tipe === 'keluar') {
					systemStocks[itemId] -= Number(item.qty);
				} else if (item.tipe === 'opname') {
					// Past opname adjustments are already factored into running stock
					systemStocks[itemId] += Number(item.qty);
				}
			}
		}
	}

	return {
		items: items ?? [],
		movements,
		systemStocks
	};
};

export const actions: Actions = {
	// ── Add new inventory item ──
	add_item: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const nama = (formData.get('nama') as string)?.trim();
		const satuan = (formData.get('satuan') as string)?.trim() || 'pcs';
		const kategori = (formData.get('kategori') as string)?.trim() || 'Lainnya';
		const stok_minimum = parseFloat((formData.get('stok_minimum') as string) || '0');
		const harga_beli = parseInt((formData.get('harga_beli') as string) || '0');

		if (!nama) return fail(400, { error: 'Nama item wajib diisi' });

		const { error } = await supabase.from('inventory_items').insert({
			tenant_id: tenantId,
			nama,
			satuan,
			kategori,
			stok_minimum,
			harga_beli
		});

		if (error) return fail(500, { error: error.message });
		return { success: true, message: 'Item berhasil ditambahkan' };
	},

	// ── Update inventory item ──
	update_item: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim();
		const nama = (formData.get('nama') as string)?.trim();
		const satuan = (formData.get('satuan') as string)?.trim() || 'pcs';
		const kategori = (formData.get('kategori') as string)?.trim() || 'Lainnya';
		const stok_minimum = parseFloat((formData.get('stok_minimum') as string) || '0');
		const harga_beli = parseInt((formData.get('harga_beli') as string) || '0');

		if (!id) return fail(400, { error: 'ID item tidak ditemukan' });
		if (!nama) return fail(400, { error: 'Nama item wajib diisi' });

		const { error } = await supabase
			.from('inventory_items')
			.update({ nama, satuan, kategori, stok_minimum, harga_beli })
			.eq('id', id)
			.eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });
		return { success: true, message: 'Item berhasil diperbarui' };
	},

	// ── Delete inventory item (only if no movements) ──
	delete_item: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const id = (formData.get('id') as string)?.trim();
		if (!id) return fail(400, { error: 'ID item tidak ditemukan' });

		// Check for existing movements
		const { count } = await supabase
			.from('inventory_movements')
			.select('id', { count: 'exact', head: true })
			.eq('item_id', id);

		if (count && count > 0) {
			return fail(400, {
				error: `Item memiliki ${count} mutasi. Tidak dapat dihapus.`
			});
		}

		const { error } = await supabase
			.from('inventory_items')
			.delete()
			.eq('id', id)
			.eq('tenant_id', tenantId);

		if (error) return fail(500, { error: error.message });
		return { success: true, message: 'Item berhasil dihapus' };
	},

	// ── Add stock (stok masuk) ──
	add_stock: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const item_id = (formData.get('item_id') as string)?.trim();
		const qty = parseFloat((formData.get('qty') as string) || '0');
		const keterangan = (formData.get('keterangan') as string)?.trim() || null;

		if (!item_id) return fail(400, { error: 'Item tidak ditemukan' });
		if (!qty || qty <= 0) return fail(400, { error: 'Jumlah harus lebih dari 0' });

		// Verify item belongs to tenant
		const { data: item } = await supabase
			.from('inventory_items')
			.select('id, stok')
			.eq('id', item_id)
			.eq('tenant_id', tenantId)
			.single();

		if (!item) return fail(404, { error: 'Item tidak ditemukan' });

		// Insert movement
		const { error: movError } = await supabase.from('inventory_movements').insert({
			item_id,
			tipe: 'masuk',
			qty,
			keterangan
		});

		if (movError) return fail(500, { error: movError.message });

		// Update stock
		const newStok = Number(item.stok) + qty;
		const { error: updError } = await supabase
			.from('inventory_items')
			.update({ stok: newStok })
			.eq('id', item_id);

		if (updError) return fail(500, { error: updError.message });
		return { success: true, message: `Stok masuk ${qty}` };
	},

	// ── Reduce stock (stok keluar) ──
	reduce_stock: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const item_id = (formData.get('item_id') as string)?.trim();
		const qty = parseFloat((formData.get('qty') as string) || '0');
		const keterangan = (formData.get('keterangan') as string)?.trim() || null;

		if (!item_id) return fail(400, { error: 'Item tidak ditemukan' });
		if (!qty || qty <= 0) return fail(400, { error: 'Jumlah harus lebih dari 0' });

		// Verify item belongs to tenant and has enough stock
		const { data: item } = await supabase
			.from('inventory_items')
			.select('id, stok')
			.eq('id', item_id)
			.eq('tenant_id', tenantId)
			.single();

		if (!item) return fail(404, { error: 'Item tidak ditemukan' });

		if (Number(item.stok) < qty) {
			return fail(400, {
				error: `Stok tidak mencukupi. Tersedia: ${item.stok}`
			});
		}

		// Insert movement
		const { error: movError } = await supabase.from('inventory_movements').insert({
			item_id,
			tipe: 'keluar',
			qty,
			keterangan
		});

		if (movError) return fail(500, { error: movError.message });

		// Update stock
		const newStok = Number(item.stok) - qty;
		const { error: updError } = await supabase
			.from('inventory_items')
			.update({ stok: newStok })
			.eq('id', item_id);

		if (updError) return fail(500, { error: updError.message });
		return { success: true, message: `Stok keluar ${qty}` };
	},

	// ── Daily stocktaking (opname harian) ──
	do_opname: async ({ request, fetch, cookies, locals }) => {
		const supabase = getServerSupabase(fetch, cookies);
		const tenantId = locals.tenant?.tenant_id;
		if (!tenantId) return fail(403, { error: 'Tenant tidak ditemukan' });

		const formData = await request.formData();
		const opnameDate = (formData.get('opname_date') as string)?.trim() || new Date().toISOString().slice(0, 10);
		const entriesJson = (formData.get('entries') as string)?.trim();

		if (!entriesJson) return fail(400, { error: 'Data opname tidak ditemukan' });

		let entries: { item_id: string; actual_stock: number; notes: string }[];
		try {
			entries = JSON.parse(entriesJson);
		} catch {
			return fail(400, { error: 'Format data opname tidak valid' });
		}

		if (!entries.length) return fail(400, { error: 'Tidak ada item untuk diopname' });

		// Fetch current system stock for all items in this opname
		const itemIds = entries.map((e) => e.item_id);

		// Verify items belong to this tenant
		const { data: items } = await supabase
			.from('inventory_items')
			.select('id, stok')
			.in('id', itemIds)
			.eq('tenant_id', tenantId);

		if (!items || items.length === 0) {
			return fail(404, { error: 'Item tidak ditemukan' });
		}

		const itemStokMap = new Map(items.map((i) => [i.id, Number(i.stok)]));

		// Calculate system stock from movements for each item
		const { data: stockAgg } = await supabase
			.from('inventory_movements')
			.select('item_id, tipe, qty')
			.in('item_id', itemIds);

		const systemStokMap = new Map<string, number>();
		for (const id of itemIds) systemStokMap.set(id, 0);
		if (stockAgg) {
			for (const mov of stockAgg) {
				const cur = systemStokMap.get(mov.item_id) ?? 0;
				if (mov.tipe === 'masuk') {
					systemStokMap.set(mov.item_id, cur + Number(mov.qty));
				} else if (mov.tipe === 'keluar') {
					systemStokMap.set(mov.item_id, cur - Number(mov.qty));
				} else if (mov.tipe === 'opname') {
					systemStokMap.set(mov.item_id, cur + Number(mov.qty));
				}
			}
		}

		// Process each entry: create opname movement and update stok
		const errors: string[] = [];
		const itemNames: Record<string, string> = {};

		for (const entry of entries) {
			const systemStok = systemStokMap.get(entry.item_id) ?? 0;
			const selisih = entry.actual_stock - systemStok;

			// Skip if no difference and no notes (nothing to record)
			if (selisih === 0 && !entry.notes) continue;

			// Create opname movement
			const catatan = entry.notes
				? `opname:${opnameDate}:${entry.notes}`
				: `opname:${opnameDate}`;

			const { error: movError } = await supabase.from('inventory_movements').insert({
				item_id: entry.item_id,
				tipe: 'opname',
				qty: selisih,
				keterangan: catatan
			});

			if (movError) {
				errors.push(`Gagal simpan opname item ${entry.item_id}: ${movError.message}`);
				continue;
			}

			// Update the denormalized stok column on inventory_items
			const currentStok = itemStokMap.get(entry.item_id) ?? 0;
			const newStok = currentStok + selisih;
			await supabase
				.from('inventory_items')
				.update({ stok: newStok })
				.eq('id', entry.item_id);
		}

		if (errors.length > 0) {
			return fail(500, { error: `Beberapa item gagal: ${errors.join('; ')}` });
		}

		return { success: true, message: `Opname ${opnameDate} berhasil disimpan` };
	}
};
