# Plan: Evaluasi "Pesanan Terbaru" di Halaman POS

**Date:** 2026-06-01
**Target:** `/Users/inurdiansyah/project/laudryin/src/routes/(app)/[slug]/pos/`

---

## Temuan

Section "Pesanan Terbaru" di halaman POS (baris 567–598 di `+page.svelte`):

```svelte
<!-- Recent Orders -->
{#if selectedItems.length === 0 && recentOrders.length > 0}
    <div class="mt-4 rounded-xl border ...">
        <h2>Pesanan Terbaru</h2>
        {#each recentOrders.slice(0, 5) as order}
            <div class="flex items-center ...">
                <!-- nomor_order, customer, time, total, status badge -->
            </div>
        {/each}
    </div>
{/if}
```

### Masalah

| # | Masalah | Detail |
|---|---------|--------|
| 1 | **No interaction** | Row tidak bisa diklik — murni read-only, tidak ada navigasi ke detail |
| 2 | **Fungsi tumpang tindih** | Dashboard sudah punya order aktif + pesanan terbaru dengan link navigasi. Orders page untuk browse/manage pesanan |
| 3 | **Mengganggu layout** | Section ini di luar `left-panel` utama (diposisikan setelah `</div>` penutup layout flex), dan hanya muncul saat cart kosong — muncul/tenggelam mengganggu |
| 4 | **Scroll displacement** | Saat user add item → section hilang → layout berubah mendadak |
| 5 | **Tidak memberi value** | POS halaman pembuatan order — bukan halaman browsing. User tidak bisa melakukan apa-apa dengan informasi ini |

### Apakah section ini perlu?

**Tidak.** Kesimpulan: **remove entirely.**

POS adalah halaman transaksional. Tujuannya satu: buat pesanan baru secepat mungkin. Informasi "pesanan terbaru" tanpa aksi adalah noise.

Jika user ingin lihat pesanan terbaru:
- **Dashboard** sudah punya "Order Aktif" + redirect ke detail
- **Halaman Orders** (`/orders`) punya semua fitur browse/filter/expand
- **Success toast** setelah submit sudah ada tombol "Lihat Pesanan →"

---

## Rencana Aksi

### 1. Hapus section "Pesanan Terbaru" dari UI
- **File:** `src/routes/(app)/[slug]/pos/+page.svelte`
- Hapus baris 567–598 (seluruh `{#if ...}` block)
- Hapus variabel `recentOrders` dari script (baris 11)
- Hapus `recentOrders` dari destructure `data` jika tidak digunakan di tempat lain

### 2. Hapus fetch `recentOrders` dari server load
- **File:** `src/routes/(app)/[slug]/pos/+page.server.ts`
- Hapus query `recentOrders` dari `Promise.all`
- Hapus `recentOrders` dari return object

### Dampak

- Bersihkan 30 baris UI
- Kurangi 1 query Supabase per load (performa naik)
- Tidak ada efek samping — tidak ada fitur lain yang depend pada `recentOrders` di POS

### Verifikasi

1. Build `npm run build` — pastikan tidak error
2. Buka `/pos` — pastikan section tidak muncul
3. Pastikan flow POS (customer → service → pay → submit) masih berfungsi
4. Pastikan success toast + "Lihat Pesanan" masih bekerja
