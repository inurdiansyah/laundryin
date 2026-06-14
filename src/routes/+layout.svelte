<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let session = $derived(data.session);
	let tenant = $derived(data.tenant);
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="description" content="LaundryIn — Solusi manajemen laundry modern untuk bisnis kecil di Indonesia" />
	<meta name="theme-color" content="#16a34a" />
	<link rel="manifest" href="/manifest.json" />
</svelte:head>

{#if session && !tenant}
	<!-- Stale session + public navbar hybrid -->
	<nav class="border-b border-gray-100 bg-white/80 backdrop-blur-md">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
			<div class="flex items-center gap-3">
				<a href="/" class="text-xl font-bold text-green-600">LaundryIn</a>
				<span class="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Sesi tidak valid</span>
			</div>
			<div class="flex items-center gap-3">
				<a href="/auth/login"
					class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:text-green-600 transition">
					Masuk
				</a>
				<a href="/auth/register"
					class="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-green-200 hover:bg-green-700 transition">
					Daftar Gratis
				</a>
				<a href="/auth/logout"
					class="rounded-lg px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition">
					Bersihkan
				</a>
			</div>
		</div>
	</nav>
{:else if !session}
	<!-- Public: navbar untuk guest -->
	<nav class="border-b border-gray-100 bg-white/80 backdrop-blur-md">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
			<a href="/" class="text-xl font-bold text-green-600">LaundryIn</a>
			<div class="flex items-center gap-3">
				<a href="/auth/login"
					class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:text-green-600 transition">
					Masuk
				</a>
				<a href="/auth/register"
					class="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-green-200 hover:bg-green-700 transition">
					Daftar Gratis
				</a>
			</div>
		</div>
	</nav>
{/if}

<main>
	{@render children()}
</main>
