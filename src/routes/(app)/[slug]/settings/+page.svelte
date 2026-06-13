<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { formatRupiah } from '$lib/utils/format';

	let { data }: { data: PageData } = $props();

	let tenantData = $derived(data.tenant);
	let layananList = $derived(data.layanan);
	let userList = $derived(data.users);
	let currentRole = $derived(data.currentRole);
	let userCount = $derived(data.userCount);
	let userLimit = $derived(data.userLimit);

	// ── Tab state ──
	let activeTab = $state<'profil' | 'layanan' | 'users'>('profil');

	// ── Layanan modal ──
	let showLayananModal = $state(false);
	let layananMode = $state<'create' | 'edit'>('create');
	let editingLayanan = $state<{ id: string; nama: string; satuan: string; harga: number; kategori: string; aktif: boolean; workflow?: string[] } | null>(null);
	let editingWorkflow = $state<string[]>(['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai']);

	function openAddLayanan() {
		layananMode = 'create';
		editingLayanan = null;
		editingWorkflow = ['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'];
		showLayananModal = true;
		submitError = '';
	}

	function openEditLayanan(l: any) {
		layananMode = 'edit';
		editingLayanan = { id: l.id, nama: l.nama, satuan: l.satuan, harga: l.harga, kategori: l.kategori || 'Lainnya', aktif: l.aktif, workflow: l.workflow };
		editingWorkflow = l.workflow && l.workflow.length > 0 ? [...l.workflow] : ['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'];
		showLayananModal = true;
		submitError = '';
	}

	function closeLayananModal() {
		showLayananModal = false;
		editingLayanan = null;
	}

	// ── User modal ──
	let showUserModal = $state(false);
	let newEmail = $state('');
	let newNama = $state('');
	let newPassword = $state('');
	let newRole = $state<'kasir' | 'driver'>('kasir');
	let showPassword = $state(false);
	let isAtLimit = $derived(userCount >= userLimit);

	function openAddUser() {
		newEmail = '';
		newNama = '';
		newPassword = '';
		newRole = 'kasir';
		showPassword = false;
		showUserModal = true;
		submitError = '';
	}

	function closeUserModal() {
		showUserModal = false;
	}

	// ── Delete confirm ──
	let deleteTarget = $state<{ id: string; nama: string } | null>(null);

	function confirmDelete(id: string, nama: string) {
		deleteTarget = { id, nama };
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
		successTimer = setTimeout(() => { successMessage = ''; }, 3000);
	}

	function handleResult(result: { type: string; data?: Record<string, unknown> }) {
		if (result.type === 'success') {
			const d = result.data as Record<string, unknown>;
			showSuccess((d?.message as string) || 'Berhasil');
			closeLayananModal();
			invalidateAll();
		} else if (result.type === 'failure') {
			submitError = ((result.data as Record<string, string>)?.error) || 'Gagal';
		}
	}

	import { invalidateAll } from '$app/navigation';
	function handleProfileResult(result: { type: string; data?: Record<string, unknown> }) {
		if (result.type === 'success') {
			const d = result.data as Record<string, unknown>;
			showSuccess((d?.message as string) || 'Berhasil');
			invalidateAll();
		} else if (result.type === 'failure') {
			submitError = ((result.data as Record<string, string>)?.error) || 'Gagal';
		}
	}

	function handleUserResult(result: { type: string; data?: Record<string, unknown> }) {
		if (result.type === 'success') {
			const d = result.data as Record<string, unknown>;
			showSuccess((d?.message as string) || 'Berhasil');
			closeUserModal();
			cancelDelete();
			invalidateAll();
		} else if (result.type === 'failure') {
			submitError = ((result.data as Record<string, string>)?.error) || 'Gagal';
		}
	}
</script>

<svelte:head><title>Pengaturan — LaundryIn</title></svelte:head>

<div class="h-[calc(100vh-0px)] overflow-y-auto bg-gray-50">
	<div class="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
		<h1 class="text-xl font-bold text-gray-800">⚙️ Pengaturan</h1>

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

		<!-- Tabs -->
		<div class="flex gap-1 bg-gray-100 rounded-xl p-1">
			{#each [
				{ id: 'profil', label: '🏪 Profil Toko' },
				{ id: 'layanan', label: '🧺 Layanan' },
				{ id: 'users', label: '👤 Pengguna' }
			] as tab}
				<button onclick={() => activeTab = tab.id}
					class="flex-1 rounded-lg py-2 text-sm font-medium transition {activeTab === tab.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- ═══ PROFIL TOKO ═══ -->
		{#if activeTab === 'profil'}
			<div class="rounded-xl border border-gray-200 bg-white p-5">
				<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informasi Toko</h2>
				<form method="POST" action="?/update_profile" use:enhance={() => { submitError = ''; return async ({ result }) => { handleProfileResult(result); await applyAction(result); }; }} class="space-y-4">
					<div>
						<label for="nama_toko" class="block text-sm font-medium text-gray-600 mb-1.5">Nama Toko</label>
						<input type="text" id="nama_toko" name="nama_toko" value={tenantData?.nama || ''} required class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
					<div>
						<label for="alamat" class="block text-sm font-medium text-gray-600 mb-1.5">Alamat</label>
						<textarea id="alamat" name="alamat" rows="2" class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500 resize-none">{tenantData?.alamat || ''}</textarea>
					</div>
					<div>
						<label for="nomor_hp" class="block text-sm font-medium text-gray-600 mb-1.5">Nomor HP</label>
						<input type="tel" id="nomor_hp" name="nomor_hp" value={tenantData?.nomor_hp || ''} class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
					<div class="text-xs text-gray-400 space-y-1">
						<p>Slug: <code class="bg-gray-100 px-1.5 py-0.5 rounded">{tenantData?.slug}</code></p>
						<p>Paket: <code class="bg-gray-100 px-1.5 py-0.5 rounded">{tenantData?.paket}</code></p>
					</div>
					<button type="submit" class="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-green-200 hover:bg-green-700 transition">Simpan Perubahan</button>
				</form>
			</div>
		{/if}

		<!-- ═══ LAYANAN ═══ -->
		{#if activeTab === 'layanan'}
			<div class="rounded-xl border border-gray-200 bg-white p-5">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Daftar Layanan ({layananList.length})</h2>
					<button onclick={openAddLayanan} class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition">+ Tambah</button>
				</div>
				{#if layananList.length === 0}
					<p class="text-sm text-gray-400 py-6 text-center">Belum ada layanan</p>
				{:else}
					<div class="space-y-1">
						{#each layananList as l}
							<div class="flex items-center justify-between rounded-lg hover:bg-gray-50 px-3 py-2.5 transition group">
								<div class="flex items-center gap-3 min-w-0">
									<span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{l.kategori || 'Lainnya'}</span>
									<div>
										<p class="text-sm font-medium text-gray-700">{l.nama}</p>
										<p class="text-xs text-gray-400">{formatRupiah(l.harga)}/{l.satuan}</p>
										{#if l.workflow && l.workflow.length > 0}
											<p class="text-[10px] text-gray-400 mt-0.5">{l.workflow.map((s: string) => s.replace(/_/g, ' ')).join(' → ')}</p>
										{/if}
									</div>
								</div>
								<div class="flex items-center gap-2 flex-shrink-0 ml-2">
									{#if !l.aktif}<span class="text-[10px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded">Nonaktif</span>{/if}
									<button onclick={() => openEditLayanan(l)} class="rounded-lg p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition opacity-0 group-hover:opacity-100">✏️</button>
									<form method="POST" action="?/delete_layanan" use:enhance={() => { submitError = ''; return async ({ result }) => { handleResult(result); await applyAction(result); }; }}>
										<input type="hidden" name="id" value={l.id} />
										<button type="submit" class="rounded-lg p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100" title="Hapus">🗑️</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- ═══ PENGGUNA ═══ -->
		{#if activeTab === 'users'}
			<div class="rounded-xl border border-gray-200 bg-white p-5">
				<div class="flex items-center justify-between mb-4">
					<div>
						<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">
							Pengguna ({userCount}/{userLimit})
						</h2>
						{#if isAtLimit}
							<p class="text-[10px] text-amber-600 mt-0.5">⚠️ Kuota penuh — upgrade untuk menambah</p>
						{/if}
					</div>
					{#if currentRole === 'admin'}
						<button onclick={openAddUser}
							disabled={isAtLimit}
							class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
							title={isAtLimit ? `Paket ${tenantData?.paket || 'free'} maksimal ${userLimit} pengguna` : 'Tambah pengguna'}>
							+ Tambah
						</button>
					{/if}
				</div>
				{#if userList.length === 0}
					<p class="text-sm text-gray-400 py-6 text-center">Belum ada pengguna</p>
				{:else}
					<div class="space-y-1">
						{#each userList as u}
							<div class="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50 transition group">
								<div class="flex items-center gap-3 min-w-0">
									<div class="h-8 w-8 rounded-full {u.role === 'admin' ? 'bg-green-100 text-green-600' : u.role === 'kasir' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'} flex items-center justify-center font-bold text-xs flex-shrink-0">{u.nama?.charAt(0)?.toUpperCase() || '?'}</div>
									<div>
										<p class="text-sm font-medium text-gray-700">{u.nama}</p>
										<p class="text-xs text-gray-400">{u.email}</p>
									</div>
								</div>
								<div class="flex items-center gap-2 flex-shrink-0 ml-2">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize {u.role === 'admin' ? 'bg-green-100 text-green-700' : u.role === 'kasir' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">{u.role}</span>
									{#if !u.aktif}<span class="text-[10px] text-red-400">Nonaktif</span>{/if}
									{#if currentRole === 'admin' && u.role !== 'admin'}
										<form method="POST" action="?/remove_user" use:enhance={() => { submitError = ''; return async ({ result }) => { handleUserResult(result); await applyAction(result); }; }}>
											<input type="hidden" name="id" value={u.id} />
											<input type="hidden" name="target_role" value={u.role} />
											<button type="submit"
												onclick={(e) => { if (!confirm(`Hapus ${u.nama} (${u.role})?`)) e.preventDefault(); }}
												class="rounded-lg p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100" title="Hapus">🗑️</button>
										</form>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- ═══ Modal: Tambah/Edit Layanan ═══ -->
{#if showLayananModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button onclick={closeLayananModal} class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-default" aria-label="Tutup"></button>
		<div class="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-bold text-gray-800">{layananMode === 'create' ? 'Tambah Layanan' : 'Edit Layanan'}</h2>
				<button onclick={closeLayananModal} class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
			</div>
			<form method="POST" action={layananMode === 'create' ? '?/add_layanan' : '?/update_layanan'} use:enhance={() => { submitError = ''; return async ({ result }) => { handleResult(result); await applyAction(result); }; }} class="space-y-4">
				{#if layananMode === 'edit' && editingLayanan}
					<input type="hidden" name="id" value={editingLayanan.id} />
				{/if}
				<div>
					<label for="layanan_nama" class="block text-sm font-medium text-gray-600 mb-1.5">Nama <span class="text-red-400">*</span></label>
					<input type="text" id="layanan_nama" name="nama" required value={editingLayanan?.nama || ''} class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="layanan_harga" class="block text-sm font-medium text-gray-600 mb-1.5">Harga (Rp)</label>
						<input type="number" id="layanan_harga" name="harga" required min="1" value={editingLayanan?.harga || ''} class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
					</div>
					<div>
						<label for="layanan_satuan" class="block text-sm font-medium text-gray-600 mb-1.5">Satuan</label>
						<select id="layanan_satuan" name="satuan" class="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500">
							{#each ['kg', 'piece', 'set'] as s}
								<option value={s} selected={editingLayanan?.satuan === s}>{s}</option>
							{/each}
						</select>
					</div>
				</div>
				<div>
					<label for="layanan_kategori" class="block text-sm font-medium text-gray-600 mb-1.5">Kategori</label>
					<select id="layanan_kategori" name="kategori" class="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500">
						{#each ['Cuci', 'Setrika', 'Express', 'Lainnya'] as k}
							<option value={k} selected={editingLayanan?.kategori === k}>{k}</option>
						{/each}
					</select>
				</div>

				<!-- Workflow Editor -->
				<div>
					<label for="addStep" class="block text-sm font-medium text-gray-600 mb-2">Workflow Proses</label>
					<p class="text-xs text-gray-400 mb-2">Centang dan urutkan langkah yang relevan. Delivery (jemput/antar) otomatis ditambah saat order.</p>
					<div class="space-y-1.5">
						{#each editingWorkflow as step, idx}
							<div class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 bg-white">
								<span class="text-xs font-mono text-gray-400 w-5">{idx + 1}</span>
								<span class="text-sm text-gray-700 flex-1 capitalize">{step.replace(/_/g, ' ')}</span>
								<div class="flex gap-1">
									<button type="button" onclick={() => { if (idx > 0) { const tmp = editingWorkflow[idx-1]; editingWorkflow[idx-1] = step; editingWorkflow[idx] = tmp; } }} class="p-1 text-gray-400 hover:text-gray-600" disabled={idx === 0}>▲</button>
									<button type="button" onclick={() => { if (idx < editingWorkflow.length - 1) { const tmp = editingWorkflow[idx+1]; editingWorkflow[idx+1] = step; editingWorkflow[idx] = tmp; } }} class="p-1 text-gray-400 hover:text-gray-600" disabled={idx === editingWorkflow.length - 1}>▼</button>
									<button type="button" onclick={() => { editingWorkflow = editingWorkflow.filter((_, i) => i !== idx); }} class="p-1 text-red-400 hover:text-red-600">✕</button>
								</div>
							</div>
						{/each}
					</div>
					<!-- Add step dropdown -->
					<div class="flex gap-2 mt-2">
						<select id="addStep" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">
							<option value="">+ Tambah langkah...</option>
							{#each ['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'] as s}
								{#if !editingWorkflow.includes(s)}
									<option value={s}>{s.replace(/_/g, ' ')}</option>
								{/if}
							{/each}
						</select>
						<button type="button" onclick={() => {
							const sel = document.getElementById('addStep') as HTMLSelectElement;
							if (sel.value) { editingWorkflow = [...editingWorkflow, sel.value]; sel.value = ''; }
						}} class="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200">Tambah</button>
					</div>
					<input type="hidden" name="workflow" value={JSON.stringify(editingWorkflow)} />
				</div>

				{#if layananMode === 'edit'}
					<label class="flex items-center gap-2 text-sm text-gray-600">
						<input type="checkbox" name="aktif" value="true" checked={editingLayanan?.aktif} class="rounded" /> Aktif
					</label>
				{/if}
				<div class="flex gap-3 pt-1">
					<button type="submit" class="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-md shadow-green-200 hover:bg-green-700 transition">{layananMode === 'create' ? 'Simpan' : 'Update'}</button>
					<button type="button" onclick={closeLayananModal} class="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 transition">Batal</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- ═══ Modal: Tambah Pengguna ═══ -->
{#if showUserModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button onclick={closeUserModal} class="fixed inset-0 bg-black/40 backdrop-blur-sm cursor-default" aria-label="Tutup"></button>
		<div class="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-bold text-gray-800">Tambah Pengguna</h2>
				<button onclick={closeUserModal} class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
			</div>
			<form method="POST" action="?/add_user" use:enhance={() => { submitError = ''; return async ({ result }) => { handleUserResult(result); await applyAction(result); }; }} class="space-y-4">
				<div>
					<label for="user_email" class="block text-sm font-medium text-gray-600 mb-1.5">Email <span class="text-red-400">*</span></label>
					<input type="email" id="user_email" name="email" bind:value={newEmail} required
						placeholder="pekerja@email.com"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
				</div>
				<div>
					<label for="user_nama" class="block text-sm font-medium text-gray-600 mb-1.5">Nama <span class="text-red-400">*</span></label>
					<input type="text" id="user_nama" name="nama" bind:value={newNama} required
						placeholder="Nama pekerja"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
				</div>
				<div>
					<label for="user_password" class="block text-sm font-medium text-gray-600 mb-1.5">Password <span class="text-red-400">*</span></label>
					<div class="relative">
						<input type={showPassword ? 'text' : 'password'} id="user_password" name="password" bind:value={newPassword} required minlength="6"
							placeholder="Minimal 6 karakter"
							class="w-full rounded-xl border border-gray-300 pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
						<button type="button" onclick={() => showPassword = !showPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
							{#if showPassword}🙈{:else}👁️{/if}
						</button>
					</div>
				</div>
				<div>
					<label for="user_role" class="block text-sm font-medium text-gray-600 mb-1.5">Role</label>
					<div class="flex gap-2">
						<button type="button" onclick={() => newRole = 'kasir'}
							class="flex-1 rounded-lg py-2.5 text-sm font-medium transition {newRole === 'kasir' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}">
							💰 Kasir
						</button>
						<button type="button" onclick={() => newRole = 'driver'}
							class="flex-1 rounded-lg py-2.5 text-sm font-medium transition {newRole === 'driver' ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'}">
							🚚 Driver
						</button>
					</div>
					<input type="hidden" id="user_role" name="role" value={newRole} />
				</div>
				<div class="flex gap-3 pt-1">
					<button type="submit" class="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-md shadow-green-200 hover:bg-green-700 transition">Tambah Pengguna</button>
					<button type="button" onclick={closeUserModal} class="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 transition">Batal</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
</style>
