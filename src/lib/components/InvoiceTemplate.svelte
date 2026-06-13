<script lang="ts">
	import { formatRupiah, formatTanggal } from '$lib/utils/format';

	interface InvoiceTenant {
		nama: string;
		alamat?: string;
		phone?: string;
	}

	interface InvoiceCustomer {
		nama: string;
		phone?: string;
		alamat?: string;
	}

	interface InvoiceItem {
		nama: string;
		qty: number;
		satuan: string;
		harga: number;
		subtotal: number;
	}

	interface InvoiceOrder {
		nomor_order: string;
		tanggal: string;
		subtotal: number;
		diskon: number;
		total: number;
		status_bayar: string;
		metode_bayar: string;
	}

	let {
		tenant,
		order,
		customer,
		items
	}: {
		tenant: InvoiceTenant;
		order: InvoiceOrder;
		customer: InvoiceCustomer;
		items: InvoiceItem[];
	} = $props();
</script>

<div class="invoice-template w-[300px] bg-white font-mono text-[11px] leading-tight text-gray-900 p-4">
	<!-- Tenant Header -->
	<div class="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
		<h1 class="text-sm font-bold uppercase tracking-wide">{tenant.nama}</h1>
		{#if tenant.alamat}
			<p class="text-[10px] text-gray-600 mt-0.5">{tenant.alamat}</p>
		{/if}
		{#if tenant.phone}
			<p class="text-[10px] text-gray-600">Telp: {tenant.phone}</p>
		{/if}
	</div>

	<!-- Order Info -->
	<div class="space-y-0.5 mb-2 text-[10px]">
		<div class="flex justify-between">
			<span class="text-gray-600">No. Order</span>
			<span class="font-semibold">{order.nomor_order}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-gray-600">Tanggal</span>
			<span>{formatTanggal(order.tanggal)}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-gray-600">Pelanggan</span>
			<span class="font-medium">{customer.nama}</span>
		</div>
		{#if customer.phone}
			<div class="flex justify-between">
				<span class="text-gray-600">HP</span>
				<span>{customer.phone}</span>
			</div>
		{/if}
		{#if customer.alamat}
			<div>
				<span class="text-gray-600">Alamat:</span>
				<span class="ml-1">{customer.alamat}</span>
			</div>
		{/if}
	</div>

	<!-- Items Table -->
	<div class="border-t border-dashed border-gray-300 pt-2 mb-2">
		<div class="grid grid-cols-[1fr_auto_auto] gap-x-2 text-[10px] font-semibold text-gray-500 uppercase pb-1 border-b border-gray-200">
			<span>Layanan</span>
			<span class="text-right">Qty</span>
			<span class="text-right">Subtotal</span>
		</div>
		<div class="space-y-0.5 mt-0.5">
			{#each items as item}
				<div class="grid grid-cols-[1fr_auto_auto] gap-x-2 text-[10px]">
					<span class="truncate">{item.nama}</span>
					<span class="text-right">{item.qty} {item.satuan}</span>
					<span class="text-right">{formatRupiah(item.subtotal)}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Totals -->
	<div class="border-t border-dashed border-gray-300 pt-2 space-y-0.5 mb-2 text-[10px]">
		<div class="flex justify-between">
			<span class="text-gray-600">Subtotal</span>
			<span>{formatRupiah(order.subtotal)}</span>
		</div>
		{#if order.diskon > 0}
			<div class="flex justify-between">
				<span class="text-gray-600">Diskon</span>
				<span>-{formatRupiah(order.diskon)}</span>
			</div>
		{/if}
		<div class="flex justify-between font-bold text-xs border-t border-gray-200 pt-1 mt-1">
			<span>TOTAL</span>
			<span>{formatRupiah(order.total)}</span>
		</div>
	</div>

	<!-- Payment Info -->
	<div class="border-t border-dashed border-gray-300 pt-2 text-[10px] space-y-0.5">
		<div class="flex justify-between">
			<span class="text-gray-600">Metode Bayar</span>
			<span class="font-medium capitalize">{order.metode_bayar}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-gray-600">Status Bayar</span>
			<span class="font-medium capitalize">{order.status_bayar.replace('_', ' ')}</span>
		</div>
	</div>

	<!-- Footer -->
	<div class="text-center border-t border-dashed border-gray-300 pt-2 mt-2">
		<p class="text-[9px] text-gray-400">Terima kasih telah menggunakan jasa kami</p>
		<p class="text-[9px] text-gray-500 mt-0.5">Powered by LaundryIn</p>
	</div>
</div>
