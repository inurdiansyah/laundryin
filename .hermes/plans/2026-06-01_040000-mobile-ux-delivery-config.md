# Plan: Perbaikan Mobile UI/UX + Jadwal Delivery Configurable

**Date:** 2026-06-01
**Status:** Research & Plan
**Target:** Semua halaman `/app/[slug]/` kecuali POS

---

## Part A: Masalah Mobile UI/UX

### A1. Halaman Pesanan (`orders/+page.svelte`)

**Kondisi saat ini:**
- Desktop: grid 5 kolom `[2fr_2fr_1.5fr_2.5fr_1.5fr]` — rapi
- Mobile: `md:hidden` menampilkan card vertikal tapi **TRUNCATED** (semua info dipaksa dalam 1 baris teks yang di-split manual). Order #GEVA-20260531-001 tampil sebagai satu text blob besar di snapshot — tidak terbaca.
- Filter bar: tab (Semua/Aktif/Pengantaran/Selesai) + status dropdown + search + date range + Filter button — semua berjejalan di mobile. Tab bungkus jadi 4 button horizontal yang barely muat.

**Masalah spesifik:**
1. Mobile card terlalu padat — `#GEVA-... Cici 089... Rp4.000 Menunggu Jemput 🛵 🚚 1 Jun 2026 02.37` semua dalam satu text blob
2. Tidak ada visual hierarchy — nama, status, delivery badge semua jadi satu
3. Filter bar overflow horizontal — harus scroll
4. Expanded detail terlalu lebar untuk mobile (delivery cards + items + actions)

**Solusi:**
- Redesain mobile order card jadi layout 2-baris yang proper:
  ```
  ┌──────────────────────────────────┐
  │ #GEVA-001  Status Menunggu Jemput│
  │ Cici     Rp4.000     🛵 🚚       │
  │ 1 Jun 2026 02.37                 │
  └──────────────────────────────────┘
  ```
- Filter bar: tab jadi horizontal scroll dengan overflow-x-auto, search + status jadi baris kedua
- Date range menjadi collapsible di mobile (buka saat klik icon kalender)
- Delivery cards: stack vertikal dengan padding yang proporsional

### A2. Halaman Pelanggan (`customers/+page.svelte`)

**Kondisi saat ini:** 521 baris, likely punya tabel desktop + modal CRUD.

**Masalah spesifik (asumsi, perlu verifikasi):**
- Desktop tabel dengan banyak kolom yang tidak adaptif ke mobile
- Search mungkin memenuhi lebar layar
- Modal create/edit terlalu lebar di mobile

**Solusi:**
- Redesign tabel jadi card-based di mobile (sama seperti Pesanan)
- Modal: full-width di mobile (sudah umum dipakai)
- Search bar: full width di atas dengan padding yang pas

### A3. Halaman Inventori (`inventory/+page.svelte`)

**Kondisi saat ini:** 437 baris, punya fitur opname (stok opname).

**Masalah spesifik:**
- Tabel multi-kolom (nama, stok sistem, stok aktual, selisih) — tidak muat di mobile
- Opname mode: input field kecil yang mungkin tidak terbaca

**Solusi:**
- Mobile: card per item dengan stok sebagai angka besar, aksi di bawah
- Opname: modal terpisah atau inline expand yang proper

### A4. Halaman Member (`members/+page.svelte`)

**Kondisi saat ini:** 804 baris — halaman paling kompleks. Tier system + points log.

**Masalah spesifik:**
- Card-based layout mungkin sudah ada, tapi 804 baris indikasi banyak duplikasi
- Points log table tidak muat di mobile

**Solusi:**
- Member cards: tier badge + nama + poin (ringkas)
- Points log: tampilkan 5 terakhir di card, full list di expand

### A5. Halaman Laporan (`reports/+page.svelte`)

**Kondisi saat ini:** 270 baris. Chart/grafik-based.

**Masalah spesifik:**
- Grafik/chart mungkin fixed width, tidak responsif
- Summary cards berjejalan

**Solusi:**
- Chart: responsive container (aspect-ratio atau resize observer)
- Period selector: horizontal scroll untuk bulan/minggu/hari

### A6. Dashboard (`+page.svelte`)

**Kondisi saat ini:** 137 baris. KPI cards grid 2 kolom mobile.

**Masalah:** Relatif sudah ok — grid 2 kolom mobile. Tapi mungkin padding dan spacing perlu disesuaikan. Minor fix saja.

---

## Part B: Jadwal Delivery Configurable

### Masalah

Saat ini `update_status` di server auto-create delivery dengan:
```typescript
tanggal: new Date().toISOString().split('T')[0],  // selalu hari ini
slot_waktu: 'pagi' // untuk jemput, 'sore' untuk antar
```

Tidak ada cara untuk user mengubah tanggal, slot, atau alamat delivery. User harus bisa set "jemput besok jam 2 siang" tanpa menunggu workflow.

Selain itu, alamat diambil dari `customers.alamat` — tidak bisa beda per delivery.

### Solusi: Delivery Schedule Edit di Delivery Card

Delivery card yang sudah ada akan ditambah fitur edit inline:

```
┌─────────────────────────────────┐
│ 🛵 Jemput       Terjadwal  ✓ Proses │
│ 📅 1 Jun 2026  [📝 ubah]          │
│ 🕐 Pagi (08-12) [📝 ubah]         │
│ 📍 Jl. Thamrin  [📝 ubah]         │
│ 👤 Pilih driver...  [Tugaskan]     │
└─────────────────────────────────┘
```

Klik `[📝 ubah]` → inline edit muncul (date input / select slot / text input) → Enter untuk simpan.

### Implementation

**1. Action `update_delivery_detail` di server:**
```typescript
update_delivery_detail: async ({ request, fetch, cookies, locals }) => {
    // Update tanggal, slot_waktu, alamat, atau catatan di delivery_schedules
    // Field yang dikirim: delivery_id + field(s) yang diubah
}
```

**2. State edit di Svelte:**
```typescript
let editingField = $state<{ deliveryId: string; field: string } | null>(null);
```

**3. Inline editor di delivery card:**
- Default: tampilkan value + icon edit (✏️)
- Editing: inline input (date picker / select / text) + tombol simpan (✓) + batal (✕)
- Form submit via `use:enhance` ke `update_delivery_detail`
- Reset editing state setelah success

**4. Alamat delivery terpisah dari customer:**
- Saat delivery dibuat, copy dari `customers.alamat` sebagai default
- User bisa edit alamat delivery tanpa mengubah alamat customer

### Fields yang bisa diedit per delivery card:

| Field | Input type | Default |
|-------|-----------|---------|
| Tanggal | date picker | today |
| Slot waktu | select (pagi/siang/sore/malam) | pagi (jemput) / sore (antar) |
| Alamat | text input | dari customer |
| Catatan driver | text input pendek | — |

### UX Flow:
1. Admin advance order → delivery auto-created dengan default values
2. Admin lihat delivery card → klik ✏️ di tanggal → ganti ke besok → ✓ simpan
3. Atau: klik ✏️ di alamat → input alamat spesifik → ✓ simpan
4. Kapan saja bisa diedit, asalkan delivery belum selesai

---

## Files to Change

| File | Perubahan |
|------|-----------|
| `orders/+page.server.ts` | Tambah action `update_delivery_detail` |
| `orders/+page.svelte` | Redesign mobile order cards + inline delivery editor + filter bar mobile |
| `customers/+page.svelte` | Redesign mobile table → cards |
| `inventory/+page.svelte` | Redesign mobile table → cards + opname modal |
| `members/+page.svelte` | Compact mobile cards + collapsible points log |
| `reports/+page.svelte` | Responsive chart containers |
| `+page.svelte` (dashboard) | Minor spacing fixes |

---

## Step-by-step Plan

### Fase 1: Delivery Configurable (core feature, 1 halaman)
1. Tambah `update_delivery_detail` action di server
2. Tambah inline editor state + UI di delivery cards
3. Test: edit tanggal, slot, alamat di delivery card → verify DB

### Fase 2: Pesanan Mobile Redesign (highest traffic page)
4. Rewrite mobile order card layout (2-baris proper)
5. Filter bar: scrollable tabs + collapsible date
6. Adjust expanded detail spacing for mobile
7. Build & test

### Fase 3: Halaman Lain Mobile
8. Pelanggan: card-based mobile layout
9. Inventori: card-based + opname perbaikan
10. Member: compact cards
11. Laporan: responsive charts
12. Dashboard: minor fixes

### Fase 4: Polishing
13. Konsistensi spacing semua halaman
14. Toast positioning di mobile
15. Build final & full verify

---

## Risks

- **Editing delivery di mobile:** Inline input mungkin terlalu kecil. Solusi: full-width input saat mobile, bukan inline horizontal.
- **Filter bar collapse:** Perlu test di berbagai ukuran layar (320px-428px iPhone). 
- **Performance:** `update_delivery_detail` harus lightweight — cuma update 1-2 field tanpa re-fetch seluruh page.

## Open Questions

- Apakah perlu "Buat Jadwal Manual" untuk delivery? Maksudnya: tanpa menunggu workflow, admin bisa manual create delivery schedule dari halaman Pesanan. → **Tidak untuk sekarang**, auto-create sudah cukup. Edit values sudah cukup untuk fleksibilitas.
- Apakah slot waktu perlu custom (bebas teks) atau fixed enum? → **Fixed enum**: pagi (08-12), siang (12-16), sore (16-20), malam (20-08). Cover 99% use case laundry.
