<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { formatRupiah } from '$lib/utils/format';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let orders = $derived(data.orders ?? []);
	let totalCount = $derived(data.totalCount ?? 0);
	let totalPages = $derived(data.totalPages ?? 1);
	let currentPage = $derived(data.page ?? 1);
	let tab = $derived(data.tab ?? 'semua');
	let driversList = $derived(data.drivers ?? []);
	let openOrder = $derived(data.openOrder ?? '');
	let deliveryMap = $derived(data.deliveryMap ?? {});

	let statusFilter = $state('');
	let searchFilter = $state('');
	let dariFilter = $state('');
	let sampaiFilter = $state('');
	let expandedId = $state<string | null>(null);

	// Auto-expand from dashboard redirect
	onMount(() => {
		if (openOrder) expandedId = openOrder;
	});

	// ── Toast ──
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let showToast = $state(false);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function triggerToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMsg = msg; toastType = type; showToast = true;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => showToast = false, 3000);
	}

	function handleResult(result: any) {
		if (result.type === 'success') {
			triggerToast((result.data as any)?.message || 'Berhasil', 'success');
		} else if (result.type === 'failure') {
			triggerToast((result.data as any)?.error || 'Gagal', 'error');
		}
		applyAction(result);
		if (result.type === 'success') invalidateAll();
	}

	// ── Tab navigation ──
	function switchTab(t: string) {
		const params = new URLSearchParams();
		if (t !== 'semua') params.set('tab', t);
		if (statusFilter) params.set('status', statusFilter);
		if (searchFilter) params.set('search', searchFilter);
		if (dariFilter) params.set('dari', dariFilter);
		if (sampaiFilter) params.set('sampai', sampaiFilter);
		const qs = params.toString();
		goto(qs ? '?' + qs : '.', { replaceState: true });
	}

	function pageUrl(p: number): string {
		const params = new URLSearchParams();
		if (p > 1) params.set('page', String(p));
		if (tab !== 'semua') params.set('tab', tab);
		if (statusFilter) params.set('status', statusFilter);
		if (searchFilter) params.set('search', searchFilter);
		if (dariFilter) params.set('dari', dariFilter);
		if (sampaiFilter) params.set('sampai', sampaiFilter);
		const qs = params.toString();
		return qs ? '?' + qs : '.';
	}

	// ── Status helpers ──
	const statusColors: Record<string, string> = {
		diterima: 'bg-amber-100 text-amber-700', menunggu_jemput: 'bg-amber-100 text-amber-700',
		dijemput_driver: 'bg-amber-200 text-amber-800', proses_cuci: 'bg-blue-100 text-blue-700',
		proses_kering: 'bg-blue-100 text-blue-700', setrika: 'bg-blue-100 text-blue-700',
		siap_diambil: 'bg-purple-100 text-purple-700', siap_diantar: 'bg-purple-100 text-purple-700',
		dalam_pengiriman: 'bg-teal-100 text-teal-700', terkirim: 'bg-teal-100 text-teal-700',
		selesai: 'bg-green-100 text-green-700', dibatalkan: 'bg-red-100 text-red-700',
		batal: 'bg-red-100 text-red-700'
	};

	function statusLabel(s: string): string { return s.replace(/_/g, ' '); }
	function isCompleted(status: string): boolean { return status === 'selesai' || status === 'dibatalkan' || status === 'batal'; }

	function nextStatus(order: any): string {
		const workflow = order.workflow || ['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'];
		const idx = workflow.indexOf(order.status);
		return idx >= 0 && idx < workflow.length - 1 ? workflow[idx + 1] : '';
	}

	function nextStatusLabel(order: any): string {
		const ns = nextStatus(order);
		return ns ? statusLabel(ns) : '';
	}

	function toggleExpand(id: string) { expandedId = expandedId === id ? null : id; }

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}
	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}

	// ── Delivery helpers ──
	const slotLabels: Record<string, string> = { pagi: 'Pagi (08:00-10:00)', siang: 'Siang (10:00-14:00)', sore: 'Sore (14:00-18:00)' };
	function slotLabel(s: string): string { return slotLabels[s] ?? s; }

	const deliveryStatusColors: Record<string, string> = {
		terjadwal: 'bg-gray-100 text-gray-600', driver_berangkat: 'bg-amber-100 text-amber-700',
		dijemput: 'bg-blue-100 text-blue-700', tiba_di_laundry: 'bg-green-100 text-green-700',
		selesai: 'bg-green-200 text-green-800'
	};

	function deliveryStatusLabel(s: string): string {
		const labels: Record<string, string> = { terjadwal: 'Terjadwal', driver_berangkat: 'Driver Berangkat', dijemput: 'Dijemput', tiba_di_laundry: 'Tiba di Laundry', selesai: 'Selesai' };
		return labels[s] ?? s.replace(/_/g, ' ');
	}

	// ── Driver assignment + inline edit state ──
	let assignDriver = $state<Record<string, string>>({});
	let confirmCancelId = $state<string | null>(null);
	let editingField = $state<{ deliveryId: string; field: string } | null>(null);
	let editValue = $state('');
	let showDateFilter = $state(false);

	function startEdit(deliveryId: string, field: string, currentValue: string) {
		editingField = { deliveryId, field };
		editValue = currentValue;
	}

	function cancelEdit() { editingField = null; editValue = ''; }

	function deliveryValue(d: any, field: string): string {
		if (field === 'tanggal') return d.tanggal ?? '';
		if (field === 'slot_waktu') return d.slot_waktu ?? 'pagi';
		if (field === 'alamat') return d.alamat ?? '';
		if (field === 'catatan') return d.catatan ?? '';
		return '';
	}

	function deliveryDisplay(d: any, field: string): string {
		if (field === 'tanggal') return d.tanggal ? formatDate(d.tanggal) : 'Hari ini';
		if (field === 'slot_waktu') return slotLabel(d.slot_waktu);
		if (field === 'alamat') return d.alamat || '—';
		if (field === 'catatan') return d.catatan || '—';
		return '';
	}

	// ── Add driver modal ──
	let showAddDriver = $state(false);
	let newDriverNama = $state('');
	let newDriverHp = $state('');
</script>

{#snippet deliveryFieldEditor(d: any, icon: string, field: string, inputType: string, options?: { key: string, label: string }[])}
	{#if editingField?.deliveryId === d.id && editingField?.field === field}
		<form method="POST" action="?/update_delivery_detail" use:enhance={() => {
			return async ({ result }: any) => { handleResult(result); if (result.type === 'success') cancelEdit(); };
		}} class="inline-flex items-center gap-1">
			<input type="hidden" name="delivery_id" value={d.id} />
			<input type="hidden" name="field" value={field} />
			{#if options}
				<select name="value" class="rounded border border-gray-300 px-2 py-0.5 text-xs bg-white focus:ring-1 focus:ring-green-300" onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') cancelEdit(); }}>
					{#each options as o}
						<option value={o.key} selected={o.key === deliveryValue(d, field)}>{o.label}</option>
					{/each}
				</select>
			{:else if inputType === 'date'}
				<input type="date" name="value" value={editValue} oninput={(e) => editValue = (e.target as HTMLInputElement).value}
					class="rounded border border-gray-300 px-2 py-0.5 text-xs bg-white focus:ring-1 focus:ring-green-300 w-32" onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') cancelEdit(); }} />
			{:else}
				<input type="text" name="value" value={editValue} oninput={(e) => editValue = (e.target as HTMLInputElement).value}
					class="rounded border border-gray-300 px-2 py-0.5 text-xs bg-white focus:ring-1 focus:ring-green-300 w-40" onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') cancelEdit(); }} />
			{/if}
			<button type="submit" class="text-green-600 hover:text-green-800 text-xs">✓</button>
			<button type="button" onclick={cancelEdit} class="text-gray-400 hover:text-gray-600 text-xs">✕</button>
		</form>
	{:else if d.status !== 'selesai'}
		<span class="group flex items-center gap-0.5 cursor-pointer" onclick={() => startEdit(d.id, field, deliveryValue(d, field))} role="button" tabindex="0" onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') startEdit(d.id, field, deliveryValue(d, field)); }}>
			<span>{icon} {deliveryDisplay(d, field)}</span>
			<span class="opacity-0 group-hover:opacity-100 text-[10px] text-gray-400 ml-0.5 transition">✏️</span>
		</span>
	{:else}
		<span>{icon} {deliveryDisplay(d, field)}</span>
	{/if}
{/snippet}

<svelte:head><title>Pesanan — LaundryIn</title></svelte:head>

<div class="h-full overflow-y-auto bg-gray-50 p-4 lg:p-6 space-y-4">
	<!-- Toast -->
	{#if showToast}
		<div class="rounded-xl {toastType === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border p-4 animate-[slideDown_0.3s_ease-out]">
			<div class="flex items-center gap-3">
				<span>{toastType === 'success' ? '✅' : '⚠️'}</span>
				<p class="text-sm font-semibold {toastType === 'success' ? 'text-green-800' : 'text-red-800'}">{toastMsg}</p>
				<button onclick={() => showToast = false} class="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
			</div>
		</div>
	{/if}

	<!-- Header + Tabs -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div>
			<h1 class="text-xl font-bold text-gray-800">📋 Manajemen Pesanan</h1>
			<p class="text-sm text-gray-400 mt-0.5">{totalCount} pesanan ditemukan</p>
		</div>
		<button onclick={() => showAddDriver = true} class="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition flex items-center gap-1.5">
			👤 + Driver
		</button>
	</div>

	<!-- Tab bar -->
	<div class="flex rounded-xl bg-white border border-gray-200 p-1 gap-1 overflow-x-auto">
		{#each [
			{ id: 'semua', label: 'Semua', icon: '📋' },
			{ id: 'aktif', label: 'Aktif', icon: '⚡' },
			{ id: 'pengantaran', label: 'Pengantaran', icon: '🚚' },
			{ id: 'selesai', label: 'Selesai', icon: '✅' }
		] as t}
			<button onclick={() => switchTab(t.id)}
				class="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition {tab === t.id ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}">
				{t.icon} {t.label}
			</button>
		{/each}
	</div>

	<!-- Add Driver Modal -->
	{#if showAddDriver}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onclick={() => showAddDriver = false} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') showAddDriver = false; }} role="dialog" tabindex="-1">
			<div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onclick={(e: Event) => e.stopPropagation()} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') showAddDriver = false; }} role="document">
				<h2 class="text-lg font-bold text-gray-800 mb-4">👤 Tambah Driver Baru</h2>
				<form method="POST" action="?/add_driver" use:enhance={() => {
					return async ({ result }: any) => {
						handleResult(result);
						if (result.type === 'success') { showAddDriver = false; newDriverNama = ''; newDriverHp = ''; }
					};
				}} class="space-y-3">
					<div>
						<label for="driver-nama" class="block text-sm font-medium text-gray-600 mb-1">Nama Driver</label>
						<input type="text" name="nama" id="driver-nama" bind:value={newDriverNama} required placeholder="Nama lengkap"
							class="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
					<div>
						<label for="driver-hp" class="block text-sm font-medium text-gray-600 mb-1">Nomor HP</label>
						<input type="text" name="nomor_hp" id="driver-hp" bind:value={newDriverHp} required placeholder="0812-xxxx-xxxx"
							class="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
					<div class="flex gap-2 pt-2">
						<button type="submit" class="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition">Simpan</button>
						<button type="button" onclick={() => showAddDriver = false} class="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 transition">Batal</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 space-y-2">
		<div class="flex flex-wrap gap-2">
			<select bind:value={statusFilter} onchange={() => switchTab(tab)}
				class="rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 w-full sm:w-auto max-w-[140px] sm:max-w-none">
				<option value="">Semua Status</option>
				{#each data.allWorkflowStatuses as s}
					<option value={s}>{statusLabel(s)}</option>
				{/each}
			</select>
			<div class="relative flex-1 min-w-[120px]">
				<input type="text" bind:value={searchFilter} placeholder="Cari order..." onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') switchTab(tab); }}
					class="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
			</div>
			<button onclick={() => showDateFilter = !showDateFilter} class="rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white text-gray-500 hover:bg-gray-100 transition" title="Filter tanggal">
				📅
			</button>
			<button onclick={() => switchTab(tab)} class="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition flex-shrink-0">Filter</button>
		</div>
		{#if showDateFilter}
			<div class="flex items-center gap-2 animate-[slideDown_0.2s_ease-out]">
				<input type="date" bind:value={dariFilter}
					class="rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
				<span class="text-gray-300 text-sm">–</span>
				<input type="date" bind:value={sampaiFilter}
					class="rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
			</div>
		{/if}
	</div>

	<!-- Order List -->
	<div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
		{#if orders.length === 0}
			<div class="text-center py-16 text-gray-400">
				<span class="text-4xl block mb-3">📭</span>
				<p class="text-sm">Belum ada pesanan</p>
			</div>
		{:else}
			<div class="hidden md:grid grid-cols-[2fr_2fr_1fr_2fr_1fr_1fr] gap-2 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
				<div>No. Order</div>
				<div>Pelanggan</div>
				<div>Total</div>
				<div>Status</div>
				<div>Bayar</div>
				<div>Waktu</div>
			</div>

			<div class="divide-y divide-gray-100">
				{#each orders as order (order.id)}
					{@const delivery = deliveryMap[order.id] ?? null}
					<div class="cursor-pointer hover:bg-gray-50/50 transition-colors"
						onclick={() => toggleExpand(order.id)} role="button" tabindex="0"
						onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') toggleExpand(order.id); }}>
						<div class="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_2fr_1fr_1fr] gap-2 px-5 py-4 items-center">
							<!-- Mobile -->
							<div class="md:col-span-full md:hidden space-y-1.5">
								<div class="flex items-center justify-between">
									<p class="text-sm font-semibold text-gray-800">#{order.nomor_order}</p>
									<div class="flex items-center gap-1.5">
										{#if order.status_bayar === 'lunas'}
											<span class="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700">Lunas</span>
										{:else if order.status === 'selesai'}
											<span class="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 animate-pulse">Blm Lunas</span>
										{/if}
										<span class="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize {statusColors[order.status] ?? 'bg-gray-100 text-gray-600'}">{statusLabel(order.status)}</span>
									</div>
								</div>
								<div class="flex items-center justify-between">
									<div>
										<p class="text-xs text-gray-500">{order.customers?.nama ?? '—'}</p>
										<p class="text-xs text-gray-400">{formatTime(order.created_at)}</p>
									</div>
									<span class="text-sm font-bold text-green-600">{formatRupiah(order.total ?? 0)}</span>
								</div>
								{#if delivery?.jemput || delivery?.antar}
									<div class="flex items-center gap-1.5 text-[11px]">
										{#if delivery.jemput}
											<span class="rounded-full px-2 py-0.5 {delivery.jemput.driver ? (delivery.jemput.status === 'selesai' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') : 'bg-gray-100 text-gray-500'}">🛵 Jemput</span>
										{/if}
										{#if delivery.antar}
											<span class="rounded-full px-2 py-0.5 {delivery.antar.driver ? (delivery.antar.status === 'selesai' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') : 'bg-gray-100 text-gray-500'}">🚚 Antar</span>
										{/if}
									</div>
								{/if}
							</div>
							<!-- Desktop -->
							<div class="hidden md:block"><p class="text-sm font-semibold text-gray-800">#{order.nomor_order}</p></div>
							<div class="hidden md:block">
								<p class="text-sm text-gray-700 truncate">{order.customers?.nama ?? '—'}</p>
								{#if order.customers?.nomor_hp}<p class="text-xs text-gray-400">{order.customers.nomor_hp}</p>{/if}
							</div>
							<div class="hidden md:block">
								<p class="text-sm font-semibold text-gray-700">{formatRupiah(order.total ?? 0)}</p>
							</div>
							<div class="hidden md:flex items-center gap-1.5 flex-wrap">
								<span class="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize {statusColors[order.status] ?? 'bg-gray-100 text-gray-600'}">{statusLabel(order.status)}</span>
								{#if delivery?.jemput}
									<span class="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold {delivery.jemput.driver ? (delivery.jemput.status === 'selesai' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') : 'bg-gray-100 text-gray-500'}" title="Jemput: {delivery.jemput.driver?.nama ?? 'belum ditugaskan'}">🛵</span>
								{/if}
								{#if delivery?.antar}
									<span class="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold {delivery.antar.driver ? (delivery.antar.status === 'selesai' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') : 'bg-gray-100 text-gray-500'}" title="Antar: {delivery.antar.driver?.nama ?? 'belum ditugaskan'}">🚚</span>
								{/if}
								{#if !delivery?.jemput && !delivery?.antar}
									<span class="text-gray-300 text-[10px]">—</span>
								{/if}
							</div>
							<div class="hidden md:block">
								{#if order.status_bayar === 'lunas'}
									<span class="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold bg-green-100 text-green-700">✅ Lunas</span>
								{:else}
									<span class="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold {order.status === 'selesai' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-500'}">{order.status === 'selesai' ? '⚠️ Blm Lunas' : statusLabel(order.status_bayar || '—')}</span>
								{/if}
							</div>
							<div class="hidden md:block">
								<p class="text-xs text-gray-500">{formatDate(order.created_at)}</p>
								<p class="text-xs text-gray-400">{formatTime(order.created_at)}</p>
							</div>
						</div>

						<!-- Expanded Detail -->
						{#if expandedId === order.id}
							<div class="px-5 pb-5 pt-2 bg-blue-50/50 border-t-2 border-blue-200 border-dashed space-y-4" onclick={(e: Event) => e.stopPropagation()} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') expandedId = null; }} role="region" aria-label="Detail pesanan">

								<!-- ═══ DELIVERY CARDS ═══ -->
								{#if delivery && (delivery.jemput || delivery.antar)}
									<div class="space-y-2">
										<h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">🚚 Pengantaran</h4>

										{#if delivery.jemput}
											<div class="rounded-xl bg-white border {delivery.jemput.status === 'selesai' ? 'border-green-200' : delivery.jemput.driver ? 'border-amber-200' : 'border-gray-200'} p-4">
												<div class="flex items-center justify-between mb-2">
													<div class="flex items-center gap-2">
														<span class="text-lg">🛵</span>
														<span class="text-sm font-semibold text-gray-800">Jemput</span>
														<span class="rounded-full px-2 py-0.5 text-[10px] {deliveryStatusColors[delivery.jemput.status] ?? 'bg-gray-100 text-gray-600'}">{deliveryStatusLabel(delivery.jemput.status)}</span>
													</div>
													{#if delivery.jemput.status !== 'selesai'}
														<form method="POST" action="?/update_delivery" use:enhance={handleResult} class="flex items-center gap-1.5">
															<input type="hidden" name="delivery_id" value={delivery.jemput.id} />
															<button type="submit" class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition">✓ Proses</button>
														</form>
													{/if}
												</div>
												<div class="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
													{@render deliveryFieldEditor(delivery.jemput, '📍', 'alamat', 'text')}
													{@render deliveryFieldEditor(delivery.jemput, '🕐', 'slot_waktu', 'select', [
														{ key: 'pagi', label: 'Pagi (08-10)' },
														{ key: 'siang', label: 'Siang (10-14)' },
														{ key: 'sore', label: 'Sore (14-18)' }
													])}
													{@render deliveryFieldEditor(delivery.jemput, '📅', 'tanggal', 'date')}
												</div>
												<div class="mt-2 flex items-center gap-2">
													{#if delivery.jemput.driver}
														<span class="rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-medium">👤 {delivery.jemput.driver.nama}</span>
													{:else}
														<form method="POST" action="?/assign_driver" use:enhance={handleResult} class="inline-flex items-center gap-1">
															<input type="hidden" name="delivery_id" value={delivery.jemput.id} />
															<select name="driver_id" class="rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-green-200 focus:border-green-500"
																bind:value={assignDriver[delivery.jemput.id]}
																onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLSelectElement).form?.requestSubmit(); } }}>
																<option value="">Pilih driver...</option>
																{#each driversList as d}
																	<option value={d.id}>{d.nama}</option>
																{/each}
															</select>
															<button type="submit" disabled={!assignDriver[delivery.jemput.id]}
																class="rounded-lg px-2 py-1 text-xs font-medium text-white transition {assignDriver[delivery.jemput.id] ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}">
																Tugaskan
															</button>
														</form>
													{/if}
												</div>
											</div>
										{/if}

										{#if delivery.antar}
											<div class="rounded-xl bg-white border {delivery.antar.status === 'selesai' ? 'border-green-200' : delivery.antar.driver ? 'border-amber-200' : 'border-gray-200'} p-4">
												<div class="flex items-center justify-between mb-2">
													<div class="flex items-center gap-2">
														<span class="text-lg">🚚</span>
														<span class="text-sm font-semibold text-gray-800">Antar</span>
														<span class="rounded-full px-2 py-0.5 text-[10px] {deliveryStatusColors[delivery.antar.status] ?? 'bg-gray-100 text-gray-600'}">{deliveryStatusLabel(delivery.antar.status)}</span>
													</div>
													{#if delivery.antar.status !== 'selesai'}
														<form method="POST" action="?/update_delivery" use:enhance={handleResult} class="flex items-center gap-1.5">
															<input type="hidden" name="delivery_id" value={delivery.antar.id} />
															<button type="submit" class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition">✓ Proses</button>
														</form>
													{/if}
												</div>
												<div class="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
													{@render deliveryFieldEditor(delivery.antar, '📍', 'alamat', 'text')}
													{@render deliveryFieldEditor(delivery.antar, '🕐', 'slot_waktu', 'select', [
														{ key: 'pagi', label: 'Pagi (08-10)' },
														{ key: 'siang', label: 'Siang (10-14)' },
														{ key: 'sore', label: 'Sore (14-18)' }
													])}
													{@render deliveryFieldEditor(delivery.antar, '📅', 'tanggal', 'date')}
												</div>
												<div class="mt-2 flex items-center gap-2">
													{#if delivery.antar.driver}
														<span class="rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-medium">👤 {delivery.antar.driver.nama}</span>
													{:else}
														<form method="POST" action="?/assign_driver" use:enhance={handleResult} class="inline-flex items-center gap-1">
															<input type="hidden" name="delivery_id" value={delivery.antar.id} />
															<select name="driver_id" class="rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-green-200 focus:border-green-500"
																bind:value={assignDriver[delivery.antar.id]}>
																<option value="">Pilih driver...</option>
																{#each driversList as d}
																	<option value={d.id}>{d.nama}</option>
																{/each}
															</select>
															<button type="submit" disabled={!assignDriver[delivery.antar.id]}
																class="rounded-lg px-2 py-1 text-xs font-medium text-white transition {assignDriver[delivery.antar.id] ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}">
																Tugaskan
															</button>
														</form>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								{/if}

								<!-- Order Items -->
								<div>
									<h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Item Pesanan</h4>
									<div class="space-y-0.5">
										{#if order.order_items?.length > 0}
											{#each order.order_items as item}
												<div class="flex justify-between text-sm py-1.5 px-3 rounded-lg bg-white">
													<div><span class="text-gray-700">{item.nama_layanan}</span><span class="text-gray-400 ml-1">{item.qty} {item.satuan}</span></div>
													<span class="font-medium text-gray-600">{formatRupiah(item.subtotal ?? item.harga_satuan * item.qty)}</span>
												</div>
											{/each}
										{:else}
											<p class="text-xs text-gray-400 py-1">Tidak ada data item</p>
										{/if}
									</div>
									<div class="mt-2 space-y-1 pt-2 border-t border-gray-200">
										<div class="flex justify-between text-sm px-3"><span class="text-gray-500">Subtotal</span><span class="text-gray-700">{formatRupiah(order.subtotal ?? 0)}</span></div>
										{#if order.diskon > 0}<div class="flex justify-between text-sm px-3"><span class="text-gray-500">Diskon</span><span class="text-red-500">-{formatRupiah(order.diskon)}</span></div>{/if}
										<div class="flex justify-between text-sm px-3 font-bold"><span class="text-gray-800">Total</span><span class="text-green-600">{formatRupiah(order.total ?? 0)}</span></div>
									</div>
								</div>

								<!-- Payment info -->
								<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
									<div class="rounded-lg bg-white p-2.5"><p class="text-xs text-gray-400">Bayar</p><p class="font-medium text-gray-700 text-xs">{order.status_bayar?.replace('_', ' ') ?? 'belum lunas'}</p></div>
									<div class="rounded-lg bg-white p-2.5"><p class="text-xs text-gray-400">Waktu</p><p class="font-medium text-gray-700 text-xs">{order.waktu_bayar === 'awal' ? 'Di awal' : 'Nanti'}</p></div>
									<div class="rounded-lg bg-white p-2.5"><p class="text-xs text-gray-400">Jalur</p><p class="font-medium text-gray-700 text-xs capitalize">{order.jalur?.replace('_', ' ') ?? '—'}</p></div>
									{#if order.catatan}
										<div class="rounded-lg bg-white p-2.5"><p class="text-xs text-gray-400">Catatan</p><p class="font-medium text-gray-700 text-xs truncate">{order.catatan}</p></div>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex gap-2 pt-2 flex-wrap items-end">
									{#if !isCompleted(order.status)}
										<form method="POST" action="?/update_status" use:enhance={handleResult} class="inline">
											<input type="hidden" name="order_id" value={order.id} />
											<button type="submit" class="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition">➡️ Proses ke {nextStatusLabel(order)}</button>
										</form>
									{/if}

									{#if !isCompleted(order.status) && confirmCancelId === order.id}
										<form method="POST" action="?/cancel_order" use:enhance={handleResult} class="inline-flex items-center gap-2">
											<input type="hidden" name="order_id" value={order.id} />
											<button type="submit" class="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition">⚠️ Ya, Hapus</button>
											<button type="button" onclick={() => confirmCancelId = null} class="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-300 transition">Batal</button>
										</form>
									{:else if !isCompleted(order.status)}
										<button type="button" onclick={() => confirmCancelId = order.id} class="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition">🗑️ Hapus</button>
									{/if}

									{#if isCompleted(order.status) && order.status === 'selesai'}
										<form method="POST" action="?/toggle_bayar" use:enhance={handleResult} class="inline">
											<input type="hidden" name="order_id" value={order.id} />
											<button type="submit" class="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition {order.status_bayar === 'lunas' ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}">
												{order.status_bayar === 'lunas' ? '✅ Lunas' : '⚠️ Belum Lunas'}
												<span class="text-[10px] text-gray-400">(klik ubah)</span>
											</button>
										</form>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between pt-2">
			<p class="text-sm text-gray-400">{totalCount} pesanan · Halaman {currentPage} dari {totalPages}</p>
			<div class="flex gap-2">
				{#if currentPage > 1}
					<a href={pageUrl(currentPage - 1)} class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">← Sebelumnya</a>
				{:else}
					<span class="rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-300">← Sebelumnya</span>
				{/if}
				{#if currentPage < totalPages}
					<a href={pageUrl(currentPage + 1)} class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">Selanjutnya →</a>
				{:else}
					<span class="rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-300">Selanjutnya →</span>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
</style>