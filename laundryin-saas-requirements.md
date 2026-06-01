# 📋 Software Requirements Document
## LaundryIn — SaaS Platform Manajemen Laundry

**Versi:** 1.0.0  
**Tanggal:** 22 Mei 2026  
**Produk:** LaundryIn  
**Tagline:** *Kelola Laundry Anda, Dari Mana Saja*  
**Demo / Pilot:** Gevana Laundry — Pondok Benda, Pamulang  
**Target Pasar:** Laundry rumahan kecil (1–2 karyawan), Indonesia  

---

## 📑 Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Model Bisnis SaaS](#2-model-bisnis-saas)
3. [Arsitektur Multi-Tenant](#3-arsitektur-multi-tenant)
4. [Pengguna Sistem](#4-pengguna-sistem)
5. [Modul 1 – Onboarding Tenant](#5-modul-1--onboarding-tenant)
6. [Modul 2 – Point of Sale (POS)](#6-modul-2--point-of-sale-pos)
7. [Modul 3 – Manajemen Order](#7-modul-3--manajemen-order)
8. [Modul 4 – Pembukuan & Akuntansi](#8-modul-4--pembukuan--akuntansi)
9. [Modul 5 – Inventori](#9-modul-5--inventori)
10. [Modul 6 – Jadwal Antar Jemput](#10-modul-6--jadwal-antar-jemput)
11. [Modul 7 – Integrasi WhatsApp (GoWA)](#11-modul-7--integrasi-whatsapp-gowa)
12. [Modul 8 – Pembayaran Digital](#12-modul-8--pembayaran-digital)
13. [Modul 9 – Membership & Loyalitas](#13-modul-9--membership--loyalitas)
14. [Modul 10 – Super Admin Dashboard](#14-modul-10--super-admin-dashboard)
15. [Kebutuhan Non-Fungsional](#15-kebutuhan-non-fungsional)
16. [Arsitektur & Tech Stack](#16-arsitektur--tech-stack)
17. [Prioritas Pengembangan](#17-prioritas-pengembangan)
18. [Catatan Tambahan](#18-catatan-tambahan)

---

## 1. Gambaran Umum

### 1.1 Tentang LaundryIn
LaundryIn adalah platform SaaS (Software as a Service) berbasis web yang menyediakan sistem manajemen operasional lengkap untuk usaha laundry rumahan kecil di Indonesia. Setiap laundry yang mendaftar mendapatkan workspace sendiri (tenant) yang terisolasi, lengkap dengan POS, tracking order, pembukuan, inventori, jadwal antar jemput, dan notifikasi WhatsApp otomatis.

### 1.2 Proposisi Nilai
- **Untuk pemilik laundry:** Tidak perlu beli software mahal, tidak perlu kelola server, langsung pakai dari HP
- **Gratis untuk mulai:** Paket Free cukup untuk laundry rumahan kecil
- **All-in-one:** POS + order tracking + keuangan + WA notifikasi dalam satu platform
- **Mobile-first PWA:** Bisa di-install ke home screen HP, terasa seperti aplikasi native

### 1.3 Demo & Showcase
**Gevana Laundry** (Pondok Benda, Pamulang) adalah tenant demo resmi LaundryIn — digunakan sebagai:
- Akun showcase untuk calon pelanggan baru
- Pilot testing fitur-fitur baru sebelum dirilis
- Konten marketing (screenshot, video tutorial, testimoni)
- Akun demo gratis yang bisa diakses publik (read-only atau data dummy)

---

## 2. Model Bisnis SaaS

### 2.1 Struktur Paket

| Fitur | 🆓 Free | 💼 Starter | 🚀 Pro |
|-------|---------|-----------|-------|
| **Harga** | Gratis selamanya | Rp 49.000/bulan | Rp 99.000/bulan |
| **Jumlah User** | Maks 2 user | Maks 5 user | Unlimited |
| **POS & Order Tracking** | ✅ | ✅ | ✅ |
| **Notifikasi WhatsApp** | ✅ (butuh GoWA sendiri) | ✅ | ✅ |
| **Pembayaran (tunai & transfer)** | ✅ | ✅ | ✅ |
| **Inventori Dasar** | ✅ | ✅ | ✅ |
| **Laporan Harian** | ✅ | ✅ | ✅ |
| **Laporan Mingguan & Bulanan** | ❌ | ✅ | ✅ |
| **Laporan Laba Rugi** | ❌ | ✅ | ✅ |
| **Modul Membership & Poin** | ❌ | ✅ | ✅ |
| **Jadwal Antar Jemput** | ❌ | ✅ | ✅ |
| **Optimasi Rute Driver** | ❌ | ❌ | ✅ |
| **Multi-cabang** | ❌ | ❌ | ✅ |
| **Export Excel & PDF** | ❌ | ✅ | ✅ |
| **Custom Domain** | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ |
| **Branding / White Label** | ❌ | ❌ | ✅ |

### 2.2 Batasan Paket Free
- Maksimal **2 user** (Admin + 1 Kasir/Operator)
- **Fitur terbatas:** tanpa laporan lanjutan (mingguan/bulanan/laba rugi), tanpa modul membership, tanpa jadwal antar jemput
- Tidak ada batas jumlah order atau pelanggan
- GoWA untuk notifikasi WhatsApp harus setup sendiri oleh tenant
- Banner "Powered by LaundryIn" muncul di nota digital

### 2.3 Upgrade & Billing
- Upgrade paket langsung dari dashboard tenant
- Pembayaran via transfer bank / dompet digital (GoPay, OVO, Dana)
- Siklus billing: bulanan atau tahunan (diskon 20% untuk tahunan)
- Grace period 7 hari jika pembayaran terlambat sebelum fitur premium dikunci
- Downgrade ke Free diperbolehkan kapan saja, data tetap tersimpan

---

## 3. Arsitektur Multi-Tenant

### 3.1 Konsep Multi-Tenancy
Setiap laundry yang mendaftar adalah satu **tenant** yang memiliki:
- Subdomain unik: `namatoko.laundryin.id` (atau custom domain untuk paket Pro)
- Data yang sepenuhnya terisolasi dari tenant lain
- Konfigurasi sendiri: nama toko, logo, harga layanan, rekening pembayaran

### 3.2 Isolasi Data (Supabase Row Level Security)
```
Tabel utama memiliki kolom: tenant_id (UUID)

RLS Policy:
- Setiap query otomatis difilter berdasarkan tenant_id dari session user
- Tidak ada tenant yang bisa membaca data tenant lain
- Super Admin (LaundryIn) dapat mengakses semua tenant untuk keperluan support
```

### 3.3 Subdomain & Routing
```
laundryin.id              → Landing page & marketing
app.laundryin.id          → Login & onboarding
gevana.laundryin.id       → Tenant: Gevana Laundry (demo)
[slug].laundryin.id       → Tenant lainnya
```

---

## 4. Pengguna Sistem

### 4.1 Role per Tenant (3 Role)

| Role | Deskripsi | Akses Modul |
|------|-----------|-------------|
| **Admin / Pemilik** | Akses penuh ke semua fitur tenant | Semua modul + pengaturan tenant + billing |
| **Kasir / Operator** | Input order, transaksi, update status cucian | POS, Order, Pembayaran, Inventori (lihat) |
| **Driver** | Lihat jadwal & konfirmasi pickup/delivery | Antar Jemput (mobile view) |

> Paket Free hanya mendukung 2 user: 1 Admin + 1 Kasir/Operator. Role Driver tidak tersedia di paket Free.

### 4.2 Super Admin LaundryIn (Platform Level)

| Role | Deskripsi |
|------|-----------|
| **Super Admin** | Kelola semua tenant, lihat metrik platform, kelola billing, akses demo Gevana |

---

## 5. Modul 1 – Onboarding Tenant

### 5.1 Deskripsi
Proses pendaftaran dan setup awal bagi laundry baru yang ingin menggunakan LaundryIn.

### 5.2 Alur Onboarding

```
[Daftar di laundryin.id]
        ↓
[Input: nama toko, nama pemilik, nomor HP, email, password]
        ↓
[Pilih paket: Free / Starter / Pro]
        ↓
[Setup toko: logo (opsional), alamat, jam operasional]
        ↓
[Setup layanan & harga (atau pakai template default)]
        ↓
[Setup rekening pembayaran]
        ↓
[Workspace siap → redirect ke [slug].laundryin.id]
```

### 5.3 Fitur Wajib

#### F-ONB-01: Registrasi Tenant
- Form registrasi: nama toko, slug (auto-generate dari nama toko, bisa diubah), nama pemilik, email, nomor HP, password
- Validasi slug unik di seluruh platform
- Verifikasi nomor HP via OTP WhatsApp (menggunakan GoWA platform LaundryIn)
- Setelah verifikasi → workspace otomatis dibuat

#### F-ONB-02: Setup Wizard (5 Langkah)
1. **Profil Toko** — nama, logo, alamat, jam buka
2. **Layanan & Harga** — template default tersedia (bisa langsung lanjut atau kustomisasi)
3. **Rekening Pembayaran** — bank & dompet digital
4. **Koneksi WhatsApp** — input konfigurasi GoWA sendiri (panduan tersedia), atau skip untuk setup nanti
5. **Undang User** — tambah Kasir/Operator (opsional, bisa skip)

#### F-ONB-03: Template Default Layanan
Saat onboarding, tenant dapat pilih template industri laundry:
```
✅ Template "Laundry Kiloan Standar":
   - Cuci Kering: Rp 5.000/kg
   - Cuci Basah: Rp 5.000/kg
   - Cuci, Kering, Setrika: Rp 7.000/kg
   - Cuci Ekspres: Rp 9.000/kg
```
Semua harga dapat diubah sesuai kebutuhan masing-masing tenant.

#### F-ONB-04: Demo Mode (Gevana Laundry)
- Tombol "Coba Demo" di landing page → masuk ke workspace Gevana Laundry dengan data dummy
- Demo bersifat read-only atau reset setiap 24 jam
- Banner "Ini adalah akun demo LaundryIn" tampil di semua halaman demo

---

## 6. Modul 2 – Point of Sale (POS)

### 6.1 Deskripsi
Modul kasir untuk mencatat transaksi masuk, menghitung total biaya, dan menerbitkan nota kepada pelanggan. Dikonfigurasi per tenant (harga, layanan, rekening berbeda tiap laundry).

### 6.2 Fitur Wajib

#### F-POS-01: Input Transaksi Baru

**Pencarian / Input Pelanggan (Combobox Autocomplete):**
- Field nama pelanggan berupa **combobox** — kasir mulai ketik nama atau nomor HP
- Dropdown suggestion muncul real-time dari database pelanggan tenant tersebut (minimal 2 karakter)
- Setiap item dropdown menampilkan: nama, nomor HP, dan badge tier member (jika ada)
- **Jika pelanggan ditemukan & dipilih dari dropdown:**
  - Data pelanggan terisi otomatis (nama, nomor HP, alamat tersimpan)
  - Jika terdaftar member → diskon tier aktif otomatis
  - Riwayat order terakhir ditampilkan sebagai referensi kasir
- **Jika pelanggan belum terdaftar:**
  - Dropdown tampilkan opsi **"+ Tambah '[nama]' sebagai pelanggan baru"**
  - Form singkat: nama lengkap, nomor HP (wajib), alamat (opsional)
  - Tersimpan otomatis ke database tenant saat order dikonfirmasi
  - Default bukan member — kasir dapat langsung tawarkan daftar member

**Lanjutan Input Order:**
- Pilih jenis layanan (bisa lebih dari satu jenis dalam satu order)
- Input berat cucian (kg) — bisa desimal, misal 2.5 kg
- Sistem otomatis hitung total biaya berdasarkan harga yang dikonfigurasi tenant
- Diskon member diterapkan otomatis sesuai tier (jika modul membership aktif)
- **Waktu Pembayaran** *(wajib dipilih)*:
  - **Bayar di Awal** — bayar langsung saat antar cucian
  - **Bayar di Akhir** — bayar saat cucian selesai diambil/diantar
- **Opsi Penjemputan** *(default: TIDAK)*:
  - Jika "Ya, Minta Jemput" → form request penjemputan (lihat F-DEL-01)
  - Jika tidak → order langsung diproses tanpa jadwal driver

#### F-POS-02: Nota / Struk
- Generate nota dengan nomor unik per tenant (format: `[SLUG]-YYYYMMDD-XXX`)
- Nota memuat: nama & logo toko, nama pelanggan, jenis layanan, berat, harga satuan, subtotal, diskon, total, metode pembayaran, estimasi selesai, status bayar
- Cetak ke printer thermal (58mm / 80mm) atau simpan sebagai PDF
- Kirim nota digital otomatis ke WhatsApp pelanggan
- Footer nota: "Powered by LaundryIn" (untuk paket Free)

#### F-POS-03: Manajemen Layanan & Harga (per Tenant)
- Admin tenant dapat tambah, ubah, nonaktifkan layanan
- Harga per kg atau harga flat per item (fleksibel)
- Satuan: per kg, per piece, per set

#### F-POS-04: Promo & Diskon
- Admin buat promo terbatas: diskon % atau nominal, rentang tanggal berlaku
- Promo dapat dikhususkan untuk tier member tertentu

### 6.3 Aturan Bisnis
- Berat minimum order: 1 kg (dapat dikonfigurasi per tenant)
- Nota dicetak/dikirim segera setelah order dibuat
- Order dengan "Bayar di Akhir" ditandai badge `Belum Lunas` di dashboard
- Kasir tidak dapat close order ke `Selesai` jika masih `Belum Lunas` (kecuali Admin izinkan)
- Default mode: pelanggan antar sendiri, penjemputan harus diminta eksplisit

---

## 7. Modul 3 – Manajemen Order

### 7.1 Deskripsi
Modul tracking status seluruh order dari masuk hingga selesai, dengan dua jalur berbeda tergantung apakah pelanggan meminta penjemputan atau tidak.

### 7.2 Alur Status Order

**Jalur A – Pelanggan Antar Sendiri (Default)**
```
[DITERIMA] → [PROSES CUCI] → [PROSES KERING] → [SETRIKA*] → [SIAP DIAMBIL] → [SELESAI]
```

**Jalur B – Request Penjemputan**
```
[MENUNGGU JEMPUT] → [DIJEMPUT DRIVER] → [DITERIMA] → [PROSES CUCI] → [PROSES KERING] → [SETRIKA*]
                                                                                               ↓
                                                                                  [SIAP DIANTAR / DIAMBIL]
                                                                                       ↓           ↓
                                                                            [DALAM PENGIRIMAN]  [SELESAI]
                                                                                       ↓
                                                                                  [TERKIRIM]
```
> *Setrika hanya untuk layanan "Cuci, Kering, Setrika"

### 7.3 Fitur Wajib

#### F-ORD-01: Dashboard Order
- Tampilkan semua order aktif (kanban atau tabel, bisa toggle)
- Filter: status, tanggal masuk, jenis layanan, status bayar
- Cari: nomor order, nama pelanggan, nomor HP
- Badge warna: merah = terlambat, kuning = proses, hijau = siap, abu = menunggu jemput
- Badge `Belum Lunas` untuk order yang belum dibayar

#### F-ORD-02: Update Status Order
- Update status dengan satu klik
- Setiap perubahan dicatat: waktu + nama user
- Notifikasi WhatsApp otomatis per perubahan status:
  - **Jalur A:** Diterima → Siap Diambil
  - **Jalur B:** Menunggu Jemput → Dijemput → Diterima → Siap Diantar → Dalam Pengiriman → Terkirim

#### F-ORD-03: Estimasi Waktu
- Normal: +1 hari kerja dari jam masuk
- Ekspres: +4 jam dari jam masuk
- Admin dapat ubah estimasi manual per order
- Alert otomatis jika order melewati estimasi

#### F-ORD-04: Label Cucian
- Generate label untuk plastik cucian: nomor order, nama, layanan, tanggal masuk, estimasi selesai
- Cetak atau tampilkan QR code untuk scan update status

#### F-ORD-05: Riwayat Order
- Arsip semua order selesai, filter by tanggal/pelanggan/layanan
- Export ke Excel / PDF *(Starter & Pro)*

---

## 8. Modul 4 – Pembukuan & Akuntansi
*(Tersedia: Laporan Harian → Free | Laporan Lanjutan → Starter & Pro)*

### 8.1 Fitur Wajib

#### F-ACC-01: Pencatatan Pemasukan
- Setiap transaksi POS otomatis tercatat sebagai pemasukan per tenant
- Input pemasukan manual

#### F-ACC-02: Pencatatan Pengeluaran
- Kategori: bahan baku, operasional, gaji, perawatan mesin, transport, lain-lain
- Upload bukti pengeluaran (foto struk)

#### F-ACC-03: Laporan Keuangan
- **Laporan Harian** *(Free, Starter, Pro)*: total pemasukan, pengeluaran, laba bersih
- **Laporan Mingguan & Bulanan** *(Starter & Pro)*: tren grafik, perbandingan antar bulan
- **Laporan Laba Rugi** *(Starter & Pro)*: ringkasan per periode
- Export PDF & Excel *(Starter & Pro)*

#### F-ACC-04: Kas Harian
- Saldo kas awal, rekap masuk/keluar, saldo akhir
- Rekonsiliasi sistem vs kas fisik

#### F-ACC-05: Piutang
- Catat order belum lunas
- Notifikasi WA otomatis untuk tagihan jatuh tempo
- Tandai lunas

---

## 9. Modul 5 – Inventori

### 9.1 Fitur Wajib

#### F-INV-01: Manajemen Stok
- Tambah item: nama, kategori, satuan, stok awal, stok minimum
- Update stok masuk (pembelian) & keluar (pemakaian)
- Riwayat mutasi stok per item

#### F-INV-02: Alert Stok Menipis
- Notifikasi dashboard & WhatsApp ke admin jika stok di bawah minimum

#### F-INV-03: Laporan Inventori
- Stok snapshot per tanggal
- Pemakaian bulanan per item
- Nilai stok (stok × harga beli terakhir)

---

## 10. Modul 6 – Jadwal Antar Jemput
*(Tersedia: Starter & Pro | Optimasi Rute: Pro)*

### 10.1 Deskripsi
Modul penjemputan bersifat **opsional per order** (default OFF). Setiap request penjemputan akan digabungkan ke rute driver yang sudah ada, atau membuat rute baru jika tidak ada yang cocok.

### 10.2 Alur Request Penjemputan

```
[Pelanggan/Kasir request jemput]
          ↓
[Sistem cek rute aktif di area & slot waktu yang sama]
          ↓
   ┌──────┴──────┐
[Ada rute cocok] [Tidak ada rute]
      ↓                ↓
[Tambah ke        [Buat rute baru]
 rute existing]        ↓
      ↓          [Assign driver tersedia]
[Konfirmasi jadwal ke pelanggan via WA]
```

### 10.3 Fitur Wajib

#### F-DEL-01: Request Penjemputan
- Toggle "Minta Jemput" di form order — **default OFF**
- Jika aktif: input alamat, pilih tanggal & slot waktu (Pagi/Siang/Sore), catatan untuk driver
- Estimasi biaya jemput (gratis jika area layanan tenant, berbayar jika di luar)

#### F-DEL-02: Logika Penugasan Rute
1. Cari rute aktif di hari & slot waktu yang sama
2. Jika alamat dalam radius ≤ 2 km dari rute → gabungkan ke rute existing
3. Jika tidak ada → buat rute baru, assign ke driver tersedia
4. Jika tidak ada driver → status "Menunggu Konfirmasi Admin", admin assign manual
- Admin dapat override penugasan kapan saja

#### F-DEL-03: Dashboard Jadwal Driver
- Tugas hari ini & besok, dikelompokkan per driver & slot waktu
- Status: Terjadwal → Driver Berangkat → Dijemput → Tiba di Laundry
- Peta titik pickup/delivery (Leaflet.js + OpenStreetMap)

#### F-DEL-04: Manajemen Rute
- Urutan stop dapat diubah manual (drag & drop)
- Tombol "Optimalkan Rute" *(Pro)* — susun ulang berdasarkan jarak terdekat
- Cetak / ekspor daftar rute harian untuk driver

#### F-DEL-05: Tampilan Driver (Mobile)
- Daftar tugas hari ini: urutan stop, alamat, nama pelanggan, catatan
- Navigasi Google Maps per titik stop (satu klik)
- Tombol: "Mulai Perjalanan" / "Sudah Dijemput" / "Tiba di Laundry"

#### F-DEL-06: Manajemen Driver
- Daftarkan driver: nama, nomor HP, status aktif
- Jadwal ketersediaan driver per hari & slot waktu

#### F-DEL-07: Notifikasi WA Otomatis
- Request diterima, rute assigned, H-1 pengingat, driver berangkat, dijemput, diantar

### 10.4 Aturan Bisnis
- Default setiap order: tanpa penjemputan
- Maks 10 stop per trip (dapat dikonfigurasi Admin)
- Alert jika request jemput tidak tertangani > 2 jam

---

## 11. Modul 7 – Integrasi WhatsApp (GoWA)

### 11.1 Deskripsi
Setiap tenant menghubungkan akun GoWA milik sendiri (nomor HP sendiri) ke platform LaundryIn. LaundryIn hanya sebagai pengirim perintah, GoWA tenant yang mengirim pesan.

### 11.2 Konfigurasi per Tenant
- Admin tenant input: URL server GoWA, nomor HP, API token
- Test koneksi dari dashboard
- Status koneksi real-time

### 11.3 Template Pesan (dapat dikustomisasi per tenant)

| Trigger | Deskripsi Pesan |
|---------|----------------|
| Order baru diterima | Konfirmasi + nomor order + estimasi selesai |
| Siap diambil | Cucian selesai, silakan diambil |
| Menunggu jemput | Konfirmasi request + info jadwal driver |
| Driver berangkat | Driver menuju lokasi pelanggan |
| Dijemput | Cucian berhasil dijemput |
| Siap diantar | Cucian selesai, akan segera diantar |
| Dalam pengiriman | Driver sedang mengantar |
| Terkirim | Cucian sudah diterima |
| Tagihan jatuh tempo | Pengingat pembayaran |
| Upgrade tier member | Selamat naik tier |
| OTP registrasi tenant | Kode verifikasi pendaftaran (via GoWA LaundryIn) |

### 11.4 Log Pesan
- Riwayat semua pesan: waktu, nomor tujuan, status (terkirim/gagal)
- Retry otomatis jika gagal (maks 3x)

---

## 12. Modul 8 – Pembayaran Digital

### 12.1 Metode Pembayaran yang Didukung (per Tenant)

| Metode | Status |
|--------|--------|
| Tunai | ✅ Aktif |
| Transfer Bank (BCA, Mandiri, BRI, BNI) | ✅ Aktif |
| GoPay, OVO, Dana, ShopeePay | ✅ Aktif |
| QRIS | 🔄 Riset |

### 12.2 Fitur Wajib

#### F-PAY-01: Pencatatan Pembayaran
- Kasir pilih waktu bayar saat input order:
  - **Bayar di Awal** → pilih metode & konfirmasi nominal langsung
  - **Bayar di Akhir** → order tersimpan `Belum Lunas`, dikonfirmasi nanti
- Status: `Lunas` / `Belum Lunas` / `Sebagian`
- Badge `Belum Lunas` di dashboard order
- Order tidak bisa `Selesai` jika masih `Belum Lunas` (kecuali Admin izinkan)

#### F-PAY-02: Rekening & Dompet Digital (per Tenant)
- Admin tenant input rekening bank & nomor dompet digital sendiri
- Ditampilkan di nota & pesan WA untuk instruksi transfer

#### F-PAY-03: Konfirmasi Transfer Manual
- Pelanggan kirim bukti transfer via WA
- Kasir upload foto bukti & tandai `Lunas`
- Notifikasi WA konfirmasi ke pelanggan

#### F-PAY-04: Rekap Pembayaran Harian
- Total per metode pembayaran per hari
- Rekonsiliasi sistem vs saldo aktual

---

## 13. Modul 9 – Membership & Loyalitas
*(Tersedia: Starter & Pro)*

### 13.1 Tingkatan Member (Tier) — dapat dikonfigurasi per tenant

| Tier | Default Syarat | Default Keuntungan |
|------|---------------|-------------------|
| 🥉 Regular | Daftar gratis | Diskon 10% |
| 🥈 Silver | Total belanja Rp 500.000 | Diskon 12% + prioritas ekspres |
| 🥇 Gold | Total belanja Rp 1.500.000 | Diskon 15% + antar jemput gratis |
| 💎 Platinum | Total belanja Rp 3.000.000 | Diskon 20% + semua keuntungan Gold |

### 13.2 Sistem Poin

| Aksi | Poin |
|------|------|
| Transaksi Rp 10.000 | +1 poin |
| Ulang tahun | +50 poin |
| Referral | +25 poin |
| Review/testimoni | +10 poin |

**Penukaran Poin:**
- 50 poin → gratis cuci 1 kg
- 100 poin → diskon Rp 5.000
- 200 poin → gratis antar jemput 1x

### 13.3 Fitur Wajib

#### F-MEM-01: Pendaftaran Member
- Dari POS saat input order
- Nomor member unik per tenant (format: `[SLUG]-MEM-XXXX`)
- Kartu member digital dikirim via WhatsApp

#### F-MEM-02: Identifikasi Member saat Transaksi
- Combobox pelanggan otomatis tampilkan tier & sisa poin
- Diskon tier otomatis aktif
- Kasir tanya: "Gunakan poin?" sebelum checkout

#### F-MEM-03: Manajemen Poin
- Poin bertambah otomatis setelah transaksi lunas
- Input poin manual (bonus/koreksi) oleh admin
- Riwayat poin masuk & keluar per member

#### F-MEM-04: Upgrade Tier Otomatis
- Cek total belanja kumulatif setiap transaksi selesai
- Upgrade otomatis + notifikasi WA selamat
- Tier tidak turun (berlaku seumur hidup)

#### F-MEM-05: Program Referral
- Setiap member punya kode referral unik
- Pemberi referral: +25 poin
- Pelanggan baru via referral: diskon 5% transaksi pertama

#### F-MEM-06: Promo Eksklusif Member
- Admin buat promo per tier, per tanggal, per hari tertentu

#### F-MEM-07: Dashboard & Laporan Membership
- Total member per tier, grafik pertumbuhan
- Member loyal, poin beredar, member tidak aktif > 30 hari
- Export Excel/PDF

---

## 14. Modul 10 – Super Admin Dashboard
*(Hanya untuk tim LaundryIn — platform level)*

### 14.1 Deskripsi
Dashboard khusus untuk tim LaundryIn untuk memantau dan mengelola seluruh platform, tenant, dan metrik bisnis SaaS.

### 14.2 Fitur Wajib

#### F-SA-01: Manajemen Tenant
- Daftar semua tenant: nama toko, pemilik, paket aktif, tanggal daftar, status (aktif/trial/suspend)
- Lihat detail tenant: jumlah order, jumlah user, penggunaan storage
- Suspend / reaktivasi tenant
- Akses masuk ke workspace tenant (untuk keperluan support)

#### F-SA-02: Metrik Platform (SaaS Metrics)
- Total tenant terdaftar & aktif
- MRR (Monthly Recurring Revenue) & ARR
- Churn rate bulanan
- Konversi Free → Starter → Pro
- Tenant baru per bulan (grafik pertumbuhan)
- Total order diproses di seluruh platform (aggregate)

#### F-SA-03: Manajemen Billing
- Riwayat pembayaran per tenant
- Tenant yang payment overdue
- Kirim reminder tagihan manual
- Apply diskon / kupon per tenant

#### F-SA-04: Manajemen Demo (Gevana Laundry)
- Reset data demo Gevana secara manual atau terjadwal (setiap 24 jam)
- Toggle mode: read-only atau interaktif dengan data dummy
- Lihat statistik berapa banyak orang mengakses demo

#### F-SA-05: Pengumuman & Support
- Kirim pengumuman ke semua tenant (in-app notification)
- Kirim pengumuman ke tenant tertentu berdasarkan paket
- Log tiket support (sederhana)

---

## 15. Kebutuhan Non-Fungsional

### 15.1 Performa
- Halaman POS & Order load < 2 detik di koneksi 4G
- Sistem mampu menangani 1.000+ tenant aktif secara bersamaan
- Notifikasi WhatsApp terkirim < 30 detik setelah trigger
- Combobox autocomplete response < 300ms

### 15.2 Keandalan
- Uptime minimal 99.5%
- Data transaksi tersimpan meski koneksi terputus (offline mode POS dasar)
- Backup otomatis Supabase setiap 24 jam
- Isolasi failure antar tenant (satu tenant error tidak mempengaruhi tenant lain)

### 15.3 Keamanan
- Autentikasi via Supabase Auth (email + password)
- Row Level Security (RLS) untuk isolasi data antar tenant
- HTTPS wajib untuk semua subdomain
- Log aktivitas user per tenant
- Super Admin menggunakan 2FA

### 15.4 Skalabilitas
- Arsitektur stateless — mudah di-scale horizontal
- Supabase dapat di-upgrade tier seiring pertumbuhan tenant
- Vercel Edge Network untuk performa global

### 15.5 Kemudahan Penggunaan
- Antarmuka dalam Bahasa Indonesia
- Mobile-first: dioptimalkan untuk HP Android layar 360px ke atas
- PWA: installable via "Add to Home Screen"
- Alur POS selesai < 3 menit per transaksi
- Setup wizard onboarding < 10 menit

### 15.6 Integrasi
- Supabase Realtime: live update status order tanpa refresh
- GoWA (per tenant): REST API HTTP POST JSON
- Leaflet.js + OpenStreetMap: peta rute gratis
- Vite PWA Plugin: service worker, manifest, offline cache
- Export: Excel (.xlsx) dan PDF

---

## 16. Arsitektur & Tech Stack

### 16.1 Platform
**Progressive Web App (PWA)** — web app responsif, installable ke home screen HP.

| Fitur PWA | Keterangan |
|-----------|-----------|
| Add to Home Screen | Ikon di layar HP seperti app native |
| Offline Mode (terbatas) | Cache POS & order data terakhir |
| Responsive | HP, tablet, laptop |

### 16.2 Tech Stack

| Komponen | Teknologi | Alasan |
|----------|-----------|--------|
| **Frontend** | **SvelteKit** | Bundle terkecil, performa tinggi, PWA-friendly |
| **Styling** | **TailwindCSS** | Utility-first, mobile-first, tidak ada CSS bloat |
| **Database** | **Supabase (PostgreSQL)** | Multi-tenant RLS, realtime, gratis tier |
| **Auth** | **Supabase Auth** | Login per role, session management, OTP |
| **API** | **Supabase REST & Realtime** | Auto-generated, realtime order tracking |
| **File Storage** | **Supabase Storage** | Bukti bayar, foto driver, logo tenant |
| **PWA** | **Vite PWA Plugin** | Service worker, manifest, add to home screen |
| **Maps** | **Leaflet.js + OpenStreetMap** | Gratis, ringan, tanpa API key berbayar |
| **Hosting** | **Vercel** | Free tier, CDN global, subdomain wildcard |
| **WhatsApp** | **GoWA (per tenant, self-hosted)** | Notifikasi tanpa biaya per pesan |

### 16.3 Struktur URL

```
laundryin.id                  → Landing page & marketing
app.laundryin.id              → Login, daftar, onboarding
app.laundryin.id/superadmin   → Super Admin dashboard
[slug].laundryin.id           → Workspace tenant
gevana.laundryin.id           → Demo tenant (Gevana Laundry)
```

### 16.4 Struktur Database (Skema Utama)

```
tenants           → data toko, slug, paket, billing
users             → user per tenant + role
customers         → pelanggan per tenant
orders            → order + status + jalur (antar sendiri/jemput)
order_items       → detail layanan per order
payments          → pembayaran per order
inventory_items   → stok per tenant
delivery_schedules → jadwal antar jemput
delivery_routes   → rute per driver per hari
drivers           → driver per tenant
members           → data membership per pelanggan
points_log        → riwayat poin masuk/keluar
notifications_log → riwayat pesan WA terkirim
```

### 16.5 Estimasi Biaya Infrastruktur (per Bulan)

| Layanan | Provider | Biaya |
|---------|----------|-------|
| Frontend hosting | Vercel (free tier) | Gratis |
| DB + Auth + Storage | Supabase (free → Pro seiring skala) | Gratis s/d $25/bulan |
| GoWA (platform, untuk OTP) | VPS Niagahoster | ~Rp 50.000–100.000 |
| Domain laundryin.id | Niagahoster | ~Rp 150.000/tahun |
| **Total awal** | | **~Rp 50.000–100.000/bulan** |

> Catatan: Setiap tenant mengelola VPS GoWA sendiri untuk notifikasi WhatsApp mereka.

---

## 17. Prioritas Pengembangan

### 17.1 Fase 1 – MVP SaaS (Bulan 1-2)
**Target: Tenant bisa daftar, setup, dan operasional dasar berjalan**

| No | Fitur | Paket | Prioritas |
|----|-------|-------|-----------|
| 1 | Landing page LaundryIn + daftar tenant | Semua | 🔴 Wajib |
| 2 | Onboarding wizard (5 langkah) | Semua | 🔴 Wajib |
| 3 | Auth Supabase + multi-tenant RLS | Semua | 🔴 Wajib |
| 4 | POS — input order + combobox pelanggan | Semua | 🔴 Wajib |
| 5 | Manajemen order — tracking status | Semua | 🔴 Wajib |
| 6 | Notifikasi WhatsApp (GoWA) | Semua | 🔴 Wajib |
| 7 | Pembayaran — bayar awal/akhir | Semua | 🔴 Wajib |
| 8 | Laporan harian | Semua | 🔴 Wajib |
| 9 | PWA — add to home screen | Semua | 🔴 Wajib |
| 10 | Demo Gevana Laundry (data dummy) | - | 🔴 Wajib |

### 17.2 Fase 2 – Fitur Lengkap (Bulan 3-4)
**Target: Paket Starter & Pro fully functional**

| No | Fitur | Paket | Prioritas |
|----|-------|-------|-----------|
| 11 | Pembukuan lanjutan + laporan bulanan | Starter+ | 🟠 Tinggi |
| 12 | Inventori + alert stok | Semua | 🟠 Tinggi |
| 13 | Membership — tier + poin + diskon | Starter+ | 🟠 Tinggi |
| 14 | Jadwal antar jemput + logika rute | Starter+ | 🟠 Tinggi |
| 15 | Super Admin dashboard | Internal | 🟠 Tinggi |
| 16 | Billing & upgrade/downgrade paket | Semua | 🟠 Tinggi |
| 17 | Cetak label cucian | Semua | 🟡 Sedang |

### 17.3 Fase 3 – Optimasi & Growth (Bulan 5-6)
**Target: Retensi tenant & skalabilitas**

| No | Fitur | Paket | Prioritas |
|----|-------|-------|-----------|
| 18 | Optimasi rute driver (nearest neighbor) | Pro | 🟡 Sedang |
| 19 | QRIS (setelah riset provider) | Starter+ | 🟡 Sedang |
| 20 | Program referral membership | Starter+ | 🟡 Sedang |
| 21 | Multi-cabang | Pro | 🟡 Sedang |
| 22 | White label / custom domain | Pro | 🟡 Sedang |
| 23 | Analytics lanjutan tenant | Pro | 🟢 Rendah |
| 24 | SaaS metrics dashboard Super Admin | Internal | 🟢 Rendah |

---

## 18. Catatan Tambahan

### 18.1 GoWA — Catatan Penting untuk Tenant
- Setiap tenant perlu nomor HP **khusus bisnis** untuk GoWA (tidak boleh dipakai WA personal)
- GoWA di-host di VPS masing-masing tenant (~Rp 50.000–100.000/bulan)
- LaundryIn menyediakan panduan setup GoWA step-by-step di documentation

### 18.2 Riset QRIS Gratis
Provider kandidat untuk fase berikutnya:
- **Lynk.id** — QRIS MDR 0% untuk personal
- **Flip** — biaya transfer rendah
- **OttoMikro** — QRIS untuk UKM
- **Bank Jago** — QRIS gratis usaha kecil

### 18.3 Strategi Go-to-Market
- **Demo Gevana** sebagai showcase utama di semua materi pemasaran
- Target akuisisi awal: komunitas ibu rumah tangga, grup WhatsApp laundry lokal, TikTok/Instagram konten tutorial
- Paket Free sebagai magnet — upgrade natural saat usaha berkembang
- Referral program untuk pemilik laundry yang ajak teman daftar

### 18.4 Hak Kepemilikan Data
- Data setiap tenant adalah milik tenant tersebut sepenuhnya
- LaundryIn tidak mengakses data operasional tenant tanpa izin
- Tenant dapat ekspor semua data kapan saja (data portability)
- Jika tenant menutup akun, data tersimpan 90 hari sebelum dihapus permanen

---

*Dokumen ini adalah Requirements Document resmi untuk platform SaaS LaundryIn.*  
*Gevana Laundry digunakan sebagai tenant demo & pilot resmi.*

**© 2026 LaundryIn — Kelola Laundry Anda, Dari Mana Saja**
