<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let message = $derived(data.message ?? '');
	let formData = $derived($page.form);
	let errors = $derived<Record<string, string>>(formData?.errors ?? {});
	let formValues = $derived<Record<string, string>>(formData?.values ?? {});

	let emailError = $derived(errors.email);
	let passwordError = $derived(errors.password);
	let generalError = $derived(errors.general);
	let successMessage = $derived(message === 'pendaftaran_berhasil' ? 'Pendaftaran berhasil! Silakan masuk.' : null);
	let hasError = $derived(!!(emailError || passwordError || generalError));
	let hasSuccess = $derived(!!successMessage);

	let showPassword = $state(false);
	let toastDismissed = $state(false);

	$effect(() => {
		if (hasError || hasSuccess) toastDismissed = false;
	});
	let showErrorToast = $derived(hasError && !toastDismissed);
	let showSuccessToast = $derived(hasSuccess && !toastDismissed);
</script>

<svelte:head>
	<title>Masuk — LaundryIn</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-6 py-12">
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<a href="/" class="text-2xl font-bold text-green-600 hover:text-green-700">LaundryIn</a>
			<p class="mt-2 text-gray-600">Masuk ke workspace Anda</p>
		</div>

		<!-- Toast Error -->
		{#if showErrorToast}
			<div class="mb-4 animate-[slideDown_0.3s_ease-out]">
				<div class="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-lg">
					<span class="text-lg">&#9888;&#65039;</span>
					<div>
						<p class="text-sm font-semibold text-red-800">Gagal masuk</p>
						<p class="text-sm text-red-600">
							{generalError ?? emailError ?? passwordError}
						</p>
					</div>
					<button onclick={() => toastDismissed = true}
						class="ml-auto text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
				</div>
			</div>
		{/if}

		<!-- Toast Sukses -->
		{#if showSuccessToast}
			<div class="mb-4 animate-[slideDown_0.3s_ease-out]">
				<div class="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 shadow-lg">
					<span class="text-lg">&#9989;</span>
					<div>
						<p class="text-sm font-semibold text-green-800">Berhasil!</p>
						<p class="text-sm text-green-600">{successMessage}</p>
					</div>
					<button onclick={() => toastDismissed = true}
						class="ml-auto text-green-400 hover:text-green-600 text-lg leading-none">&times;</button>
				</div>
			</div>
		{/if}

		<div class="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
			<!-- Native form: SvelteKit handles redirect natively, fail() populates $page.form -->
			<form method="POST" class="space-y-5">
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
					<input
						type="email" name="email" id="email" required
						placeholder="nama@email.com"
						value={formValues.email ?? ''}
						class="mt-1 block w-full rounded-xl border px-4 py-3 text-sm placeholder-gray-400
							{emailError ? 'border-red-400 bg-red-50' : 'border-gray-300'}
							focus:outline-none focus:ring-2 {emailError ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
					<div class="relative mt-1">
						<input
							type={showPassword ? 'text' : 'password'}
							name="password" id="password" required
							placeholder="••••••••"
							class="block w-full rounded-xl border px-4 py-3 pr-11 text-sm placeholder-gray-400
								{passwordError ? 'border-red-400 bg-red-50' : 'border-gray-300'}
								focus:outline-none focus:ring-2 {passwordError ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
						/>
						<button
							type="button"
							onclick={() => showPassword = !showPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
							aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
						>
							{#if showPassword}
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
									<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
									<path d="m14.12 14.12a3 3 0 1 1-4.24-4.24" />
									<line x1="1" y1="1" x2="23" y2="23" />
								</svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<button type="submit"
					class="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white shadow-lg shadow-green-200 hover:bg-green-700 transition">
					Masuk
				</button>
			</form>

			<div class="mt-6 text-center text-sm text-gray-500">
				Belum punya akun?
				<a href="/auth/register" class="font-medium text-green-600 hover:text-green-700">Daftar Gratis</a>
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
