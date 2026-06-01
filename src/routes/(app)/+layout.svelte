<script lang="ts">
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
	let tenant = $derived(data.tenant);
	let session = $derived(data.session);

	let pathname = $derived($page.url.pathname);
	let collapsed = $state(true);
	let sidebarExpanded = $state(false);   // desktop hover expand
	let mobileOpen = $state(false);        // mobile hamburger toggle

	// Auto-close mobile sidebar on navigation
	afterNavigate(() => {
		mobileOpen = false;
	});
</script>

<div class="flex min-h-screen bg-gray-50">
	<!-- Mobile overlay backdrop -->
	{#if mobileOpen}
		<button
			onclick={() => mobileOpen = false}
			class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden cursor-default"
			aria-label="Tutup sidebar"
		></button>
	{/if}

	<!-- Sidebar -->
	<aside
		class="border-r border-gray-200 bg-white flex flex-col transition-transform duration-200 ease-in-out
			lg:transition-[width] lg:duration-300
			fixed lg:static inset-y-0 left-0 z-50
			{mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
			{collapsed && !sidebarExpanded ? 'lg:w-14' : 'lg:w-56 w-56'}"
		onmouseenter={() => { if (collapsed) sidebarExpanded = true; }}
		onmouseleave={() => { if (sidebarExpanded) sidebarExpanded = false; }}
	>
		<!-- Header -->
		<div class="px-3 pt-4 pb-3 border-b border-gray-200 flex items-center justify-between">
			{#if collapsed && !sidebarExpanded && !mobileOpen}
				<span class="text-lg font-bold text-green-600">L</span>
			{:else}
				<a href={`/${tenant?.slug}`} onclick={() => mobileOpen = false} class="text-lg font-bold text-green-600">LaundryIn</a>
				{#if tenant}
					<p class="text-xs text-gray-400 mt-0.5 truncate ml-3 hidden lg:block">{tenant.nama_toko}</p>
				{/if}
			{/if}
			<!-- Close button (mobile) -->
			<button onclick={() => mobileOpen = false}
				class="lg:hidden text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
				aria-label="Tutup sidebar">&times;</button>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 p-1.5 space-y-0.5">
			{#each [
				{ href: `/${tenant?.slug}`, label: 'Dashboard', icon: '📊' },
				{ href: `/${tenant?.slug}/pos`, label: 'Kasir (POS)', icon: '🧺' },
				{ href: `/${tenant?.slug}/orders`, label: 'Pesanan', icon: '📋' },
				{ href: `/${tenant?.slug}/customers`, label: 'Pelanggan', icon: '👥' },
				{ href: `/${tenant?.slug}/inventory`, label: 'Inventori', icon: '📦' },
				{ href: `/${tenant?.slug}/members`, label: 'Member', icon: '💎' },
				...(tenant?.role === 'admin' ? [
					{ href: `/${tenant?.slug}/reports`, label: 'Laporan', icon: '📈' },
					{ href: `/${tenant?.slug}/settings`, label: 'Pengaturan', icon: '⚙️' }
				] : [])
			] as link}
				<a href={link.href}
					onclick={() => mobileOpen = false}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
						{pathname === link.href ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'}"
				>
					<span class="text-base flex-shrink-0">{link.icon}</span>
					{#if !collapsed || sidebarExpanded || mobileOpen}
						<span class="truncate">{link.label}</span>
					{/if}
				</a>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="p-2 border-t border-gray-200">
			{#if collapsed && !sidebarExpanded && !mobileOpen}
				<div class="text-xs text-gray-400 text-center" title={session?.user?.email ?? ''}>@</div>
			{:else}
				<div class="text-xs text-gray-500 truncate">{session?.user?.email}</div>
				<a href="/auth/logout"
					class="mt-2 block rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 text-center hover:bg-gray-200 transition">
					Keluar
				</a>
			{/if}
		</div>
	</aside>

	<!-- Main content area -->
	<div class="flex-1 overflow-hidden">
		<!-- Mobile header bar with hamburger -->
		<div class="lg:hidden flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white">
			<button onclick={() => mobileOpen = true}
				class="text-gray-600 hover:text-green-600 p-1"
				aria-label="Buka sidebar">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<span class="text-sm font-semibold text-gray-700">{tenant?.nama_toko ?? 'LaundryIn'}</span>
		</div>
		{@render children()}
	</div>
</div>
