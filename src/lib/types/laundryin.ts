export interface Tenant {
	id: string;
	slug: string;
	nama: string;
	logo?: string;
	alamat?: string;
	nomor_hp?: string;
	email?: string;
	jam_operasional?: Record<string, { buka: string; tutup: string }>;
	paket: 'free' | 'starter' | 'pro';
	status: 'aktif' | 'trial' | 'suspend';
	created_at: string;
}

export interface TenantUser {
	id: string;
	tenant_id: string;
	email: string;
	nama: string;
	role: 'admin' | 'kasir' | 'driver';
	aktif: boolean;
	created_at: string;
}

export interface Customer {
	id: string;
	tenant_id: string;
	nama: string;
	nomor_hp: string;
	alamat?: string;
	member_id?: string;
	tier?: string;
	sisa_poin: number;
	total_belanja: number;
	created_at: string;
}

export interface Order {
	id: string;
	tenant_id: string;
	nomor_order: string;
	customer_id: string;
	status: OrderStatus;
	jalur: 'antar_sendiri' | 'jemput';
	berat_total: number;
	subtotal: number;
	diskon: number;
	total: number;
	status_bayar: 'lunas' | 'belum_lunas' | 'sebagian';
	waktu_bayar: 'awal' | 'akhir';
	estimasi_selesai?: string;
	catatan?: string;
	created_at: string;
	updated_at: string;
}

export type OrderStatus =
	| 'diterima'
	| 'menunggu_jemput'
	| 'dijemput_driver'
	| 'proses_cuci'
	| 'proses_kering'
	| 'setrika'
	| 'siap_diambil'
	| 'siap_diantar'
	| 'dalam_pengiriman'
	| 'terkirim'
	| 'selesai';

export interface OrderItem {
	id: string;
	order_id: string;
	layanan_id: string;
	nama_layanan: string;
	qty: number;
	satuan: 'kg' | 'piece' | 'set';
	harga_satuan: number;
	subtotal: number;
}

export interface Layanan {
	id: string;
	tenant_id: string;
	nama: string;
	satuan: 'kg' | 'piece' | 'set';
	harga: number;
	aktif: boolean;
	created_at: string;
}

export interface Payment {
	id: string;
	tenant_id: string;
	order_id: string;
	metode: 'tunai' | 'transfer' | 'gopay' | 'ovo' | 'dana' | 'shopeepay' | 'qris';
	nominal: number;
	status: 'lunas' | 'sebagian';
	bukti_url?: string;
	created_at: string;
}

export interface InventoryItem {
	id: string;
	tenant_id: string;
	nama: string;
	kategori: string;
	satuan: string;
	stok: number;
	stok_minimum: number;
	harga_beli: number;
	created_at: string;
}

export interface InventoryMovement {
	id: string;
	item_id: string;
	tipe: 'masuk' | 'keluar';
	qty: number;
	keterangan: string;
	created_at: string;
}

export interface Driver {
	id: string;
	tenant_id: string;
	nama: string;
	nomor_hp: string;
	status: 'aktif' | 'tidak_aktif';
	created_at: string;
}

export interface DeliverySchedule {
	id: string;
	tenant_id: string;
	order_id: string;
	driver_id?: string;
	alamat: string;
	tanggal: string;
	slot_waktu: 'pagi' | 'siang' | 'sore';
	tipe: 'jemput' | 'antar';
	status: 'terjadwal' | 'driver_berangkat' | 'dijemput' | 'tiba_di_laundry' | 'selesai';
	catatan?: string;
	created_at: string;
}

export interface DeliveryRoute {
	id: string;
	tenant_id: string;
	driver_id: string;
	tanggal: string;
	nama: string;
	stops: DeliveryRouteStop[];
	created_at: string;
}

export interface DeliveryRouteStop {
	order_id: string;
	alamat: string;
	urutan: number;
	latitude?: number;
	longitude?: number;
}

export interface Member {
	id: string;
	tenant_id: string;
	customer_id: string;
	nomor_member: string;
	tier: 'regular' | 'silver' | 'gold' | 'platinum';
	poin: number;
	kode_referral?: string;
	created_at: string;
}

export interface PointsLog {
	id: string;
	member_id: string;
	poin: number;
	tipe: 'masuk' | 'keluar';
	keterangan: string;
	created_at: string;
}

export interface NotificationLog {
	id: string;
	tenant_id: string;
	nomor_tujuan: string;
	template: string;
	pesan: string;
	status: 'terkirim' | 'gagal';
	created_at: string;
}

export interface Expense {
	id: string;
	tenant_id: string;
	kategori: 'bahan_baku' | 'operasional' | 'gaji' | 'perawatan_mesin' | 'transport' | 'lain_lain';
	nominal: number;
	keterangan?: string;
	bukti_url?: string;
	created_at: string;
}

export interface DailyCash {
	id: string;
	tenant_id: string;
	tanggal: string;
	saldo_awal: number;
	saldo_akhir: number;
	rekonsiliasi: boolean;
	created_at: string;
}

export interface Promo {
	id: string;
	tenant_id: string;
	nama: string;
	tipe: 'persen' | 'nominal';
	nilai: number;
	tier_target?: string[];
	tanggal_mulai: string;
	tanggal_selesai: string;
	aktif: boolean;
	created_at: string;
}
