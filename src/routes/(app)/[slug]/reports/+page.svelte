<script lang="ts">
	import type { PageData } from './$types';
	import { formatRupiah } from '$lib/utils/format';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let summary = $derived(data.summary);
	let ordersByStatus = $derived(data.ordersByStatus);
	let revenueByMethod = $derived(data.revenueByMethod);
	let topServices = $derived(data.topServices);
	let topCustomers = $derived(data.topCustomers);
	let period = $derived(data.period || 'month');
	let offset = $derived(data.offset || 0);
	let dateFrom = $derived(data.dateFrom || '');
	let dateTo = $derived(data.dateTo || '');

	// ── Presets ──
	const presets = [
		{ id: 'today', label: 'Hari Ini' },
		{ id: 'yesterday', label: 'Kemarin', offset: -1 },
		{ id: 'week', label: 'Minggu Ini' },
		{ id: 'month', label: 'Bulan Ini' },
		{ id: 'last_month', label: 'Bulan Lalu', offset: -1 },
		{ id: 'year', label: 'Tahun Ini' },
		{ id: 'custom', label: 'Custom' },
	];

	let activePreset = $state(period === 'yesterday' ? 'yesterday' : period === 'last_month' ? 'last_month' : dateFrom ? 'custom' : period);
	let showCustom = $state(activePreset === 'custom');
	let customFrom = $state(dateFrom || '');
	let customTo = $state(dateTo || '');
	let pdfLoading = $state(false);

	// ── Navigation ──
	function navigate(preset: string, offs = 0, df = '', dt = '') {
		const url = new URL($page.url);
		url.searchParams.set('period', preset);
		if (offs !== 0) url.searchParams.set('offset', String(offs));
		else url.searchParams.delete('offset');
		if (df) {
			url.searchParams.set('date_from', df);
			url.searchParams.set('date_to', dt);
		} else {
			url.searchParams.delete('date_from');
			url.searchParams.delete('date_to');
		}
		goto(url.toString(), { replaceState: true });
	}

	function selectPreset(preset: string) {
		activePreset = preset;
		if (preset === 'custom') {
			showCustom = true;
			return;
		}
		showCustom = false;
		const p = presets.find(x => x.id === preset);
		const offs = (p as any)?.offset ?? 0;
		navigate(preset === 'yesterday' ? 'today' : preset === 'last_month' ? 'month' : preset, preset === 'yesterday' ? -1 : preset === 'last_month' ? -1 : offs);
	}

	function applyCustom() {
		if (!customFrom || !customTo) return;
		navigate('custom', 0, customFrom, customTo);
	}

	function shift(dir: number) {
		const newOffset = offset + dir;
		navigate(period === 'yesterday' ? 'today' : period === 'last_month' ? 'month' : period, newOffset);
	}

	function shortcutDays(days: number) {
		const end = new Date();
		const start = new Date();
		start.setDate(end.getDate() - days + 1);
		customFrom = start.toISOString().slice(0, 10);
		customTo = end.toISOString().slice(0, 10);
		applyCustom();
	}

	// ── Helpers ──
	function statusLabel(status: string): string { return status.replace(/_/g, ' '); }
	function statusColor(status: string): string {
		const colors: Record<string, string> = {
			diterima: 'bg-amber-400', menunggu_jemput: 'bg-amber-400', dijemput_driver: 'bg-amber-400',
			proses_cuci: 'bg-blue-400', proses_kering: 'bg-blue-400', setrika: 'bg-blue-400',
			siap_diambil: 'bg-purple-400', siap_diantar: 'bg-purple-400',
			dalam_pengiriman: 'bg-teal-400', terkirim: 'bg-teal-400', selesai: 'bg-green-400'
		};
		return colors[status] ?? 'bg-gray-300';
	}
	function metodeIcon(metode: string): string {
		const icons: Record<string, string> = { tunai: '💵', transfer: '🏦', gopay: '🟢', ovo: '🟣', dana: '🔵', shopeepay: '🟠', qris: '📱' };
		return icons[metode] ?? '💰';
	}
	function metodeLabel(metode: string): string {
		const labels: Record<string, string> = { tunai: 'Tunai', transfer: 'Transfer', gopay: 'GoPay', ovo: 'OVO', dana: 'DANA', shopeepay: 'ShopeePay', qris: 'QRIS' };
		return labels[metode] ?? metode;
	}
	function deltaText(v: number): string { return v === 0 ? '—' : v > 0 ? `↑ ${v}%` : `↓ ${Math.abs(v)}%`; }
	function deltaColor(v: number): string { return v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-gray-400'; }

	let maxStatusCount = $derived(ordersByStatus.length > 0 ? Math.max(...ordersByStatus.map((s: any) => s.count)) : 1);

	// ── PDF Export ──
	async function exportPdf() {
		pdfLoading = true;
		try {
			const { default: html2canvas } = await import('html2canvas');
			const { default: jsPDF } = await import('jspdf');
			const el = document.getElementById('report-content');
			if (!el) return;
			const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' });
			const imgData = canvas.toDataURL('image/png');
			const pdf = new jsPDF('p', 'mm', 'a4');
			const w = pdf.internal.pageSize.getWidth();
			const h = (canvas.height * w) / canvas.width;
			pdf.addImage(imgData, 'PNG', 0, 0, w, h, undefined, 'FAST');
			pdf.save(`Laporan-${summary.periodLabel.replace(/[,\s]+/g, '-')}.pdf`);
		} catch (e) {
			console.error('PDF export failed:', e);
			alert('Gagal export PDF. Coba lagi.');
		} finally {
			pdfLoading = false;
		}
	}

	let mounted = $state(false);
	onMount(() => { mounted = true; });
</script>

<svelte:head><title>📊 Laporan — LaundryIn</title></svelte:head>

<div class="h-[calc(100vh-0px)] overflow-y-auto bg-gray-50">
	<div class="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">

		<!-- ── Header ── -->
		<div class="flex items-center justify-between flex-wrap gap-3">
			<div class="flex items-center gap-3 min-w-0">
				<button onclick={() => shift(-1)} class="shrink-0 w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition" title="Mundur">←</button>
				<div class="min-w-0">
					<h1 class="text-lg font-bold text-gray-800 truncate">📊 Laporan</h1>
					<p class="text-xs text-gray-500 truncate">{summary.periodLabel}</p>
				</div>
				<button onclick={() => shift(1)} class="shrink-0 w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 transition" title="Maju">→</button>
			</div>
			<button
				onclick={exportPdf}
				disabled={pdfLoading}
				class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
			>
				{pdfLoading ? '⏳ Mengekspor...' : '📄 Export PDF'}
			</button>
		</div>

		<!-- ── Preset Chips ── -->
		<div class="flex items-center gap-1.5 overflow-x-auto pb-1">
			{#each presets as p}
				<button
					onclick={() => selectPreset(p.id)}
					class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition {activePreset === p.id ? 'bg-green-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}"
				>{p.label}</button>
			{/each}
		</div>

		<!-- ── Custom Date Picker ── -->
		{#if showCustom}
			<div class="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-gray-200 p-4">
				<div class="flex flex-col gap-1">
					<label class="text-xs text-gray-400">Dari</label>
					<input type="date" bind:value={customFrom} class="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" />
				</div>
				<div class="flex flex-col gap-1">
					<label class="text-xs text-gray-400">Sampai</label>
					<input type="date" bind:value={customTo} class="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" />
				</div>
				<button onclick={applyCustom} class="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition">Terapkan</button>
				<div class="flex items-center gap-1.5 ml-auto">
					{#each [{ days: 7, label: '7H' }, { days: 30, label: '30H' }, { days: 90, label: '90H' }, { days: 365, label: '1T' }] as s}
						<button onclick={() => shortcutDays(s.days)} class="px-2.5 py-1 rounded-md border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">{s.label}</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ── Summary Cards ── -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<div class="rounded-xl bg-white border border-gray-200 p-4">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Pemasukan</p>
				<p class="text-xl font-bold text-gray-800 mt-1">{formatRupiah(summary.revenue)}</p>
				{#if summary.revenueDelta !== 0}
					<p class="text-xs {deltaColor(summary.revenueDelta)} mt-0.5">{deltaText(summary.revenueDelta)} vs periode sebelumnya</p>
				{/if}
			</div>
			<div class="rounded-xl bg-white border border-gray-200 p-4">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Order</p>
				<p class="text-xl font-bold text-gray-800 mt-1">{summary.orderCount}</p>
				{#if summary.orderDelta !== 0}
					<p class="text-xs {deltaColor(summary.orderDelta)} mt-0.5">{deltaText(summary.orderDelta)} vs periode sebelumnya</p>
				{/if}
			</div>
			<div class="rounded-xl bg-white border {summary.piutang > 0 ? 'border-red-200' : 'border-gray-200'} p-4">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Piutang</p>
				<p class="text-xl font-bold {summary.piutang > 0 ? 'text-red-600' : 'text-gray-400'} mt-1">{formatRupiah(summary.piutang)}</p>
				<p class="text-xs text-gray-400 mt-0.5">Belum dibayar</p>
			</div>
			<div class="rounded-xl bg-white border border-gray-200 p-4">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Rata-rata</p>
				<p class="text-xl font-bold text-gray-800 mt-1">{summary.orderCount > 0 ? formatRupiah(Math.round(summary.revenue / summary.orderCount)) : 'Rp0'}</p>
				<p class="text-xs text-gray-400 mt-0.5">per order</p>
			</div>
		</div>

		<!-- ── PDF Content Area ── -->
		<div id="report-content" class="space-y-6">
			<!-- ═══ Two-column layout ═══ -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Order by Status -->
				<div class="rounded-xl bg-white border border-gray-200 p-5">
					<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Order per Status</h2>
					{#if ordersByStatus.length === 0}
						<p class="text-sm text-gray-400 py-8 text-center">Belum ada data order</p>
					{:else}
						<div class="space-y-3">
							{#each ordersByStatus as item}
								<div class="flex items-center gap-3">
									<span class="w-28 text-xs text-gray-600 capitalize shrink-0 truncate">{statusLabel(item.status)}</span>
									<div class="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
										<div class="h-full {statusColor(item.status)} rounded-full transition-all duration-500 flex items-center justify-end pr-2" style="width: {Math.max((item.count / maxStatusCount) * 100, 4)}%">
											{#if (item.count / maxStatusCount) * 100 > 15}
												<span class="text-xs text-white font-semibold">{item.count}</span>
											{/if}
										</div>
									</div>
									{#if (item.count / maxStatusCount) * 100 <= 15}
										<span class="text-xs font-semibold text-gray-600 w-6 shrink-0">{item.count}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Revenue by Payment Method -->
				<div class="rounded-xl bg-white border border-gray-200 p-5">
					<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Pemasukan per Metode Bayar</h2>
					{#if revenueByMethod.length === 0}
						<p class="text-sm text-gray-400 py-8 text-center">Belum ada data pembayaran</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead><tr class="border-b border-gray-100 text-left"><th class="pb-2 text-xs text-gray-400 uppercase font-medium">Metode</th><th class="pb-2 text-xs text-gray-400 uppercase font-medium text-right">Total</th></tr></thead>
								<tbody>
									{#each revenueByMethod as row}
										<tr class="border-b border-gray-50">
											<td class="py-2 text-gray-700"><span class="mr-2">{metodeIcon(row.metode)}</span>{metodeLabel(row.metode)}</td>
											<td class="py-2 text-right font-semibold text-gray-800">{formatRupiah(row.total)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<!-- Top 10 Services -->
				<div class="rounded-xl bg-white border border-gray-200 p-5">
					<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Top 10 Layanan</h2>
					{#if topServices.length === 0}
						<p class="text-sm text-gray-400 py-8 text-center">Belum ada data layanan</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead><tr class="border-b border-gray-100 text-left"><th class="pb-2 text-xs text-gray-400 uppercase font-medium">#</th><th class="pb-2 text-xs text-gray-400 uppercase font-medium">Layanan</th><th class="pb-2 text-xs text-gray-400 uppercase font-medium text-right">Total</th></tr></thead>
								<tbody>
									{#each topServices as row, i}
										<tr class="border-b border-gray-50">
											<td class="py-2 text-gray-400 text-xs w-8">{i + 1}</td>
											<td class="py-2 text-gray-700 capitalize">{row.nama_layanan}</td>
											<td class="py-2 text-right font-semibold text-gray-800">{formatRupiah(row.total)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<!-- Top 10 Customers -->
				<div class="rounded-xl bg-white border border-gray-200 p-5">
					<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Top 10 Pelanggan</h2>
					{#if topCustomers.length === 0}
						<p class="text-sm text-gray-400 py-8 text-center">Belum ada pelanggan</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead><tr class="border-b border-gray-100 text-left"><th class="pb-2 text-xs text-gray-400 uppercase font-medium">#</th><th class="pb-2 text-xs text-gray-400 uppercase font-medium">Nama</th><th class="pb-2 text-xs text-gray-400 uppercase font-medium text-right">Total Belanja</th></tr></thead>
								<tbody>
									{#each topCustomers as c, i}
										<tr class="border-b border-gray-50">
											<td class="py-2 text-gray-400 text-xs w-8">{i + 1}</td>
											<td class="py-2">
												<div class="flex items-center gap-2">
													<div class="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs shrink-0">{c.nama.charAt(0).toUpperCase()}</div>
													<div class="min-w-0"><p class="text-gray-700 font-medium truncate">{c.nama}</p><p class="text-xs text-gray-400">{c.nomor_hp}</p></div>
												</div>
											</td>
											<td class="py-2 text-right font-semibold text-green-600">{formatRupiah(c.total_belanja)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
