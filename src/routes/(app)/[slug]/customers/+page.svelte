<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { formatRupiah } from '$lib/utils/format';

	let { data }: { data: PageData } = $props();

	let customers = $derived(data.customers ?? []);
	let formState = $derived($page.form);

	// ── Search ──
	let searchQuery = $state('');
	$effect(() => {
		searchQuery = data.search ?? '';
	});

	let filteredCustomers = $derived(
		searchQuery.trim()
			? customers.filter(
					(c) =>
						c.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
						c.nomor_hp.includes(searchQuery)
				)
			: customers
	);

	// ── Expanded customer detail (order list) ──
	let expandedCustomerId = $state<string | null>(null);

	function toggleExpand(id: string) {
		expandedCustomerId = expandedCustomerId === id ? null : id;
	}

	// ── Modal state ──
	let showModal = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let editingCustomer = $state<{
		id: string;
		nama: string;
		nomor_hp: string;
		alamat: string;
	} | null>(null);

	function openCreate() {
		modalMode = 'create';
		editingCustomer = null;
		showModal = true;
		submitError = '';
	}

	function openEdit(c: (typeof customers)[number]) {
		modalMode = 'edit';
		editingCustomer = {
			id: c.id,
			nama: c.nama,
			nomor_hp: c.nomor_hp,
			alamat: c.alamat || ''
		};
		showModal = true;
		submitError = '';
	}

	function closeModal() {
		showModal = false;
		editingCustomer = null;
	}

	// ── Delete confirmation ──
	let deleteTarget = $state<{ id: string; nama: string } | null>(null);

	function confirmDelete(c: (typeof customers)[number]) {
		deleteTarget = { id: c.id, nama: c.nama };
	}

	function cancelDelete() {
		deleteTarget = null;
	}

	// ── Feedback ──
	let submitError = $state('');
	let successMessage = $state('');
	let successTimer: ReturnType<typeof setTimeout> | null = null;

	function showSuccess(msg: string) {
		successMessage = msg;
		if (successTimer) clearTimeout(successTimer);
		successTimer = setTimeout(() => {
			successMessage = '';
		}, 3000);
	}

	function handleFormResult(result: { type: string; data?: Record<string, unknown> }) {
		if (result.type === 'success') {
			const d = result.data as Record<string, unknown>;
			showSuccess((d?.message as string) || 'Berhasil');
			closeModal();
			deleteTarget = null;
		} else if (result.type === 'failure') {
			submitError = ((result.data as Record<string, string>)?.error) || 'Gagal';
		}
	}

	// ── Search with debounce ──
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	function onSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		searchQuery = value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			// Update URL search param
			const url = new URL(window.location.href);
			if (value.trim()) {
				url.searchParams.set('search', value.trim());
			} else {
				url.searchParams.delete('search');
			}
			window.history.replaceState({}, '', url.toString());
		}, 400);
	}

	// ── Format date ──
	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	// ── Status badge color ──
	function statusColor(status: string): string {
		switch (status) {
			case 'selesai':
				return 'bg-green-100 text-green-600';
			case 'batal':
				return 'bg-red-100 text-red-600';
			case 'proses':
			case 'proses_cuci':
			case 'proses_kering':
			case 'setrika':
				return 'bg-blue-100 text-blue-600';
			default:
				return 'bg-amber-100 text-amber-600';
		}
	}
</script>

<svelte:head>
	<title>Pelanggan — LaundryIn</title>
</svelte:head>

<div class="h-[calc(100vh-0px)] overflow-y-auto bg-gray-50">
	<div class="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
		<!-- ═══ Header ═══ -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-bold text-gray-800">👥 Pelanggan</h1>
				<p class="text-sm text-gray-400 mt-0.5">
					{filteredCustomers.length} pelanggan
					{#if searchQuery.trim()}
						ditemukan
					{/if}
				</p>
			</div>
			<button
				onclick={openCreate}
				class="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-200 hover:bg-green-700 transition active:scale-95"
			>
				+ Tambah Pelanggan
			</button>
		</div>

		<!-- ═══ Success Toast ═══ -->
		{#if successMessage}
			<div
				class="rounded-xl bg-green-50 border border-green-200 p-4 animate-[slideDown_0.3s_ease-out] flex items-center gap-3"
			>
				<span class="text-lg">✅</span>
				<p class="text-sm font-medium text-green-700">{successMessage}</p>
			</div>
		{/if}

		<!-- ═══ Error Toast ═══ -->
		{#if submitError}
			<div
				class="rounded-xl bg-red-50 border border-red-200 p-4 animate-[slideDown_0.3s_ease-out] flex items-center gap-3"
			>
				<span class="text-lg">⚠️</span>
				<p class="text-sm font-medium text-red-700">{submitError}</p>
				<button
					onclick={() => (submitError = '')}
					class="ml-auto text-red-400 hover:text-red-600 text-lg leading-none"
				>
					&times;
				</button>
			</div>
		{/if}

		<!-- ═══ Search Bar ═══ -->
		<div class="relative">
			<input
				type="text"
				value={searchQuery}
				oninput={onSearchInput}
				placeholder="Cari pelanggan (nama atau nomor HP)..."
				class="w-full rounded-xl border border-gray-300 pl-11 pr-4 py-3 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
			/>
			<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
			{#if searchQuery}
				<button
					onclick={() => {
						searchQuery = '';
						const url = new URL(window.location.href);
						url.searchParams.delete('search');
						window.location.href = url.toString();
					}}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm"
				>
					✕
				</button>
			{/if}
		</div>

		<!-- ═══ Delete Confirmation ═══ -->
		{#if deleteTarget}
			<div class="rounded-xl border border-red-200 bg-red-50 p-4 animate-[slideDown_0.3s_ease-out]">
				<div class="flex items-start gap-3">
					<span class="text-xl">🗑️</span>
					<div class="flex-1">
						<p class="text-sm font-semibold text-red-700">Hapus Pelanggan?</p>
						<p class="text-sm text-red-600 mt-1">
							Yakin ingin menghapus <strong>{deleteTarget.nama}</strong>? Pelanggan dengan
							pesanan tidak dapat dihapus.
						</p>
						<form
							method="POST"
							action="?/delete"
							use:enhance={() => {
								submitError = '';
								return async ({ result }) => {
									handleFormResult(result);
									await applyAction(result);
								};
							}}
							class="flex gap-2 mt-3"
						>
							<input type="hidden" name="id" value={deleteTarget.id} />
							<button
								type="submit"
								class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
							>
								Ya, Hapus
							</button>
							<button
								type="button"
								onclick={cancelDelete}
								class="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
							>
								Batal
							</button>
						</form>
					</div>
				</div>
			</div>
		{/if}

		<!-- ═══ Customer List ═══ -->
		{#if filteredCustomers.length === 0}
			<div class="rounded-xl border border-gray-200 bg-white p-12 text-center">
				<span class="text-4xl block mb-3">👥</span>
				<p class="text-gray-400 font-medium">
					{#if searchQuery.trim()}
						Tidak ada pelanggan ditemukan
					{:else}
						Belum ada pelanggan. Tambahkan pelanggan pertama!
					{/if}
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each filteredCustomers as c (c.id)}
					<div class="rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-sm">
						<!-- Customer Row -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							tabindex="0"
							role="button"
							onclick={() => toggleExpand(c.id)}
							onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(c.id); } }}
							class="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 transition cursor-pointer"
						>
							<!-- Avatar placeholder -->
							<div
								class="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm"
							>
								{c.nama.charAt(0).toUpperCase()}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<p class="text-sm font-semibold text-gray-800 truncate">{c.nama}</p>
								<div class="flex items-center gap-2 mt-0.5">
									<span class="text-xs text-gray-400">{c.nomor_hp}</span>
									{#if c.alamat}
										<span class="text-xs text-gray-300">•</span>
										<span class="text-xs text-gray-400 truncate max-w-[120px] lg:max-w-[200px]"
											>{c.alamat}</span
										>
									{/if}
								</div>
							</div>

							<!-- Stats -->
							<div class="flex-shrink-0 text-right hidden sm:block">
								<p class="text-xs text-gray-400">
									{c.order_count} transaksi
								</p>
								<p class="text-sm font-semibold text-gray-700">
									{formatRupiah(c.total_belanja ?? 0)}
								</p>
							</div>

							<!-- Actions -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="flex-shrink-0 flex items-center gap-1" onkeydown={(e: KeyboardEvent) => {}} onclick={(e: Event) => e.stopPropagation()}>
								<button
									onclick={() => window.open(`/track/${c.id}`, '_blank')}
									class="rounded-lg p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 transition"
									title="Tracking Dashboard Pelanggan"
								>
									<span class="text-sm">🔍</span>
								</button>
								<button
									onclick={() => openEdit(c)}
									class="rounded-lg p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
									title="Edit"
								>
									<span class="text-sm">✏️</span>
								</button>
								<button
									onclick={() => confirmDelete(c)}
									class="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
									title="Hapus"
								>
									<span class="text-sm">🗑️</span>
								</button>
							</div>

							<!-- Expand indicator -->
							<span class="text-gray-300 text-xs transition-transform duration-200 {expandedCustomerId === c.id ? 'rotate-90' : ''}">
								▶
							</span>
						</div>

						<!-- Expanded: Order details -->
						{#if expandedCustomerId === c.id}
							<div class="border-t border-gray-100 bg-gray-50/50 px-4 py-3 animate-[slideDown_0.2s_ease-out]">
								{#if c.orders && c.orders.length > 0}
									<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
										Riwayat Pesanan ({c.orders.length})
									</p>
									<div class="space-y-1.5 max-h-64 overflow-y-auto">
										{#each c.orders.slice(0, 20) as order}
											<div
												class="flex items-center justify-between rounded-lg bg-white border border-gray-100 px-3 py-2.5 text-sm"
											>
												<div class="min-w-0 flex-1">
													<p class="text-sm font-medium text-gray-700">
														#{order.nomor_order}
													</p>
													<p class="text-xs text-gray-400 mt-0.5">
														{formatDate(order.created_at)}
													</p>
												</div>
												<div class="flex items-center gap-3 flex-shrink-0 ml-3">
													<span class="text-sm font-semibold text-gray-700">
														{formatRupiah(order.total ?? 0)}
													</span>
													<span
														class="rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize {statusColor(order.status)}"
													>
														{order.status.replace(/_/g, ' ')}
													</span>
												</div>
											</div>
										{/each}
										{#if c.orders.length > 20}
											<p class="text-xs text-gray-400 text-center py-2">
												+ {c.orders.length - 20} pesanan lainnya
											</p>
										{/if}
									</div>
								{:else}
									<p class="text-sm text-gray-400 text-center py-4">
										Belum ada pesanan
									</p>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- ═══ Modal: Create / Edit Customer ═══ -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button
			onclick={closeModal}
			class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-default"
			aria-label="Tutup"
		></button>

		<!-- Modal Content -->
		<div
			class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-6 animate-[slideDown_0.25s_ease-out]"
		>
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-bold text-gray-800">
					{modalMode === 'create' ? 'Tambah Pelanggan' : 'Edit Pelanggan'}
				</h2>
				<button
					onclick={closeModal}
					class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
				>
					&times;
				</button>
			</div>

			<form
				method="POST"
				action={modalMode === 'create' ? '?/create' : '?/update'}
				use:enhance={() => {
					submitError = '';
					return async ({ result }) => {
						handleFormResult(result);
						await applyAction(result);
					};
				}}
				class="space-y-4"
			>
				{#if modalMode === 'edit' && editingCustomer}
					<input type="hidden" name="id" value={editingCustomer.id} />
				{/if}

				<div>
					<label for="nama" class="block text-sm font-medium text-gray-600 mb-1.5">
						Nama <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						id="nama"
						name="nama"
						required
						value={editingCustomer?.nama ?? ''}
						placeholder="Nama pelanggan"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
					/>
				</div>

				<div>
					<label
						for="nomor_hp"
						class="block text-sm font-medium text-gray-600 mb-1.5"
					>
						Nomor HP <span class="text-red-400">*</span>
					</label>
					<input
						type="tel"
						id="nomor_hp"
						name="nomor_hp"
						required
						value={editingCustomer?.nomor_hp ?? ''}
						placeholder="0812-3456-7890"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
					/>
				</div>

				<div>
					<label for="alamat" class="block text-sm font-medium text-gray-600 mb-1.5">
						Alamat <span class="text-gray-400 text-xs">(opsional)</span>
					</label>
					<textarea
						id="alamat"
						name="alamat"
						rows="2"
						value={editingCustomer?.alamat ?? ''}
						placeholder="Alamat pelanggan..."
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 resize-none"
					></textarea>
				</div>

				<div class="flex gap-3 pt-1">
					<button
						type="submit"
						class="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-md shadow-green-200 hover:bg-green-700 transition active:scale-[0.98]"
					>
						{modalMode === 'create' ? 'Simpan' : 'Update'}
					</button>
					<button
						type="button"
						onclick={closeModal}
						class="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 transition"
					>
						Batal
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
