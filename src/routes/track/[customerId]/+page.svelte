<script lang="ts">
	import type { PageData } from './$types';
	import { formatRupiah, formatTanggal } from '$lib/utils/format';

	let { data }: { data: PageData } = $props();

	// Filter state
	let filter = $state<'all' | 'lunas' | 'belum_lunas'>('all');

	let filteredOrders = $derived(
		filter === 'all'
			? data.orders
			: data.orders.filter(o => o.status_bayar === filter)
	);
</script>

<svelte:head>
	<title>{data.customer ? `${data.customer.nama} — Lacak Pesanan` : 'Pesanan Tidak Ditemukan'} — LaundryIn</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if !data.customer}
		<div class="max-w-md mx-auto p-6 pt-20 text-center">
			<div class="text-4xl mb-4">🔍</div>
			<h1 class="text-xl font-bold text-gray-800 mb-2">Pesanan Tidak Ditemukan</h1>
			<p class="text-sm text-gray-500">Link ini tidak valid atau pelanggan tidak ditemukan.</p>
		</div>
	{:else}
		<div class="max-w-md mx-auto p-4 space-y-4">
			<!-- Header -->
			<div class="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
				<div class="flex items-center gap-3 mb-1">
					<div class="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-lg font-bold">
						{data.customer.nama.charAt(0).toUpperCase()}
					</div>
					<div>
						<h1 class="text-lg font-bold text-gray-800">{data.customer.nama}</h1>
						<p class="text-sm text-gray-500">{data.customer.nomor_hp}</p>
					</div>
				</div>
				<p class="text-xs text-gray-400 mt-3">Total {data.orders.length} pesanan di LaundryIn</p>
			</div>

			<!-- Filter Tabs -->
			<div class="flex gap-1 bg-gray-100 rounded-xl p-1">
				{#each [{ id: 'all', label: 'Semua' }, { id: 'lunas', label: '✅ Lunas' }, { id: 'belum_lunas', label: '⏳ Belum Lunas' }] as tab}
					<button onclick={() => filter = tab.id}
						class="flex-1 rounded-lg py-2.5 text-sm font-medium transition {filter === tab.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- Orders -->
			{#if filteredOrders.length === 0}
				<div class="rounded-2xl bg-white border border-gray-200 p-8 text-center">
					<p class="text-gray-400 text-sm">
						{#if filter === 'lunas'}Belum ada pesanan yang lunas{/if}
						{#if filter === 'belum_lunas'}Semua pesanan sudah lunas 🎉{/if}
						{#if filter === 'all'}Belum ada pesanan{/if}
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each filteredOrders as order}
						<div class="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
							<div class="flex items-start justify-between mb-2">
								<div>
									<p class="text-sm font-semibold text-gray-800">{order.nomor_order}</p>
									<p class="text-xs text-gray-400">{formatTanggal(order.tanggal)}</p>
								</div>
								<span class="rounded-full px-3 py-1 text-xs font-semibold {order.status_bayar === 'lunas' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">
									{order.status_bayar === 'lunas' ? 'Lunas' : 'Belum Lunas'}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<div>
									<p class="text-xs text-gray-500">{order.tenant_nama}</p>
									<p class="text-[10px] text-gray-400 capitalize">{order.status.replace(/_/g, ' ')}</p>
								</div>
								<p class="text-lg font-bold text-gray-800">{formatRupiah(order.total)}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Footer -->
			<div class="text-center pt-4 pb-8">
				<p class="text-xs text-gray-400">Powered by <span class="font-medium text-green-600">LaundryIn</span></p>
			</div>
		</div>
	{/if}
</div>
