<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { formatRupiah, formatTanggal } from '$lib/utils/format';
	import { generateInvoicePDF } from '$lib/utils/invoice';
	import InvoiceTemplate from '$lib/components/InvoiceTemplate.svelte';

	let { data }: { data: PageData } = $props();

	let customers = $derived(data.customers);
	let layanan = $derived(data.layanan);
	let formState = $derived($page.form);

	// ── Customer ──
	let customerSearch = $state('');
	let searchFocused = $state(false);
	let showNewCustomer = $state(false);
	let selectedCustomer: { id: string; nama: string; nomor_hp: string } | null = $state(null);
	let newNama = $state('');
	let newHp = $state('');

	let filteredCustomers = $derived(
		customerSearch.trim()
			? customers.filter(c =>
				c.nama.toLowerCase().includes(customerSearch.toLowerCase()) ||
				c.nomor_hp.includes(customerSearch)
			).slice(0, 5)
			: customers.slice(0, 5)
	);

	function selectCustomer(c: typeof customers[0]) {
		selectedCustomer = { id: c.id, nama: c.nama, nomor_hp: c.nomor_hp };
		customerSearch = '';
		searchFocused = false;
		showNewCustomer = false;
	}
	function clearCustomer() {
		selectedCustomer = null;
		showNewCustomer = false;
	}

	// ── Layanan ──
	let serviceSearch = $state('');
	let activeCategory = $state('Semua');

	let categories = $derived(['Semua', ...new Set(layanan.map(l => l.kategori || 'Lainnya'))]);
	let filteredLayanan = $derived(
		layanan.filter(l => {
			const matchSearch = !serviceSearch || l.nama.toLowerCase().includes(serviceSearch.toLowerCase());
			const matchCat = activeCategory === 'Semua' || l.kategori === activeCategory;
			return matchSearch && matchCat;
		})
	);

	// ── Cart ──
	let qtyMap = $state<Record<string, number>>({});
	let diskon = $state(0);

	function setQty(id: string, val: number) {
		qtyMap = { ...qtyMap, [id]: Math.max(0, val) };
	}
	function updateQty(layananId: string, delta: number, absolute?: number) {
		const current = qtyMap[layananId] || 1;
		let newQty: number;
		if (absolute !== undefined) {
			newQty = Math.max(0.1, absolute);
		} else {
			const satuan = layanan.find(l => l.id === layananId)?.satuan;
			const step = satuan === 'kg' ? 0.5 : 1;
			newQty = Math.max(0.1, current + step * Math.sign(delta));
		}
		if (newQty <= 0) {
			const next = { ...qtyMap };
			delete next[layananId];
			qtyMap = next;
			return;
		}
		qtyMap = { ...qtyMap, [layananId]: Math.round(newQty * 10) / 10 };
	}
	function removeItem(id: string) {
		const next = { ...qtyMap };
		delete next[id];
		qtyMap = next;
	}
	function clearCart() {
		qtyMap = {};
		diskon = 0;
	}

	let selectedItems = $derived(
		layanan
			.filter(l => (qtyMap[l.id] ?? 0) > 0)
			.map(l => ({ ...l, qty: qtyMap[l.id] ?? 0 }))
	);
	let subtotal = $derived(
		selectedItems.reduce((sum, item) => sum + item.harga * item.qty, 0)
	);
	let total = $derived(Math.max(0, subtotal - diskon));

	// ── Pembayaran ──
	let metodeBayar = $state('tunai');
	let nominalBayar = $state(0);
	let waktuBayar = $state<'awal' | 'akhir'>('awal');
	let jalur = $state('drop_ambil');
	let catatan = $state('');
	let kembalian = $derived(Math.max(0, nominalBayar - total));

	// ── Mobile cart toggle ──
	let showMobileCart = $state(false);

	let submitting = $state(false);
	let showSuccess = $state(false);
	let successData: { nomor_order: string; total: number } | null = $state(null);
	let submitError = $state('');

	// ── Invoice ──
	let showInvoice = $state(false);
	let invoiceLoading = $state(false);
	let receiptSnapshot = $state<{
		nomor_order: string;
		tanggal: string;
		items: { nama: string; qty: number; satuan: string; harga: number; subtotal: number }[];
		subtotal: number;
		diskon: number;
		total: number;
		metode_bayar: string;
		status_bayar: string;
		customer_nama: string;
		customer_hp: string;
	} | null>(null);

	let canSubmit = $derived(
		selectedItems.length > 0
		&& (selectedCustomer || (newNama.trim() && newHp.trim()))
		&& !submitting
		&& (waktuBayar === 'akhir' || nominalBayar >= total)
	);

	function resetAll() {
		selectedCustomer = null;
		newNama = '';
		newHp = '';
		customerSearch = '';
		showNewCustomer = false;
		clearCart();
		metodeBayar = 'tunai';
		nominalBayar = 0;
		waktuBayar = 'awal';
		submitError = '';
	}

	let closeSuccessTimer: ReturnType<typeof setTimeout> | null = null;

	function closeSuccess() {
		showSuccess = false;
		successData = null;
		if (closeSuccessTimer) clearTimeout(closeSuccessTimer);
	}

	function captureReceipt() {
		if (!successData) return;
		receiptSnapshot = {
			nomor_order: successData.nomor_order,
			tanggal: new Date().toISOString(),
			items: selectedItems.map(item => ({
				nama: item.nama,
				qty: item.qty,
				satuan: item.satuan,
				harga: item.harga,
				subtotal: item.harga * item.qty
			})),
			subtotal,
			diskon,
			total,
			metode_bayar: metodeBayar,
			status_bayar: waktuBayar === 'awal' && nominalBayar >= total ? 'lunas' : 'belum_lunas',
			customer_nama: selectedCustomer?.nama ?? newNama,
			customer_hp: selectedCustomer?.nomor_hp ?? newHp
		};
		showInvoice = true;
	}

	async function printInvoice() {
		if (!successData) return;
		captureReceipt();
		// Wait for DOM render
		await new Promise(r => setTimeout(r, 200));
		invoiceLoading = true;
		try {
			await generateInvoicePDF('invoice-print', successData.nomor_order);
		} catch (e) {
			console.error('PDF generation failed:', e);
		} finally {
			invoiceLoading = false;
		}
	}

	// ── Keyboard Shortcuts ──
	function handleKeydown(e: KeyboardEvent) {
		// Escape: clear selection
		if (e.key === 'Escape') {
			if (selectedCustomer) { clearCustomer(); return; }
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Kasir — LaundryIn</title>
</svelte:head>

<div class="flex h-[calc(100vh-0px)] bg-gray-50 relative">
	<!-- ═══ LEFT PANEL: Input ═══ -->
	<div class="flex-1 overflow-y-auto p-4 lg:p-5 space-y-4 pb-20 lg:pb-5">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold text-gray-800">🧺 Kasir (POS)</h1>
			{#if selectedItems.length > 0}
				<span class="text-sm text-gray-400">{selectedItems.length} item</span>
			{/if}
		</div>

		<!-- Toast Success -->
		{#if showSuccess && successData}
			<div class="rounded-xl bg-green-50 border border-green-200 p-5 animate-[slideDown_0.3s_ease-out]">
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<span class="text-2xl">✅</span>
						<div>
							<p class="font-bold text-green-800">Pesanan #{successData.nomor_order} berhasil!</p>
							<p class="text-sm text-green-600 mt-1">Total: {formatRupiah(successData.total)} • Metode: {metodeBayar.toUpperCase()}</p>
						</div>
					</div>
					<button onclick={closeSuccess} class="text-green-400 hover:text-green-600 text-lg leading-none">&times;</button>
				</div>
				<div class="flex flex-col sm:flex-row gap-2 mt-3">
					<a href={`/${$page.params.slug}/orders`} onclick={closeSuccess}
						class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition text-center">
						Lihat Pesanan →
					</a>
					<button onclick={closeSuccess}
						class="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200 transition">
						Pesanan Baru
					</button>
					<button onclick={() => showInvoice = true}
						class="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200 transition">
						🖨️ Cetak Invoice
					</button>
				</div>
			</div>
		{/if}

		<!-- Toast Error -->
		{#if submitError}
			<div class="rounded-xl bg-red-50 border border-red-200 p-4 animate-[slideDown_0.3s_ease-out]">
				<div class="flex items-center gap-3">
					<span>⚠️</span>
					<div>
						<p class="text-sm font-semibold text-red-800">Gagal menyimpan</p>
						<p class="text-sm text-red-600">{submitError}</p>
					</div>
					<button onclick={() => submitError = ''}
						class="ml-auto text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
				</div>
			</div>
		{/if}

		<!-- ── Customer ── -->
		<div class="rounded-xl border border-gray-200 bg-white p-4">
			<h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pelanggan</h2>

			{#if selectedCustomer}
				<div class="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-3">
					<div>
						<p class="text-sm font-semibold text-gray-800">{selectedCustomer.nama}</p>
						<p class="text-xs text-gray-500">{selectedCustomer.nomor_hp}</p>
					</div>
					<button onclick={clearCustomer}
						class="text-green-500 hover:text-red-500 text-sm transition">Ganti</button>
				</div>
			{:else if showNewCustomer}
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<input type="text" bind:value={newNama} placeholder="Nama pelanggan *"
							class="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
						<input type="tel" bind:value={newHp} placeholder="Nomor HP *"
							class="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
					<button onclick={() => showNewCustomer = false}
						class="text-xs text-gray-400 hover:text-gray-600">← Pilih pelanggan yang sudah ada</button>
				</div>
			{:else}
				<div class="space-y-3">
					<div class="relative">
						<input type="text" bind:value={customerSearch}
							onfocus={() => searchFocused = true}
							onblur={() => setTimeout(() => searchFocused = false, 200)}
							placeholder="Cari pelanggan (nama/nomor HP)..."
							class="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
					</div>

					{#if searchFocused && filteredCustomers.length > 0}
						<div class="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
							{#each filteredCustomers as c}
								<button type="button" onclick={() => selectCustomer(c)}
									class="w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
									<div class="text-sm font-medium text-gray-700">{c.nama}</div>
									<div class="text-xs text-gray-400">{c.nomor_hp}</div>
								</button>
							{/each}
						</div>
					{/if}

					<button onclick={() => showNewCustomer = true}
						class="w-full rounded-xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-green-300 hover:text-green-600 transition">
						+ Pelanggan Baru
					</button>

					<!-- Recent Customers -->
					{#if !searchFocused && customers.length > 0}
						<div class="flex flex-wrap gap-1.5">
							<span class="text-[10px] text-gray-300 uppercase tracking-wide w-full">Pelanggan Terakhir</span>
							{#each customers.slice(0, 5) as c}
								<button type="button" onclick={() => selectCustomer(c)}
									class="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-green-50 hover:text-green-600 transition">
									{c.nama}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ── Layanan ── -->
		<div class="rounded-xl border border-gray-200 bg-white p-4">
			<h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Layanan</h2>

			<!-- Search -->
			<div class="relative mb-3">
				<input type="text" bind:value={serviceSearch} placeholder="Cari layanan..."
					class="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
			</div>

			<!-- Category Tabs -->
			{#if categories.length > 1}
				<div class="flex gap-1.5 mb-3 overflow-x-auto pb-1">
					{#each categories as cat}
						<button type="button" onclick={() => activeCategory = cat}
							class="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition
								{activeCategory === cat ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}">
							{cat}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Service Cards -->
			{#if filteredLayanan.length === 0}
				<p class="text-sm text-gray-400 text-center py-6">Tidak ada layanan ditemukan</p>
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
					{#each filteredLayanan as l}
						{@const qty = qtyMap[l.id] ?? 0}
						<button type="button"
							onclick={() => setQty(l.id, qty + 1)}
							class="group relative flex flex-col items-center rounded-xl border-2 px-3 py-4 text-center transition-all duration-150
								{qty > 0
									? 'border-green-400 bg-green-50 shadow-sm'
									: 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'}"
						>
							<span class="text-2xl mb-1">
								{l.kategori === 'Cuci' ? '🧺' : l.kategori === 'Setrika' ? '👕' : l.kategori === 'Express' ? '⚡' : '📦'}
							</span>
							<span class="text-xs font-semibold text-gray-700 leading-tight">{l.nama}</span>
							<span class="text-xs text-gray-400 mt-0.5">
								{formatRupiah(l.harga)}/{l.satuan}
							</span>
							{#if qty > 0}
								<span class="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shadow-md animate-[pop_0.2s_ease-out]">
									{qty}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- ── Opsi ── -->
		<div class="rounded-xl border border-gray-200 bg-white p-4">
			<h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Opsi</h2>

			<div class="flex gap-2 mb-3 flex-wrap">
				<button type="button" onclick={() => jalur = 'drop_ambil'}
					class={'flex-1 min-w-[120px] rounded-lg px-3 py-2.5 text-sm font-medium transition ' +
						(jalur === 'drop_ambil' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200')}>
					📦 Drop & Ambil
				</button>
				<button type="button" onclick={() => jalur = 'drop_antar'}
					class={'flex-1 min-w-[120px] rounded-lg px-3 py-2.5 text-sm font-medium transition ' +
						(jalur === 'drop_antar' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200')}>
					📦 Drop + 🚚 Antar
				</button>
				<button type="button" onclick={() => jalur = 'jemput_ambil'}
					class={'flex-1 min-w-[120px] rounded-lg px-3 py-2.5 text-sm font-medium transition ' +
						(jalur === 'jemput_ambil' ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200')}>
					🛵 Jemput + 📦 Ambil
				</button>
				<button type="button" onclick={() => jalur = 'jemput_antar'}
					class={'flex-1 min-w-[120px] rounded-lg px-3 py-2.5 text-sm font-medium transition ' +
						(jalur === 'jemput_antar' ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200')}>
					🛵 Jemput + 🚚 Antar
				</button>
			</div>

			<textarea bind:value={catatan}
				placeholder="Catatan tambahan..."
				rows="2"
				class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500">
			</textarea>
		</div>
	</div>

	<!-- ═══ RIGHT PANEL: Cart ═══ -->
	<!-- Desktop: always visible sidebar | Mobile: overlay when toggled -->
	<div class="w-80 border-l border-gray-200 bg-white flex flex-col flex-shrink-0
		{showMobileCart
			? 'fixed inset-y-0 right-0 z-50 flex shadow-2xl'
			: 'hidden lg:flex'}">
		<!-- Cart Header -->
		<div class="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">
				Pesanan
				{#if selectedItems.length > 0}
					<span class="text-gray-300">({selectedItems.length})</span>
				{/if}
			</h2>
			<!-- Close button (mobile only) -->
			<button type="button" onclick={() => showMobileCart = false}
				class="lg:hidden text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
		</div>

		<!-- Cart Items -->
		<div class="flex-1 overflow-y-auto p-4 space-y-3">
			{#if selectedItems.length === 0}
				<div class="text-center py-12 text-gray-300">
					<span class="text-4xl block mb-2">📋</span>
					<p class="text-sm">Pilih layanan</p>
				</div>
			{:else}
				{#each selectedItems as item}
					<div class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-700 truncate">{item.nama}</p>
							<p class="text-xs text-gray-400">{formatRupiah(item.harga)}/{item.satuan}</p>
						</div>
						<div class="flex items-center gap-2 flex-shrink-0 ml-2">
							{#if item.satuan === 'kg'}
								<div class="flex items-center gap-1">
									<button type="button"
										onclick={() => updateQty(item.id, -0.5)}
										class="h-7 w-7 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-100 transition">
										&minus;
									</button>
									<input type="number" step="0.1" min="0.5" max="999"
										value={qtyMap[item.id] || 1}
										oninput={(e) => updateQty(item.id, 0, parseFloat((e.target as HTMLInputElement).value))}
										class="w-16 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
									<button type="button"
										onclick={() => updateQty(item.id, 0.5)}
										class="h-7 w-7 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-100 transition">
										+
									</button>
								</div>
							{:else}
								<button type="button"
									onclick={() => setQty(item.id, item.qty - 1)}
									class="h-7 w-7 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-100 transition">
									&minus;
								</button>
								<span class="w-6 text-center text-sm font-semibold text-gray-700">{item.qty}</span>
								<button type="button"
									onclick={() => setQty(item.id, item.qty + 1)}
									class="h-7 w-7 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-100 transition">
									+
								</button>
							{/if}
							<button type="button" onclick={() => removeItem(item.id)}
								class="h-7 w-7 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition text-xs">
								✕
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Cart Footer -->
		<div class="border-t border-gray-200 p-4 space-y-4">
			{#if selectedItems.length > 0}
			<!-- Rincian -->
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-gray-500">Subtotal</span>
					<span class="font-medium text-gray-700">{formatRupiah(subtotal)}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-gray-500">Diskon</span>
					<div class="flex items-center gap-1">
						<span class="text-xs text-gray-300">Rp</span>
						<input type="number" bind:value={diskon} min="0" max={subtotal}
							class="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
				</div>
				<div class="flex justify-between pt-2 border-t">
					<span class="font-semibold text-gray-800">Total</span>
					<span class="font-bold text-lg text-green-600">{formatRupiah(total)}</span>
				</div>
			</div>
			{/if}

			<!-- Pembayaran -->
			{#if selectedItems.length > 0}
			<div class="rounded-lg bg-gray-50 p-3 space-y-3">
					<!-- Metode -->
					<div>
						<p class="text-xs text-gray-400 mb-2">Metode Bayar</p>
						<div class="grid grid-cols-4 gap-1">
							{#each [
								{ id: 'tunai', icon: '💵', label: 'Tunai' },
								{ id: 'qris', icon: '📱', label: 'QRIS' },
								{ id: 'transfer', icon: '🏦', label: 'Transfer' },
								{ id: 'gopay', icon: '🟢', label: 'GoPay' }
							] as m}
								<button type="button" onclick={() => metodeBayar = m.id}
									class="rounded-lg px-2 py-2 text-center transition
										{metodeBayar === m.id ? 'bg-green-100 ring-1 ring-green-300' : 'bg-white hover:bg-gray-100'}">
									<span class="block text-sm">{m.icon}</span>
									<span class="block text-[10px] font-medium text-gray-500">{m.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Waktu Bayar -->
					<div class="flex gap-2">
						<button type="button" onclick={() => waktuBayar = 'awal'}
							class={'flex-1 rounded-lg py-1.5 text-xs font-medium transition ' +
								(waktuBayar === 'awal' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-400 hover:bg-gray-100')}>
							Bayar Sekarang
						</button>
						<button type="button" onclick={() => waktuBayar = 'akhir'}
							class={'flex-1 rounded-lg py-1.5 text-xs font-medium transition ' +
								(waktuBayar === 'akhir' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-400 hover:bg-gray-100')}>
							Bayar Nanti
						</button>
					</div>

					<!-- Nominal -->
					{#if waktuBayar === 'awal'}
						<div class="space-y-2">
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rp</span>
								<input type="number" bind:value={nominalBayar} min="0"
									class="w-full rounded-lg border border-gray-200 pl-10 pr-4 py-2.5 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
							</div>
							{#if nominalBayar > 0}
								<div class="flex justify-between text-sm rounded-lg bg-white p-2">
									<span class="text-gray-500">Kembalian</span>
									<span class="font-semibold {kembalian >= 0 ? 'text-green-600' : 'text-red-600'}">
										{formatRupiah(kembalian)}
									</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
				<!-- Submit -->
				<form method="POST" use:enhance={() => {
					submitting = true;
					submitError = '';
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'success') {
							const d = result.data as Record<string, unknown>;
							if (d?.success) {
								// Capture receipt before resetAll clears cart
								receiptSnapshot = {
									nomor_order: d.nomor_order as string,
									tanggal: new Date().toISOString(),
									items: selectedItems.map(item => ({
										nama: item.nama,
										qty: item.qty,
										satuan: item.satuan,
										harga: item.harga,
										subtotal: item.harga * item.qty
									})),
									subtotal,
									diskon,
									total,
									metode_bayar: metodeBayar,
									status_bayar: waktuBayar === 'awal' && nominalBayar >= total ? 'lunas' : 'belum_lunas',
									customer_nama: selectedCustomer?.nama ?? newNama,
									customer_hp: selectedCustomer?.nomor_hp ?? newHp
								};
								successData = { nomor_order: d.nomor_order as string, order_id: d.order_id as string, total: total };
								showSuccess = true;
								resetAll();
								// Auto-scroll to toast — find scrollable parent
								const panel = document.querySelector('.overflow-y-auto');
								if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
								window.scrollTo({ top: 0, behavior: 'smooth' });
							} else {
								submitError = (d?.error as string) || 'Gagal menyimpan';
							}
						} else if (result.type === 'failure') {
							submitError = (result.data as Record<string, string>)?.error || 'Gagal menyimpan';
						}
						await applyAction(result);
					};
				}}>
					<!-- Hidden fields -->
					{#if selectedCustomer}
						<input type="hidden" name="customer_id" value={selectedCustomer.id} />
					{:else}
						<input type="hidden" name="nama_customer" value={newNama} />
						<input type="hidden" name="nomor_hp" value={newHp} />
					{/if}
					{#each selectedItems as item}
						<input type="hidden" name="layanan_{item.id}" value={item.qty} />
					{/each}
					<input type="hidden" name="jalur" value={jalur} />
					<input type="hidden" name="metode_bayar" value={metodeBayar} />
					<input type="hidden" name="waktu_bayar" value={waktuBayar} />
					<input type="hidden" name="nominal_bayar" value={nominalBayar} />
					<input type="hidden" name="diskon" value={diskon} />
					<textarea name="catatan" class="hidden">{catatan}</textarea>

					<button type="submit" disabled={!canSubmit}
						class="w-full rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-200 hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
						{#if submitting}
							Menyimpan...
						{:else}
							Simpan Pesanan ({formatRupiah(total)})
						{/if}
					</button>
				</form>
			</div>
	</div>

	<!-- ═══ Backdrop overlay (mobile only) ═══ -->
	{#if showMobileCart}
		<button type="button" onclick={() => showMobileCart = false}
			class="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm cursor-default"
			aria-label="Tutup pesanan"></button>
	{/if}

	<!-- ═══ Floating Cart Button (mobile only) ═══ -->
	<button type="button" onclick={() => showMobileCart = true}
		class="lg:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-green-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-green-300 hover:bg-green-700 transition active:scale-95">
		📋 Pesanan
		{#if selectedItems.length > 0}
			<span class="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-green-600">
				{selectedItems.length}
			</span>
		{/if}
	</button>
</div>

<!-- ═══ Invoice Modal ═══ -->
{#if showInvoice && receiptSnapshot}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
		onclick={() => showInvoice = false}
		onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') showInvoice = false; }}
		role="dialog" tabindex="-1">
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto"
			onclick={(e: Event) => e.stopPropagation()}
			onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') showInvoice = false; }}
			role="document">
			<div class="p-4 border-b border-gray-200 flex items-center justify-between">
				<h2 class="text-sm font-bold text-gray-800">📄 Invoice</h2>
				<button onclick={() => showInvoice = false} class="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
			</div>
			<div class="p-4 flex justify-center">
				<InvoiceTemplate
					tenant={{ nama: $page.data.tenant?.nama_toko ?? 'LaundryIn', alamat: '', phone: '' }}
					order={{
						nomor_order: receiptSnapshot.nomor_order,
						tanggal: receiptSnapshot.tanggal,
						subtotal: receiptSnapshot.subtotal,
						diskon: receiptSnapshot.diskon,
						total: receiptSnapshot.total,
						status_bayar: receiptSnapshot.status_bayar,
						metode_bayar: receiptSnapshot.metode_bayar
					}}
					customer={{ nama: receiptSnapshot.customer_nama, phone: receiptSnapshot.customer_hp }}
					items={receiptSnapshot.items}
				/>
			</div>
			<div class="p-4 border-t border-gray-200 flex gap-2">
				<button onclick={() => printInvoice()}
					disabled={invoiceLoading}
					class="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50">
					{#if invoiceLoading}
						Membuat PDF...
					{:else}
						📥 Download PDF
					{/if}
				</button>
				<button onclick={() => showInvoice = false}
					class="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition">
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Hidden element for PDF capture -->
{#if receiptSnapshot}
	<div id="invoice-print" class="fixed left-[-9999px] top-0 z-[-1]">
		<InvoiceTemplate
			tenant={{ nama: $page.data.tenant?.nama_toko ?? 'LaundryIn', alamat: '', phone: '' }}
			order={{
				nomor_order: receiptSnapshot.nomor_order,
				tanggal: receiptSnapshot.tanggal,
				subtotal: receiptSnapshot.subtotal,
				diskon: receiptSnapshot.diskon,
				total: receiptSnapshot.total,
				status_bayar: receiptSnapshot.status_bayar,
				metode_bayar: receiptSnapshot.metode_bayar
			}}
			customer={{ nama: receiptSnapshot.customer_nama, phone: receiptSnapshot.customer_hp }}
			items={receiptSnapshot.items}
		/>
	</div>
{/if}

<style>
	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@keyframes pop {
		from { transform: scale(0.5); opacity: 0; }
		50% { transform: scale(1.2); }
		to { transform: scale(1); opacity: 1; }
	}
</style>
