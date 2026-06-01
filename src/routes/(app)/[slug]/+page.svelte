<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { formatRupiah } from '$lib/utils/format';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();
	let slug = $derived($page.params.slug);

	let stats = $derived(data.stats);
	let pendingOrders = $derived(data.pendingOrders);
	let recentCustomers = $derived(data.recentCustomers);

	let revChange = $derived(stats.yesterdayRevenue > 0
		? Math.round((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue * 100)
		: stats.todayRevenue > 0 ? 100 : 0);
	let orderChange = $derived(stats.ordersYesterday > 0
		? stats.ordersToday - stats.ordersYesterday
		: stats.ordersToday);

	function statusBadge(status: string): string {
		const s: Record<string, string> = {
			diterima: 'bg-amber-100 text-amber-700',
			menunggu_jemput: 'bg-amber-100 text-amber-700',
			dijemput_driver: 'bg-amber-100 text-amber-700',
			proses_cuci: 'bg-blue-100 text-blue-700',
			proses_kering: 'bg-blue-100 text-blue-700',
			setrika: 'bg-blue-100 text-blue-700',
			siap_diambil: 'bg-purple-100 text-purple-700',
			siap_diantar: 'bg-purple-100 text-purple-700',
			dalam_pengiriman: 'bg-teal-100 text-teal-700',
			terkirim: 'bg-teal-100 text-teal-700',
			selesai: 'bg-green-100 text-green-700'
		};
		return s[status] ?? 'bg-gray-100 text-gray-600';
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m lalu`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}j lalu`;
		const days = Math.floor(hrs / 24);
		return `${days}h lalu`;
	}
</script>

<svelte:head>
	<title>Dashboard — LaundryIn</title>
</svelte:head>

<div class="h-[calc(100vh-0px)] overflow-y-auto bg-gray-50">
	<div class="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
		<h1 class="text-xl font-bold text-gray-800">Dashboard</h1>

		<!-- KPI Cards -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
			<a href="/{slug}/orders" class="rounded-xl bg-white border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition block">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Order Hari Ini</p>
				<p class="text-2xl font-bold text-gray-800 mt-1">{stats.ordersToday}</p>
				<p class="text-xs {orderChange >= 0 ? 'text-green-600' : 'text-red-500'} mt-1">
					{orderChange >= 0 ? '+' : ''}{orderChange} dari kemarin
				</p>
			</a>
			<a href="/{slug}/reports" class="rounded-xl bg-white border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition block">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Pemasukan Hari Ini</p>
				<p class="text-2xl font-bold text-gray-800 mt-1">{formatRupiah(stats.todayRevenue)}</p>
				<p class="text-xs {revChange >= 0 ? 'text-green-600' : 'text-red-500'} mt-1">
					{revChange >= 0 ? '+' : ''}{revChange}% dari kemarin
				</p>
			</a>
			<a href="/{slug}/orders?status=diterima" class="rounded-xl bg-white border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition block">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Menunggu Diproses</p>
				<p class="text-2xl font-bold text-amber-600 mt-1">{stats.pendingCount}</p>
				<p class="text-xs text-gray-400 mt-1">Order aktif</p>
			</a>
			<a href="/{slug}/customers" class="rounded-xl bg-white border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition block">
				<p class="text-xs text-gray-400 uppercase tracking-wide">Pelanggan Baru</p>
				<p class="text-2xl font-bold text-blue-600 mt-1">{stats.newCustomersWeek}</p>
				<p class="text-xs text-gray-400 mt-1">7 hari terakhir</p>
			</a>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Order Aktif — setiap row clickable redirect ke orders -->
			<div class="rounded-xl bg-white border border-gray-200 p-4">
				<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Order Aktif</h2>
				{#if pendingOrders.length === 0}
					<p class="text-sm text-gray-400 py-6 text-center">Tidak ada order menunggu</p>
				{:else}
					<div class="space-y-1">
						{#each pendingOrders as order}
							<a href="/{slug}/orders?open={order.id}&tab=aktif" class="flex items-center justify-between rounded-lg hover:bg-gray-50 px-2 py-2 transition cursor-pointer">
								<div class="min-w-0">
									<p class="text-sm font-medium text-gray-700">#{order.nomor_order}</p>
									<p class="text-xs text-gray-400">
										{#if order.customers?.nama}{order.customers.nama}{:else}Tanpa nama{/if} &middot; {timeAgo(order.created_at)}
									</p>
								</div>
								<div class="flex items-center gap-2 flex-shrink-0 ml-2">
									<span class="text-sm font-semibold text-gray-700">{formatRupiah(order.total)}</span>
									<span class="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize {statusBadge(order.status)}">
										{order.status.replace(/_/g, ' ')}
									</span>
									<span class="text-gray-300 text-xs">→</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Pelanggan Terbaru — setiap row clickable redirect ke customers -->
			<div class="rounded-xl bg-white border border-gray-200 p-4">
				<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pelanggan Terbaru</h2>
				{#if recentCustomers.length === 0}
					<p class="text-sm text-gray-400 py-6 text-center">Belum ada pelanggan</p>
				{:else}
					<div class="space-y-1">
						{#each recentCustomers as c}
							<a href="/{slug}/customers?search={encodeURIComponent(c.nama)}" class="flex items-center gap-3 rounded-lg hover:bg-gray-50 px-2 py-2 transition cursor-pointer">
								<div class="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">
									{c.nama.charAt(0).toUpperCase()}
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-700 truncate">{c.nama}</p>
									<p class="text-xs text-gray-400">{c.nomor_hp}</p>
								</div>
								<span class="text-xs text-gray-400 flex-shrink-0">{formatRupiah(c.total_belanja)}</span>
								<span class="text-gray-300 text-xs">→</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
