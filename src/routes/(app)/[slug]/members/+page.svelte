<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import type { PageData } from './$types';
	import { formatRupiah } from '$lib/utils/format';

	let { data }: { data: PageData } = $props();

	let members = $derived(data.members ?? []);
	let availableCustomers = $derived(data.availableCustomers ?? []);
	let pointsLog = $derived(data.pointsLog ?? []);
	let formState = $derived($page.form);

	// ── Tier badge color ──
	function tierColor(tier: string): string {
		switch (tier) {
			case 'platinum':
				return 'bg-purple-100 text-purple-700 border-purple-200';
			case 'gold':
				return 'bg-amber-100 text-amber-700 border-amber-200';
			case 'silver':
				return 'bg-blue-100 text-blue-700 border-blue-200';
			default:
				return 'bg-gray-100 text-gray-600 border-gray-200';
		}
	}

	function tierLabel(tier: string): string {
		switch (tier) {
			case 'platinum':
				return '💎 Platinum';
			case 'gold':
				return '🥇 Gold';
			case 'silver':
				return '🥈 Silver';
			default:
				return '👤 Regular';
		}
	}

	// ── Expanded member (points history) ──
	let expandedMemberId = $state<string | null>(null);

	function memberPoints(memberId: string) {
		return (pointsLog as Array<Record<string, unknown>>).filter(
			(p) => p.member_id === memberId
		);
	}

	function toggleExpand(memberId: string) {
		expandedMemberId = expandedMemberId === memberId ? null : memberId;
	}

	// ── Modal: Add Member ──
	let showAddModal = $state(false);
	let addCustomerId = $state('');
	let addTier = $state('regular');

	function openAddMember() {
		addCustomerId = '';
		addTier = 'regular';
		submitError = '';
		showAddModal = true;
	}

	function closeAddMember() {
		showAddModal = false;
	}

	// ── Modal: Add Points ──
	let showPointsModal = $state(false);
	let pointsMemberId = $state('');
	let pointsMemberLabel = $state('');
	let pointsValue = $state('');
	let pointsType = $state<'masuk' | 'keluar'>('masuk');
	let pointsNote = $state('');

	function openAddPoints(member: (typeof members)[number]) {
		pointsMemberId = member.id;
		const customer = (member as any).customers;
		pointsMemberLabel = `${customer?.nama ?? '?'} (${member.nomor_member})`;
		pointsValue = '';
		pointsType = 'masuk';
		pointsNote = '';
		submitError = '';
		showPointsModal = true;
	}

	function closePointsModal() {
		showPointsModal = false;
	}

	// ── Modal: Edit Tier ──
	let showTierModal = $state(false);
	let tierMemberId = $state('');
	let tierMemberLabel = $state('');
	let currentTier = $state('');
	let newTier = $state('');

	function openEditTier(member: (typeof members)[number]) {
		tierMemberId = member.id;
		const customer = (member as any).customers;
		tierMemberLabel = `${customer?.nama ?? '?'} (${member.nomor_member})`;
		currentTier = member.tier;
		newTier = member.tier;
		submitError = '';
		showTierModal = true;
	}

	function closeTierModal() {
		showTierModal = false;
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

	function handleFormResult(result: {
		type: string;
		data?: Record<string, unknown>;
	}) {
		if (result.type === 'success') {
			const d = result.data as Record<string, unknown>;
			showSuccess((d?.message as string) || 'Berhasil');
			closeAddMember();
			closePointsModal();
			closeTierModal();
		} else if (result.type === 'failure') {
			submitError = ((result.data as Record<string, string>)?.error) || 'Gagal';
		}
	}

	// ── Tier filter tabs ──
	const tiers = [
		{ key: '', label: 'Semua' },
		{ key: 'regular', label: 'Regular' },
		{ key: 'silver', label: 'Silver' },
		{ key: 'gold', label: 'Gold' },
		{ key: 'platinum', label: 'Platinum' }
	];

	let activeTier = $derived($page.url.searchParams.get('tier') ?? '');

	function navigateTier(tier: string) {
		const url = new URL(get(page).url.href);
		if (tier) {
			url.searchParams.set('tier', tier);
		} else {
			url.searchParams.delete('tier');
		}
		url.searchParams.delete('page');
		goto(url.pathname + url.search, { replaceState: true });
	}

	// ── Client-side pagination ──
	const PER_PAGE = 10;
	let currentPage = $derived(
		Math.max(1, parseInt($page.url.searchParams.get('page') ?? '1', 10))
	);

	let filteredMembers = $derived(
		activeTier ? members.filter((m) => m.tier === activeTier) : members
	);

	let totalPages = $derived(Math.max(1, Math.ceil(filteredMembers.length / PER_PAGE)));
	let totalCount = $derived(filteredMembers.length);

	let clampedPage = $derived(Math.min(currentPage, totalPages));
	let paginatedMembers = $derived(
		filteredMembers.slice((clampedPage - 1) * PER_PAGE, clampedPage * PER_PAGE)
	);

	function navigatePage(p: number) {
		const url = new URL(get(page).url.href);
		if (p <= 1) {
			url.searchParams.delete('page');
		} else {
			url.searchParams.set('page', String(p));
		}
		goto(url.pathname + url.search, { replaceState: true });
	}

	// ── Format date ──
	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Membership — LaundryIn</title>
</svelte:head>

<div class="h-[calc(100vh-0px)] overflow-y-auto bg-gray-50">
	<div class="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
		<!-- ═══ Header ═══ -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-bold text-gray-800">💎 Membership</h1>
				<p class="text-sm text-gray-400 mt-0.5">
					{totalCount} member
				</p>
			</div>
			{#if availableCustomers.length > 0}
				<button
					onclick={openAddMember}
					class="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-200 hover:bg-purple-700 transition active:scale-95"
				>
					+ Tambah Member
				</button>
			{/if}
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

		<!-- ═══ Tier Filter Tabs ═══ -->
		<div class="flex gap-1.5 overflow-x-auto pb-1">
			{#each tiers as t}
				<button
					onclick={() => navigateTier(t.key)}
					class="rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition active:scale-95 {activeTier === t.key
						? 'bg-green-600 text-white shadow-sm'
						: 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
				>
					{t.label}
				</button>
			{/each}
		</div>

		<!-- ═══ Member List ═══ -->
		{#if members.length === 0}
			<div class="rounded-xl border border-gray-200 bg-white p-12 text-center">
				<span class="text-4xl block mb-3">💎</span>
				<p class="text-gray-400 font-medium">
					{#if availableCustomers.length === 0}
						Semua pelanggan sudah terdaftar sebagai member
					{:else}
						Belum ada member. Daftarkan pelanggan sebagai member!
					{/if}
				</p>
			</div>
		{:else if paginatedMembers.length === 0}
			<div class="rounded-xl border border-gray-200 bg-white p-12 text-center">
				<span class="text-4xl block mb-3">🔍</span>
				<p class="text-gray-400 font-medium">
					Tidak ada member dengan tier ini
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each paginatedMembers as m (m.id)}
					{@const customer = m.customers as any}
					{@const pts = memberPoints(m.id)}
					<div
						class="rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-sm"
					>
						<!-- Member Row -->
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							tabindex="0"
							role="button"
							onclick={() => toggleExpand(m.id)}
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									toggleExpand(m.id);
								}
							}}
							class="w-full text-left px-4 py-3 hover:bg-gray-50/50 transition cursor-pointer"
						>
							<!-- Row 1: Avatar + Info + Expand -->
							<div class="flex items-center gap-2.5">
								<!-- Avatar -->
								<div
									class="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm"
								>
									{customer?.nama?.charAt(0).toUpperCase() ?? '?'}
								</div>

								<!-- Info -->
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold text-gray-800 truncate">
										{customer?.nama ?? '—'}
									</p>
									<p class="text-xs text-gray-400 mt-0.5 truncate">
										{m.nomor_member} · {customer?.nomor_hp ?? ''}
									</p>
								</div>

								<!-- Expand indicator -->
								<span
									class="flex-shrink-0 text-gray-300 text-xs transition-transform duration-200 {expandedMemberId === m.id
										? 'rotate-90'
										: ''}"
								>
									▶
								</span>
							</div>

							<!-- Row 2: Tier + Points + Actions -->
							<div class="flex items-center justify-between mt-2">
								<div class="flex items-center gap-2">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-semibold border inline-block {tierColor(m.tier)}">
										<span class="sm:hidden">{m.tier}</span>
										<span class="hidden sm:inline">{tierLabel(m.tier)}</span>
									</span>
									<span class="text-xs font-semibold text-purple-700 sm:hidden">
										{Number(m.poin).toLocaleString('id-ID')} ★
									</span>
								</div>

								<!-- Action buttons -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="flex items-center gap-1"
									onkeydown={(e: KeyboardEvent) => {}}
									onclick={(e: Event) => e.stopPropagation()}
								>
									<button
										onclick={() => openAddPoints(m)}
										class="rounded-lg p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition"
										title="Tambah Poin"
									>
										<span class="text-sm">⭐</span>
									</button>
									<button
										onclick={() => openEditTier(m)}
										class="rounded-lg p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
										title="Ubah Tier"
									>
										<span class="text-sm">🏷️</span>
									</button>
								</div>
							</div>
						</div>

						<!-- Expanded: Points History -->
						{#if expandedMemberId === m.id}
							<div
								class="border-t border-gray-100 bg-gray-50/50 px-4 py-3 animate-[slideDown_0.2s_ease-out]"
							>
								<p
									class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
								>
									Riwayat Poin ({pts.length})
								</p>

								{#if pts.length === 0}
									<p class="text-sm text-gray-400 text-center py-4">
										Belum ada riwayat poin
									</p>
								{:else}
									<div class="space-y-1.5 max-h-64 overflow-y-auto">
										{#each pts.slice(0, 50) as log}
											<div
												class="flex items-center justify-between rounded-lg bg-white border border-gray-100 px-3 py-2.5 text-sm"
											>
												<div class="min-w-0 flex-1">
													<p class="text-sm font-medium text-gray-700">
														{log.tipe === 'masuk'
															? '➕ Poin Bertambah'
															: '➖ Poin Digunakan'}
													</p>
													{#if log.keterangan}
														<p class="text-xs text-gray-400 mt-0.5">
															{log.keterangan}
														</p>
													{/if}
												</div>
												<div class="flex items-center gap-3 flex-shrink-0 ml-3">
													<span
														class="text-sm font-bold {log.tipe === 'masuk'
															? 'text-green-600'
															: 'text-red-600'}"
													>
														{log.tipe === 'masuk' ? '+' : ''}
														{Number(log.poin).toLocaleString('id-ID')}
													</span>
													<span class="text-[10px] text-gray-400">
														{formatDate(log.created_at as string)}
													</span>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- ═══ Pagination ═══ -->
			<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
				<p class="text-sm text-gray-500">
					{totalCount} member ditemukan
					<span class="text-gray-300">·</span>
					Halaman {clampedPage} dari {totalPages}
				</p>
				<div class="flex gap-2">
					<button
						onclick={() => navigatePage(clampedPage - 1)}
						disabled={clampedPage <= 1}
						class="rounded-xl px-4 py-2 text-sm font-medium transition active:scale-95 {clampedPage <= 1
							? 'bg-gray-100 text-gray-400 cursor-not-allowed'
							: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}"
					>
						Sebelumnya
					</button>
					<button
						onclick={() => navigatePage(clampedPage + 1)}
						disabled={clampedPage >= totalPages}
						class="rounded-xl px-4 py-2 text-sm font-medium transition active:scale-95 {clampedPage >= totalPages
							? 'bg-gray-100 text-gray-400 cursor-not-allowed'
							: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}"
					>
						Selanjutnya
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- ═══ Modal: Add Member ═══ -->
{#if showAddModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button
			onclick={closeAddMember}
			class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-default"
			aria-label="Tutup"
		></button>

		<!-- Modal Content -->
		<div
			class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-6 animate-[slideDown_0.25s_ease-out]"
		>
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-bold text-gray-800">Tambah Member</h2>
				<button
					onclick={closeAddMember}
					class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
				>
					&times;
				</button>
			</div>

			<form
				method="POST"
				action="?/add_member"
				use:enhance={() => {
					submitError = '';
					return async ({ result }) => {
						handleFormResult(result);
						await applyAction(result);
					};
				}}
				class="space-y-4"
			>
				<div>
					<label
						for="customer_id"
						class="block text-sm font-medium text-gray-600 mb-1.5"
					>
						Pelanggan <span class="text-red-400">*</span>
					</label>
					<select
						id="customer_id"
						name="customer_id"
						required
						bind:value={addCustomerId}
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
					>
						<option value="">— Pilih Pelanggan —</option>
						{#each availableCustomers as c}
							<option value={c.id}>
								{c.nama} ({c.nomor_hp})
							</option>
						{/each}
					</select>
				</div>

				<div>
					<label
						for="tier"
						class="block text-sm font-medium text-gray-600 mb-1.5"
					>
						Tier
					</label>
					<select
						id="tier"
						name="tier"
						bind:value={addTier}
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
					>
						<option value="regular">Regular</option>
						<option value="silver">Silver</option>
						<option value="gold">Gold</option>
						<option value="platinum">Platinum</option>
					</select>
				</div>

				<div class="flex gap-3 pt-1">
					<button
						type="submit"
						class="flex-1 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-md shadow-purple-200 hover:bg-purple-700 transition active:scale-[0.98]"
					>
						Simpan
					</button>
					<button
						type="button"
						onclick={closeAddMember}
						class="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 transition"
					>
						Batal
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ═══ Modal: Add Points ═══ -->
{#if showPointsModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			onclick={closePointsModal}
			class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-default"
			aria-label="Tutup"
		></button>

		<div
			class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-6 animate-[slideDown_0.25s_ease-out]"
		>
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-bold text-gray-800">Tambah / Kurangi Poin</h2>
				<button
					onclick={closePointsModal}
					class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
				>
					&times;
				</button>
			</div>

			<p class="text-sm text-gray-500 mb-4">
				Member: <strong>{pointsMemberLabel}</strong>
			</p>

			<form
				method="POST"
				action="?/add_points"
				use:enhance={() => {
					submitError = '';
					return async ({ result }) => {
						handleFormResult(result);
						await applyAction(result);
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="member_id" value={pointsMemberId} />

				<div>
					<label
						for="poin"
						class="block text-sm font-medium text-gray-600 mb-1.5"
					>
						Jumlah Poin <span class="text-red-400">*</span>
					</label>
					<input
						type="number"
						id="poin"
						name="poin"
						required
						min="1"
						bind:value={pointsValue}
						placeholder="Masukkan jumlah poin"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-600 mb-1.5">
						Tipe <span class="text-red-400">*</span>
					</label>
					<div class="flex gap-3">
						<label
							class="flex-1 rounded-xl border px-4 py-3 text-sm font-medium cursor-pointer transition {pointsType === 'masuk'
								? 'border-purple-500 bg-purple-50 text-purple-700'
								: 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}"
						>
							<input
								type="radio"
								name="tipe"
								value="masuk"
								bind:group={pointsType}
								class="sr-only"
							/>
							<span class="flex items-center justify-center gap-2">
								➕ Tambah Poin
							</span>
						</label>
						<label
							class="flex-1 rounded-xl border px-4 py-3 text-sm font-medium cursor-pointer transition {pointsType === 'keluar'
								? 'border-red-500 bg-red-50 text-red-700'
								: 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}"
						>
							<input
								type="radio"
								name="tipe"
								value="keluar"
								bind:group={pointsType}
								class="sr-only"
							/>
							<span class="flex items-center justify-center gap-2">
								➖ Kurangi Poin
							</span>
						</label>
					</div>
				</div>

				<div>
					<label
						for="keterangan"
						class="block text-sm font-medium text-gray-600 mb-1.5"
					>
						Keterangan <span class="text-gray-400 text-xs">(opsional)</span>
					</label>
					<input
						type="text"
						id="keterangan"
						name="keterangan"
						bind:value={pointsNote}
						placeholder="Alasan penambahan/pengurangan..."
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
					/>
				</div>

				<div class="flex gap-3 pt-1">
					<button
						type="submit"
						class="flex-1 rounded-xl {pointsType === 'masuk'
							? 'bg-purple-600 shadow-purple-200 hover:bg-purple-700'
							: 'bg-red-600 shadow-red-200 hover:bg-red-700'} py-3 text-sm font-bold text-white shadow-md transition active:scale-[0.98]"
					>
						{pointsType === 'masuk' ? 'Tambah Poin' : 'Kurangi Poin'}
					</button>
					<button
						type="button"
						onclick={closePointsModal}
						class="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 transition"
					>
						Batal
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ═══ Modal: Edit Tier ═══ -->
{#if showTierModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			onclick={closeTierModal}
			class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-default"
			aria-label="Tutup"
		></button>

		<div
			class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 p-6 animate-[slideDown_0.25s_ease-out]"
		>
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-bold text-gray-800">Ubah Tier Member</h2>
				<button
					onclick={closeTierModal}
					class="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
				>
					&times;
				</button>
			</div>

			<p class="text-sm text-gray-500 mb-4">
				Member: <strong>{tierMemberLabel}</strong><br />
				Tier saat ini:
				<span
					class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ml-1 {tierColor(currentTier)}"
				>
					{tierLabel(currentTier)}
				</span>
			</p>

			<form
				method="POST"
				action="?/update_tier"
				use:enhance={() => {
					submitError = '';
					return async ({ result }) => {
						handleFormResult(result);
						await applyAction(result);
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="member_id" value={tierMemberId} />

				<div>
					<label
						for="new_tier"
						class="block text-sm font-medium text-gray-600 mb-1.5"
					>
						Tier Baru <span class="text-red-400">*</span>
					</label>
					<select
						id="new_tier"
						name="tier"
						required
						bind:value={newTier}
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
					>
						<option value="regular">Regular</option>
						<option value="silver">Silver</option>
						<option value="gold">Gold</option>
						<option value="platinum">Platinum</option>
					</select>
				</div>

				<div class="flex gap-3 pt-1">
					<button
						type="submit"
						class="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white shadow-md shadow-amber-200 hover:bg-amber-700 transition active:scale-[0.98]"
					>
						Update Tier
					</button>
					<button
						type="button"
						onclick={closeTierModal}
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
