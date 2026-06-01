<script lang="ts">
	import { dev } from '$app/environment';
</script>

<svelte:head>
	<title>LaundryIn — Kelola Laundry Anda, Dari Mana Saja</title>
</svelte:head>

<!-- Hero Section -->
<div class="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">

	<!-- Hero -->
	<section class="mx-auto max-w-7xl px-6 pt-20 pb-32">
		<div class="grid items-center gap-12 lg:grid-cols-2">
			<div>
				<h1 class="text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
					Kelola Laundry Anda,
					<span class="text-green-600">Dari Mana Saja</span>
				</h1>
				<p class="mt-6 text-lg leading-relaxed text-gray-600">
					Platform SaaS all-in-one untuk usaha laundry rumahan. POS, tracking order,
					pembukuan, inventori, dan notifikasi WhatsApp — tanpa ribet kelola server.
				</p>
				<div class="mt-8 flex flex-wrap gap-4">
					<a href="/auth/register"
						class="rounded-xl bg-green-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-200 hover:bg-green-700 transition">
						Coba Gratis
					</a>
					<a href="#fitur"
						class="rounded-xl border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition">
						Lihat Fitur
					</a>
				</div>
				<p class="mt-4 text-sm text-gray-400">Gratis selamanya untuk 2 user. Upgrade mulai Rp 49.000/bulan.</p>
			</div>
			<div class="hidden lg:block">
				<div class="rounded-2xl bg-gradient-to-br from-green-100 to-blue-100 p-8 shadow-xl">
					<div class="rounded-xl bg-white p-6 shadow-inner">
						<div class="mb-4 flex items-center justify-between border-b pb-3">
							<span class="text-sm font-medium text-gray-600">🧺 Transaksi Baru</span>
							<span class="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">POS</span>
						</div>
						<div class="space-y-3">
							<div class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
								<span class="text-sm font-medium text-gray-700">Cuci Kering</span>
								<span class="text-sm text-gray-500">2.5 kg × Rp 5.000</span>
							</div>
							<div class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
								<span class="text-sm font-medium text-gray-700">Setrika</span>
								<span class="text-sm text-gray-500">2.5 kg × Rp 3.000</span>
							</div>
							<div class="flex items-center justify-between border-t pt-3 font-semibold">
								<span class="text-sm text-gray-700">Total</span>
								<span class="text-lg text-green-600">Rp 20.000</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Fitur -->
	<section id="fitur" class="bg-white py-24">
		<div class="mx-auto max-w-7xl px-6">
			<div class="text-center">
				<h2 class="text-3xl font-bold text-gray-900">Semua yang Anda Butuhkan</h2>
				<p class="mt-4 text-lg text-gray-600">Satu platform untuk seluruh operasional laundry Anda</p>
			</div>
			<div class="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
				{#each fitur as item}
					<div class="rounded-xl border border-gray-100 bg-gray-50/50 p-6 transition hover:border-green-200 hover:shadow-md">
						<div class="mb-4 text-2xl">{item.icon}</div>
						<h3 class="text-lg font-semibold text-gray-900">{item.judul}</h3>
						<p class="mt-2 text-sm leading-relaxed text-gray-600">{item.deskripsi}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Harga -->
	<section id="harga" class="bg-gradient-to-b from-white to-green-50 py-24">
		<div class="mx-auto max-w-7xl px-6">
			<div class="text-center">
				<h2 class="text-3xl font-bold text-gray-900">Pilih Paket yang Tepat</h2>
				<p class="mt-4 text-lg text-gray-600">Mulai gratis, upgrade saat usaha berkembang</p>
			</div>
			<div class="mt-16 grid gap-8 md:grid-cols-3">
				{#each paket as p, i}
					<div class="rounded-2xl border p-8 {i === 1 ? 'border-green-500 bg-white shadow-xl shadow-green-100 ring-2 ring-green-500' : 'border-gray-200 bg-white'}">
						{#if i === 1}
							<span class="mb-4 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Terpopuler</span>
						{/if}
						<h3 class="text-xl font-bold text-gray-900">{p.nama}</h3>
						<div class="mt-4">
							<span class="text-4xl font-bold text-gray-900">{p.harga}</span>
							<span class="text-sm text-gray-500">/bulan</span>
						</div>
						<ul class="mt-6 space-y-3">
							{#each p.fitur as f}
								<li class="flex items-start gap-2 text-sm text-gray-600">
									<span class="mt-0.5 text-green-500">✓</span>
									{f}
								</li>
							{/each}
						</ul>
						<a href="/auth/register"
							class="mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition {i === 1 ? 'bg-green-600 text-white hover:bg-green-700' : 'border border-gray-300 text-gray-700 hover:border-gray-400'}">
							{#if i === 0}
								Mulai Gratis
							{:else if i === 1}
								Mulai Trial
							{:else}
								Hubungi Kami
							{/if}
						</a>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="bg-gray-900 py-12 text-gray-400">
		<div class="mx-auto max-w-7xl px-6 text-center text-sm">
			<p class="font-semibold text-white">© 2026 LaundryIn</p>
			<p class="mt-2">Kelola Laundry Anda, Dari Mana Saja</p>
		</div>
	</footer>
</div>

<script lang="ts" module>
	const fitur = [
		{ icon: '🧺', judul: 'Point of Sale (POS)', deskripsi: 'Input order cepat dengan autocomplete pelanggan, hitung otomatis, dan cetak nota.' },
		{ icon: '📋', judul: 'Tracking Order', deskripsi: 'Pantau status cucian real-time dari diterima hingga selesai dengan badge warna.' },
		{ icon: '📊', judul: 'Laporan Keuangan', deskripsi: 'Laporan harian, mingguan, bulanan, dan laba rugi otomatis dari setiap transaksi.' },
		{ icon: '📦', judul: 'Manajemen Inventori', deskripsi: 'Catat stok deterjen, pewangi, dan perlengkapan. Alert stok menipis.' },
		{ icon: '🚚', judul: 'Antar Jemput', deskripsi: 'Jadwalkan pickup & delivery, optimasi rute driver, notifikasi WA otomatis.' },
		{ icon: '💬', judul: 'Notifikasi WhatsApp', deskripsi: 'Pelanggan dapat update otomatis via WA: order diterima, siap, diantar.' },
		{ icon: '💎', judul: 'Membership & Poin', deskripsi: 'Program loyalitas dengan tier member dan sistem poin untuk retention pelanggan.' },
		{ icon: '📱', judul: 'Mobile-first PWA', deskripsi: 'Install ke home screen HP. Bisa dipakai dari mana saja, offline mode terbatas.' },
		{ icon: '🔒', judul: 'Multi-Tenant Aman', deskripsi: 'Setiap toko punya workspace terisolasi dengan Supabase RLS. Data aman.' },
	];

	const paket = [
		{
			nama: 'Free',
			harga: 'Gratis',
			fitur: ['Maks 2 user', 'POS & tracking order', 'Laporan harian', 'Inventori dasar', 'Notifikasi WA (GoWA sendiri)', 'Banner "Powered by LaundryIn"']
		},
		{
			nama: 'Starter',
			harga: 'Rp 49.000',
			fitur: ['Maks 5 user', 'Semua fitur Free', 'Laporan mingguan & bulanan', 'Laporan laba rugi', 'Membership & poin', 'Jadwal antar jemput', 'Export Excel & PDF', 'GoWA support']
		},
		{
			nama: 'Pro',
			harga: 'Rp 99.000',
			fitur: ['Unlimited user', 'Semua fitur Starter', 'Optimasi rute driver', 'Multi-cabang', 'Custom domain', 'White label / branding', 'Priority support', 'Tanpa banner LaundryIn']
		}
	];
</script>
