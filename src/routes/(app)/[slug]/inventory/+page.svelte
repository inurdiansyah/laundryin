<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { formatRupiah } from '$lib/utils/format';

	let { data }: { data: PageData } = $props();

	let items = $derived(data.items);
	let movements = $derived(data.movements);
	let systemStocks = $derived(data.systemStocks as Record<string, number>);

	// ── Opname state ──
	let opmodeActive = $state(false);
	let opnameDate = $state(new Date().toISOString().slice(0, 10));
	let opnameEntries = $state<Record<string, { actual: string; notes: string }>>({});

	function resetOpname() {
		opnameEntries = {};
		for (const it of items) {
			opnameEntries[it.id] = { actual: '', notes: '' };
		}
	}

	function startOpname() {
		resetOpname();
		opmodeActive = true;
	}

	function cancelOpname() {
		opmodeActive = false;
		opnameEntries = {};
	}

	function getSystemStok(itemId: string): number {
		return systemStocks[itemId] ?? 0;
	}

	function getSelisih(itemId: string): number {
		const entry = opnameEntries[itemId];
		if (!entry || entry.actual === '') return 0;
		const actual = parseFloat(entry.actual);
		if (isNaN(actual)) return 0;
		return actual - getSystemStok(itemId);
	}

	function hasOpnameChanges(): boolean {
		for (const it of items) {
			const s = getSelisih(it.id);
			const entry = opnameEntries[it.id];
			if (s !== 0 || (entry && entry.notes.trim())) return true;
		}
		return false;
	}

	function buildOpnameJson(): string {
		const entries: { item_id: string; actual_stock: number; notes: string }[] = [];
		for (const it of items) {
			const entry = opnameEntries[it.id];
			if (!entry) continue;
			const actual = entry.actual === '' ? 0 : parseFloat(entry.actual);
			if (isNaN(actual)) continue;
			// Only include items that have actual stock filled, have a difference, or have notes
			if (entry.actual !== '' || entry.notes.trim()) {
				entries.push({
					item_id: it.id,
					actual_stock: actual,
					notes: entry.notes.trim()
				});
			}
		}
		return JSON.stringify(entries);
	}

	// ── Modal state ──
	let showModal = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let editingItem = $state<{
		id: string;
		nama: string;
		satuan: string;
		kategori: string;
		stok_minimum: number;
		harga_beli: number;
	} | null>(null);

	// ── Feedback ──
	let submitError = $state('');
	let successMessage = $state('');
	let successTimer: ReturnType<typeof setTimeout> | null = null;

	function showSuccess(msg: string) {
		successMessage = msg;
		if (successTimer) clearTimeout(successTimer);
		successTimer = setTimeout(() => { successMessage = ''; }, 3000);
	}

	function handleResult(result: { type: string; data?: Record<string, unknown> }) {
		if (result.type === 'success') {
			const d = result.data as Record<string, unknown>;
			showSuccess((d?.message as string) || 'Berhasil');
			closeModal();
			if (opmodeActive) {
				cancelOpname();
			}
		} else if (result.type === 'failure') {
			submitError = ((result.data as Record<string, string>)?.error) || 'Gagal';
		}
	}

	function handleOpnameResult(result: { type: string; data?: Record<string, unknown> }) {
		if (result.type === 'success') {
			const d = result.data as Record<string, unknown>;
			showSuccess((d?.message as string) || 'Opname berhasil');
			cancelOpname();
		} else if (result.type === 'failure') {
			submitError = ((result.data as Record<string, string>)?.error) || 'Gagal';
		}
	}

	function openAddItem() {
		modalMode = 'create';
		editingItem = null;
		showModal = true;
		submitError = '';
	}

	function openEditItem(it: Record<string, unknown>) {
		modalMode = 'edit';
		editingItem = {
			id: it.id as string,
			nama: it.nama as string,
			satuan: it.satuan as string,
			kategori: (it.kategori as string) || 'Lainnya',
			stok_minimum: (it.stok_minimum as number) || 0,
			harga_beli: (it.harga_beli as number) || 0
		};
		showModal = true;
		submitError = '';
	}

	function closeModal() {
		showModal = false;
		editingItem = null;
	}
</script>

<svelte:head><title>Inventori — LaundryIn</title></svelte:head>

<div class="h-[calc(100vh-0px)] overflow-y-auto bg-gray-50">
	<div class="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold text-gray-800">📦 Inventori ({items.length})</h1>
			<button onclick={openAddItem} class="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition shadow-md shadow-green-200">+ Tambah</button>
		</div>

		<!-- Toast -->
		{#if successMessage}
			<div class="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
				<span>✅</span><p class="text-sm font-medium text-green-700">{successMessage}</p>
			</div>
		{/if}
		{#if submitError}
			<div class="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
				<span>⚠️</span><p class="text-sm font-medium text-red-700">{submitError}</p>
				<button onclick={() => submitError = ''} class="ml-auto text-red-400 hover:text-red-600">&times;</button>
			</div>
		{/if}

		<!-- ═══ Opname Stok Harian ═══ -->
		<div class="rounded-xl border border-indigo-200 bg-white">
			<div class="p-4 border-b border-indigo-100">
				<div class="flex flex-col sm:flex-row sm:items-center gap-3">
					<div class="flex-1">
						<h2 class="text-sm font-semibold text-indigo-800">📋 Opname Stok Harian</h2>
						<p class="text-xs text-indigo-500 mt-0.5">Catat stok fisik aktual untuk mencocokkan dengan stok sistem</p>
					</div>
					{#if !opmodeActive}
						<div class="flex items-center gap-2">
							<input type="date" bind:value={opnameDate}
								class="rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
							<button onclick={startOpname}
								class="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-200">
								Mulai Opname
							</button>
						</div>
					{/if}
				</div>
			</div>

			{#if opmodeActive}
				<form method="POST" action="?/do_opname" use:enhance={() => { submitError = ''; return async ({ result }) => { handleOpnameResult(result); await applyAction(result); }; }}>
					<input type="hidden" name="opname_date" value={opnameDate} />
					<input type="hidden" name="entries" value={buildOpnameJson()} />

					<!-- Desktop: table -->
					<div class="hidden sm:block overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="border-b border-indigo-100 bg-indigo-50/50 text-left text-[10px] text-indigo-500 uppercase font-semibold">
									<th class="p-3 pr-2">Item</th>
									<th class="p-3 pr-2 text-right">Stok Sistem</th>
									<th class="p-3 pr-2 text-right">Stok Aktual</th>
									<th class="p-3 pr-2 text-right">Selisih</th>
									<th class="p-3">Catatan</th>
								</tr>
							</thead>
							<tbody>
								{#each items as it}
									{@const systemStok = getSystemStok(it.id)}
									{@const selisih = getSelisih(it.id)}
									<tr class="border-b border-indigo-50 hover:bg-indigo-50/30">
										<td class="p-3 pr-2">
											<p class="font-medium text-gray-800">{it.nama}</p>
											<p class="text-[10px] text-gray-400">{it.kategori || 'Lainnya'} · {it.satuan}</p>
										</td>
										<td class="p-3 pr-2 text-right font-mono text-gray-700 font-semibold">{systemStok}</td>
										<td class="p-3 pr-2">
											<input type="number" step="0.01" min="0" placeholder="0"
												bind:value={opnameEntries[it.id].actual}
												class="w-24 text-right rounded-md border border-gray-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
										</td>
										<td class="p-3 pr-2 text-right font-mono font-bold
											{selisih < 0 ? 'text-red-600' : selisih > 0 ? 'text-green-600' : 'text-gray-400'}">
											{selisih > 0 ? '+' : ''}{selisih}
										</td>
										<td class="p-3">
											<input type="text" placeholder="Opsional"
												bind:value={opnameEntries[it.id].notes}
												class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<!-- Mobile: cards -->
					<div class="sm:hidden space-y-2">
						{#each items as it}
							{@const systemStok = getSystemStok(it.id)}
							{@const selisih = getSelisih(it.id)}
							<div class="rounded-lg border border-indigo-100 bg-white p-3 space-y-2">
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-semibold text-gray-800">{it.nama}</p>
										<p class="text-[10px] text-gray-400">{it.kategori || 'Lainnya'} · {it.satuan}</p>
									</div>
									<span class="text-xs font-mono font-bold text-gray-500">Sistem: {systemStok}</span>
								</div>
								<div class="flex gap-2 items-end">
									<div class="flex-1">
										<label for="stok_aktual_field" class="text-[10px] text-gray-400 block mb-0.5">Stok Aktual</label>
										<input id="stok_aktual_field" type="number" step="0.01" min="0" placeholder="0"
											bind:value={opnameEntries[it.id].actual}
											class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
									</div>
									<div class="flex-shrink-0 text-xs font-mono font-bold px-2
										{selisih < 0 ? 'text-red-600' : selisih > 0 ? 'text-green-600' : 'text-gray-400'}">
										{selisih ? (selisih > 0 ? '+' : '') + selisih : '0'}
									</div>
								</div>
								<input type="text" placeholder="Catatan (opsional)"
									bind:value={opnameEntries[it.id].notes}
									class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
							</div>
						{/each}
					</div>

					<div class="p-4 flex items-center justify-between gap-3 border-t border-indigo-100">
						<p class="text-[10px] text-indigo-400">
							{hasOpnameChanges() ? '✅ Ada perubahan yang akan disimpan' : 'ℹ️ Tidak ada perubahan'}
							· Tanggal: {opnameDate}
						</p>
						<div class="flex gap-2">
							<button type="button" onclick={cancelOpname}
								class="rounded-lg bg-white border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
								Batal
							</button>
							<button type="submit"
								class="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-200">
								Simpan Opname
							</button>
						</div>
					</div>
				</form>
			{/if}
		</div>

		<!-- Items Grid -->
		{#if items.length === 0}
			<div class="rounded-xl bg-white p-12 border border-gray-200 text-center">
				<p class="text-gray-400">Belum ada item inventori</p>
			</div>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each items as it}
					{@const systemStok = systemStocks[it.id] ?? Number(it.stok ?? 0)}
					<div class="rounded-xl border {systemStok <= Number(it.stok_minimum ?? 0) && Number(it.stok_minimum ?? 0) > 0 ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-white'} p-4 flex flex-col gap-2 group relative">
						<!-- Stok rendah badge -->
						{#if systemStok <= Number(it.stok_minimum ?? 0) && Number(it.stok_minimum ?? 0) > 0}
							<span class="absolute top-2 right-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">⚠ Stok Rendah</span>
						{/if}

						<div class="flex items-start justify-between">
							<div>
								<p class="text-sm font-semibold text-gray-800">{it.nama}</p>
								<p class="text-xs text-gray-400">{it.kategori || 'Lainnya'} · {it.satuan}</p>
							</div>
							<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
								<button onclick={() => openEditItem(it)}
									class="rounded-lg p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition text-xs"
									title="Edit">✏️</button>
								<form method="POST" action="?/delete_item" use:enhance={() => { submitError = ''; return async ({ result }) => { handleResult(result); await applyAction(result); }; }}>
									<input type="hidden" name="id" value={it.id} />
									<button type="submit"
										class="rounded-lg p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 transition text-xs"
										title="Hapus">🗑️</button>
								</form>
							</div>
						</div>

						<!-- Stok display (system calculated) -->
						<div class="flex items-baseline gap-1 mt-1">
							<span class="text-xl font-bold {systemStok <= Number(it.stok_minimum ?? 0) && Number(it.stok_minimum ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}">{systemStok}</span>
							<span class="text-xs text-gray-400">{it.satuan}</span>
						</div>

						<!-- Stok minimum info -->
						{#if it.stok_minimum > 0}
							<p class="text-[10px] text-gray-400">Min: {it.stok_minimum} {it.satuan}</p>
						{/if}

						<!-- Quick stock movement -->
						<div class="border-t border-gray-100 pt-2 mt-1 space-y-1.5">
							<!-- + Masuk -->
							<form method="POST" action="?/add_stock" use:enhance={() => { submitError = ''; return async ({ result }) => { handleResult(result); await applyAction(result); }; }} class="flex items-center gap-1.5">
								<input type="hidden" name="item_id" value={it.id} />
								<button type="submit" class="flex-shrink-0 rounded-md bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-200 transition">+ Masuk</button>
								<input type="number" name="qty" step="0.01" min="0.01" placeholder="Jml" required
									class="flex-1 min-w-0 rounded-md border border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-green-300" />
								<input type="text" name="keterangan" placeholder="Ket"
									class="w-16 flex-shrink-0 rounded-md border border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-green-300" />
							</form>
							<!-- - Keluar -->
							<form method="POST" action="?/reduce_stock" use:enhance={() => { submitError = ''; return async ({ result }) => { handleResult(result); await applyAction(result); }; }} class="flex items-center gap-1.5">
								<input type="hidden" name="item_id" value={it.id} />
								<button type="submit" class="flex-shrink-0 rounded-md bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-200 transition">- Keluar</button>
								<input type="number" name="qty" step="0.01" min="0.01" placeholder="Jml" required
									class="flex-1 min-w-0 rounded-md border border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-red-300" />
								<input type="text" name="keterangan" placeholder="Ket"
									class="w-16 flex-shrink-0 rounded-md border border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-red-300" />
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Recent Movements -->
		{#if movements.length > 0}
			<div class="rounded-xl border border-gray-200 bg-white p-5">
				<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">📋 Mutasi Terbaru</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase">
								<th class="pb-2 pr-3 font-medium">Waktu</th>
								<th class="pb-2 pr-3 font-medium">Item</th>
								<th class="pb-2 pr-3 font-medium">Tipe</th>
								<th class="pb-2 pr-3 font-medium text-right">Qty</th>
								<th class="pb-2 font-medium">Keterangan</th>
							</tr>
						</thead>
						<tbody>
							{#each movements as m}
								{@const itemNama = (m as Record<string, unknown>).inventory_items as Record<string, unknown> | null}
								{@const tipe = (m as Record<string, unknown>).tipe as string}
								{@const qty = Number((m as Record<string, unknown>).qty)}
								{@const keterangan = (m as Record<string, unknown>).keterangan as string | null}
								<tr class="border-b border-gray-50">
									<td class="py-2 pr-3 text-xs text-gray-400 whitespace-nowrap">
										{new Date((m as Record<string, unknown>).created_at as string).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
									</td>
									<td class="py-2 pr-3 text-xs font-medium text-gray-700">{itemNama?.nama || '—'}</td>
									<td class="py-2 pr-3">
										<span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium
											{tipe === 'masuk' ? 'bg-green-100 text-green-700' : tipe === 'keluar' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}">
											{tipe === 'masuk' ? 'Masuk' : tipe === 'keluar' ? 'Keluar' : 'Opname'}
										</span>
									</td>
									<td class="py-2 pr-3 text-xs text-right font-medium
										{tipe === 'masuk' ? 'text-green-600' : tipe === 'keluar' ? 'text-red-600' : 'text-indigo-600'}">
										{tipe === 'masuk' ? '+' : tipe === 'keluar' ? '-' : ''}{qty} {itemNama?.satuan || ''}
									</td>
									<td class="py-2 text-xs text-gray-400">
										{keterangan
											? keterangan.startsWith('opname:')
												? 'Opname ' + keterangan.split(':').slice(1).join(' · ')
												: keterangan
											: '—'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- ═══ Modal: Tambah/Edit Item ═══ -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button onclick={closeModal} class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-default" aria-label="Tutup"></button>
		<div class="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-bold text-gray-800">{modalMode === 'create' ? 'Tambah Item' : 'Edit Item'}</h2>
				<button onclick={closeModal} class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
			</div>
			<form method="POST" action={modalMode === 'create' ? '?/add_item' : '?/update_item'} use:enhance={() => { submitError = ''; return async ({ result }) => { handleResult(result); await applyAction(result); }; }} class="space-y-4">
				{#if modalMode === 'edit' && editingItem}
					<input type="hidden" name="id" value={editingItem.id} />
				{/if}
				<div>
					<label for="nama_field" class="block text-sm font-medium text-gray-600 mb-1.5">Nama <span class="text-red-400">*</span></label>
					<input id="nama_field" type="text" name="nama" required value={editingItem?.nama || ''} class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="satuan_field" class="block text-sm font-medium text-gray-600 mb-1.5">Satuan</label>
						<select id="satuan_field" name="satuan" class="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500">
							{#each ['pcs', 'kg', 'liter', 'botol', 'pack', 'roll', 'set'] as s}
								<option value={s} selected={editingItem?.satuan === s}>{s}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="kategori_field" class="block text-sm font-medium text-gray-600 mb-1.5">Kategori</label>
						<select id="kategori_field" name="kategori" class="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500">
							{#each ['Deterjen', 'Pewangi', 'Plastik', 'Alat', 'Lainnya'] as k}
								<option value={k} selected={editingItem?.kategori === k}>{k}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="stok_minimum_field" class="block text-sm font-medium text-gray-600 mb-1.5">Stok Minimum</label>
						<input id="stok_minimum_field" type="number" name="stok_minimum" step="0.01" min="0" value={editingItem?.stok_minimum || 0} class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
					<div>
						<label for="harga_beli_field" class="block text-sm font-medium text-gray-600 mb-1.5">Harga Beli (Rp)</label>
						<input id="harga_beli_field" type="number" name="harga_beli" min="0" value={editingItem?.harga_beli || 0} class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
				</div>
				<div class="flex gap-3 pt-1">
					<button type="submit" class="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-md shadow-green-200 hover:bg-green-700 transition">{modalMode === 'create' ? 'Simpan' : 'Update'}</button>
					<button type="button" onclick={closeModal} class="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 transition">Batal</button>
				</div>
			</form>
		</div>
	</div>
{/if}
