<script lang="ts">
	import { page } from '$app/stores';

	let { data }: { data: any } = $props();

	let form = $derived($page.form);
	let errors = $derived<Record<string, string>>(form?.errors ?? {});
	let formValues = $derived<Record<string, string>>(form?.values ?? {});

	let toastDismissed = $state(false);
	let hasError = $derived(Object.keys(errors).length > 0);

	$effect(() => {
		if (hasError) toastDismissed = false;
	});

	let firstError = $derived(
		hasError ? (errors.general || Object.values(errors)[0]) : ''
	);
</script>

<svelte:head>
	<title>Daftar — LaundryIn</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-6 py-12">
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<a href="/" class="text-2xl font-bold text-green-600 hover:text-green-700">LaundryIn</a>
			<p class="mt-2 text-gray-600">Mulai kelola laundry Anda secara gratis</p>
		</div>

		<!-- Toast error -->
		{#if hasError && !toastDismissed}
			<div class="mb-4 animate-[slideDown_0.3s_ease-out]">
				<div class="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-lg">
					<span class="text-lg">&#9888;&#65039;</span>
					<div>
						<p class="text-sm font-semibold text-red-800">Gagal mendaftar</p>
						<p class="text-sm text-red-600">{firstError}</p>
					</div>
					<button onclick={() => toastDismissed = true}
						class="ml-auto text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
				</div>
			</div>
		{/if}

		<div class="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
			<!-- Native form — SvelteKit handles redirect natively -->
			<form method="POST" class="space-y-4">
				<div>
					<label for="nama_toko" class="block text-sm font-medium text-gray-700">Nama Toko</label>
					<input
						type="text" name="nama_toko" id="nama_toko" required
						placeholder="Gevana Laundry"
						value={formValues.nama_toko ?? ''}
						class="mt-1 block w-full rounded-xl border px-4 py-3 text-sm placeholder-gray-400
							{errors.nama_toko ? 'border-red-400 bg-red-50' : 'border-gray-300'}
							focus:outline-none focus:ring-2 {errors.nama_toko ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
					/>
					{#if errors.nama_toko}<p class="mt-1 text-xs text-red-600">{errors.nama_toko}</p>{/if}
				</div>

				<div>
					<label for="slug" class="block text-sm font-medium text-gray-700">
						Link Toko <span class="text-gray-400 font-normal">(opsional)</span>
					</label>
					<div class="mt-1 flex items-center rounded-xl border {errors.slug ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50'} px-3 text-sm text-gray-500">
						<span class="py-3">laundryin.id/</span>
						<input
							type="text" name="slug" id="slug"
							placeholder="nama-toko"
							value={formValues.slug ?? ''}
							class="flex-1 bg-transparent py-3 pr-3 text-gray-700 placeholder-gray-400 focus:outline-none"
						/>
					</div>
					{#if errors.slug}<p class="mt-1 text-xs text-red-600">{errors.slug}</p>{/if}
				</div>

				<div>
					<label for="nama_pemilik" class="block text-sm font-medium text-gray-700">Nama Pemilik</label>
					<input
						type="text" name="nama_pemilik" id="nama_pemilik" required
						placeholder="Nama lengkap"
						value={formValues.nama_pemilik ?? ''}
						class="mt-1 block w-full rounded-xl border px-4 py-3 text-sm placeholder-gray-400
							{errors.nama_pemilik ? 'border-red-400 bg-red-50' : 'border-gray-300'}
							focus:outline-none focus:ring-2 {errors.nama_pemilik ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
					/>
					{#if errors.nama_pemilik}<p class="mt-1 text-xs text-red-600">{errors.nama_pemilik}</p>{/if}
				</div>

				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
					<input
						type="email" name="email" id="email" required
						placeholder="nama@email.com"
						value={formValues.email ?? ''}
						class="mt-1 block w-full rounded-xl border px-4 py-3 text-sm placeholder-gray-400
							{errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'}
							focus:outline-none focus:ring-2 {errors.email ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
					/>
					{#if errors.email}<p class="mt-1 text-xs text-red-600">{errors.email}</p>{/if}
				</div>

				<div>
					<label for="nomor_hp" class="block text-sm font-medium text-gray-700">Nomor HP</label>
					<input
						type="tel" name="nomor_hp" id="nomor_hp" required
						placeholder="0812-3456-7890"
						value={formValues.nomor_hp ?? ''}
						class="mt-1 block w-full rounded-xl border px-4 py-3 text-sm placeholder-gray-400
							{errors.nomor_hp ? 'border-red-400 bg-red-50' : 'border-gray-300'}
							focus:outline-none focus:ring-2 {errors.nomor_hp ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
					/>
					{#if errors.nomor_hp}<p class="mt-1 text-xs text-red-600">{errors.nomor_hp}</p>{/if}
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
					<input
						type="password" name="password" id="password" required minlength={8}
						placeholder="Minimal 8 karakter"
						class="mt-1 block w-full rounded-xl border px-4 py-3 text-sm placeholder-gray-400
							{errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}
							focus:outline-none focus:ring-2 {errors.password ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
					/>
					{#if errors.password}<p class="mt-1 text-xs text-red-600">{errors.password}</p>{/if}
				</div>

				<button type="submit"
					class="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white shadow-lg shadow-green-200 hover:bg-green-700 transition">
					Daftar Gratis
				</button>
			</form>

			<div class="mt-6 text-center text-sm text-gray-500">
				Sudah punya akun?
				<a href="/auth/login" class="font-medium text-green-600 hover:text-green-700">Masuk</a>
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
