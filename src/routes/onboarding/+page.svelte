<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let form = $derived($page.form);
	let errors = $derived<Record<string, string>>(form?.errors ?? {});
</script>

<svelte:head>
	<title>Setup Toko — {data.tenant.nama_toko} — LaundryIn</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-6 py-12">
	<div class="w-full max-w-md">
		<div class="mb-8 text-center">
			<a href="/" class="text-2xl font-bold text-green-600 hover:text-green-700">LaundryIn</a>
			<p class="mt-1 text-sm text-green-700 font-medium">{data.tenant.slug}</p>
			<h1 class="mt-2 text-xl font-bold text-gray-900">Setup {data.tenant.nama_toko}</h1>
			<p class="mt-2 text-gray-600">Lengkapi informasi toko untuk memulai</p>
		</div>

		<div class="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
			<form method="POST" class="space-y-5">
				<div>
					<label for="alamat" class="block text-sm font-medium text-gray-700">Alamat Toko</label>
					<textarea
						name="alamat" id="alamat" required rows={3}
						placeholder="Jl. Merdeka No. 123, Kelurahan, Kecamatan, Kota"
						class="mt-1 block w-full rounded-xl border px-4 py-3 text-sm placeholder-gray-400
							{errors.alamat ? 'border-red-400 bg-red-50' : 'border-gray-300'}
							focus:outline-none focus:ring-2 {errors.alamat ? 'focus:ring-red-200 focus:border-red-500' : 'focus:ring-green-200 focus:border-green-500'}"
					></textarea>
					{#if errors.alamat}<p class="mt-1 text-xs text-red-600">{errors.alamat}</p>{/if}
				</div>

				{#if errors.general}
					<p class="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{errors.general}</p>
				{/if}

				<button type="submit"
					class="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white shadow-lg shadow-green-200 hover:bg-green-700 transition">
					Lanjut ke Dashboard
				</button>
			</form>
		</div>
	</div>
</div>
