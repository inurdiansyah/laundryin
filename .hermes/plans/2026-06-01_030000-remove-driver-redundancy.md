# Plan: Hapus Redundansi Driver — Satu Tempat, Satu Tugas

**Date:** 2026-06-01
**Status:** Research & Plan
**Target:** `/Users/inurdiansyah/project/laudryin/src/routes/(app)/[slug]/orders/`

---

## Masalah

Sekarang ada **2 tempat berbeda** yang sama-sama ngurusin driver:

### Tempat 1: Actions Section (baris 436-447)
Saat next step workflow butuh driver (`dijemput_driver` / `dalam_pengiriman`), tampil dropdown driver + "➡️ dijemput driver".
- Di sini admin pilih driver → server `update_status` auto-create `delivery_schedules` + assign driver

### Tempat 2: Pengantaran Section (baris 337-352)
Delivery card jemput/antar punya dropdown driver sendiri + tombol "Tugaskan".
- Di sini admin assign driver ke delivery yang sudah ada

**Konflik:** Satu order bisa punya driver di-assign dari dua tempat berbeda. Dua form, dua action, dua source of truth.

### Tempat 3 (bonus redundansi): "✓ Proses" di delivery cards (baris 321-326)
Ini untuk advance delivery status. Tapi `update_delivery` di server juga auto-sync order status (line 288-294). Jadi order workflow bisa advance dari dua jalur: Actions atau delivery cards.

---

## Akar Masalah

```typescript
// needsDriver() di line 94-97
function needsDriver(order: any): boolean {
    const ns = nextStatus(order);
    return ns === 'dijemput_driver' || ns === 'dalam_pengiriman';
}
```

Fungsi ini menempelkan **driver assignment ke order workflow**, padahal driver adalah **milik delivery workflow**. Ini salah kaprah — order status `dijemput_driver` artinya "order sedang dalam tahap dijemput", BUKAN "saatnya pilih driver". Pilih driver adalah urusan delivery card.

Akibatnya: Actions section (order workflow) dan Pengantaran section (delivery workflow) tumpang tindih.

---

## Solusi: Pemisahan Tanggung Jawab Tegas

| Concern | Yang Urus | Di Mana |
|---------|-----------|---------|
| Advance order workflow | `update_status` | Actions section (tombol "Proses ke...") |
| Buat jadwal delivery baru | `update_status` auto-create saat status jadi `dijemput_driver`/`dalam_pengiriman` | Otomatis, NO driver |
| Assign driver ke delivery | `assign_driver` | **HANYA** di Pengantaran section |
| Advance delivery status | `update_delivery` | **HANYA** di Pengantaran section (✓ Proses) |
| Sync order status saat delivery selesai | `update_delivery` auto | Otomatis di server |

### Aturan Inti:
- **Driver assignment NEVER di Actions section. Full stop.**
- Actions cuma tombol "Proses ke [next_status]" — tanpa dropdown driver.
- Delivery yang baru dibuat oleh `update_status` punya `driver_id: null` — belum ditugaskan.
- Admin assign driver DI DELIVERY CARD, bukan di Actions.

---

## Changes

### 1. Server: `update_status` — jangan minta driver

```diff
- // Require driver for delivery statuses
- const driverRequiredStatuses = ['dijemput_driver', 'dalam_pengiriman'];
- if (driverRequiredStatuses.includes(nextStatus)) {
-     driverId = ...; // validate and get driver
- }

  // Auto-create delivery WITHOUT driver
  if (nextStatus === 'dijemput_driver') {
-     await supabase...insert({ driver_id: driverId, status: 'driver_berangkat' });
+     await supabase...insert({ driver_id: null, status: 'terjadwal' });
  }
  if (nextStatus === 'dalam_pengiriman') {
-     await supabase...insert({ driver_id: driverId, status: 'driver_berangkat' });
+     await supabase...insert({ driver_id: null, status: 'terjadwal' });
  }
```

Delivery dibuat, tapi `driver_id = null` dan `status = 'terjadwal'`. Assign driver nanti di delivery card.

### 2. Frontend: Hapus dropdown driver dari Actions section

```diff
- {#if needsDriver(order)}
-     <form> ... <select driver> ... <button>➡️ {nextStatusLabel}</button> ... </form>
- {:else}
      <form>
          <button>➡️ Proses ke {nextStatusLabel(order)}</button>
      </form>
- {/if}
```

Jadi semua order non-completed = satu tombol sederhana "Proses ke [next]". Tidak ada cabang.

Hapus fungsi `needsDriver()` — sudah tidak terpakai.

### 3. Frontend: Pengantaran section jadi primary

Delivery card yang sudah ada sudah punya:
- Driver dropdown + "Tugaskan" (assign_driver) ✅
- "✓ Proses" (update_delivery) ✅
- Auto-sync order status saat delivery selesai ✅ (dari server)

Yang perlu ditambah: tampilkan Pengantaran section **bahkan sebelum delivery_schedules ada**:
- Untuk order dengan jalur jemput/antar tapi belum ada delivery entry → tampilkan card "Belum terjadwal" + tombol "Buat Jadwal"
- Tombol "Buat Jadwal" = panggil action baru `create_delivery` (atau cukup re-use `update_status` untuk advance ke `terjadwal`)

Actually lebih simpel: begitu order status advance ke `dijemput_driver`, `update_status` sudah auto-create delivery entry. Jadi delivery card langsung muncul tanpa user perlu "Buat Jadwal" manual. Cukup hapus driver dropdown dari Actions section.

---

## Files to Change

| File | Perubahan |
|------|-----------|
| `orders/+page.server.ts` | `update_status` action: hapus validasi & assign driver, cukup auto-create delivery dengan `driver_id: null` & `status: terjadwal` |
| `orders/+page.svelte` | Hapus `needsDriver()`, hapus cabang driver dropdown di Actions section, semua order non-completed = tombol "Proses ke..." polos |

---

## Step-by-step

1. **Server:** Di `update_status`, hapus blok `driverRequiredStatuses` (baris 155-165). Saat create delivery, set `driver_id: null` dan `status: 'terjadwal'`.
2. **Svelte:** Hapus fungsi `needsDriver()` (baris 94-97). 
3. **Svelte:** Di Actions section, hapus `{#if needsDriver(order)}` branch (baris 437-447). Satu tombol "Proses ke..." untuk semua order non-completed.
4. **Build & verify** — test flow: order created → advance ke dijemput_driver via Actions → lihat delivery card muncul di Pengantaran (tanpa driver) → assign driver via delivery card → "✓ Proses" di delivery card → delivery selesai → order auto-sync.

---

## Risks

- **Pertanyaan:** Apa yang terjadi kalau admin langsung klik "Proses ke dijemput_driver" tanpa assign driver dulu?  
  **Jawaban:** Order status jadi `dijemput_driver`, delivery created dengan `driver_id: null`. Aman. Nanti admin buka Pengantaran section → assign driver.
  
- **Trade-off:** Butuh 1 klik ekstra (assign driver di delivery card, bukan saat advance status). Tapi ini justru **lebih baik** — memisahkan concern, lebih jelas, tidak bikin bingung.

## What NOT to do

- Jangan hapus `assign_driver` action — tetap dipakai oleh delivery cards
- Jangan hapus `update_delivery` — tetap dipakai untuk advance delivery
- Jangan ubah struktur delivery cards — sudah benar
