# Rencana Redesign Workflow: Per-Layanan + Jalur-Aware

## Goal

Order dengan layanan berbeda (Cuci, Setrika, Cuci+Setrika, dll.) dan jalur berbeda (antar sendiri / jemput / antar) harus mengikuti workflow status yang relevan — tidak dipaksa lewat status yang tidak masuk akal.

**Masalah saat ini:**
- Semua order pakai `STATUS_SEQUENCE` hardcoded: `diterima → menunggu_jemput → dijemput_driver → proses_cuci → proses_kering → setrika → siap_diambil → siap_diantar → dalam_pengiriman → terkirim → selesai`
- Setrika saja tetap harus lewat "proses_cuci" dan "proses_kering"
- Antar sendiri tetap lewat "menunggu_jemput" dan "dijemput_driver"
- Delivery status (jemput/antar) tercampur dengan production status (cuci/kering/setrika)

---

## Current Context

**DB schema:**
- `layanans` — hanya `nama`, `harga`, `satuan`, `kategori`. Tidak ada workflow.
- `orders.status` — enum 11 nilai, semua tercampur (production + delivery).
- `orders.jalur` — `antar_sendiri` | `jemput` (tapi tidak ada opsi "jemput + antar" terpisah).
- `delivery_schedules` — tabel terpisah dengan `delivery_status` enum sendiri.

**Kode:**
- `orders/+page.server.ts` — `STATUS_SEQUENCE` hardcoded array, `update_status` action naik 1 index.
- `orders/+page.svelte` — `STATUS_SEQUENCE` hardcoded array untuk filter dropdown dan tombol "Proses ke ...".
- `pos/+page.server.ts` — `orderStatus = jalur === 'jemput' ? 'menunggu_jemput' : 'diterima'`.

---

## Proposed Approach: Hybrid (DB-driven workflow + jalur modifier di kode)

### 1. Database Changes

**Migration A: Tambah workflow ke layanan**
```sql
ALTER TABLE layanans ADD COLUMN workflow text[] NOT NULL DEFAULT '{}';
UPDATE layanans SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'];
-- Layanan setrika saja:
UPDATE layanans SET workflow = ARRAY['diterima','setrika','siap_diambil','selesai'] WHERE nama ILIKE '%setrika%' AND nama NOT ILIKE '%cuci%';
-- Layanan cuci saja:
UPDATE layanans SET workflow = ARRAY['diterima','proses_cuci','proses_kering','siap_diambil','selesai'] WHERE nama ILIKE '%cuci%' AND nama NOT ILIKE '%setrika%';
```

**Migration B: Tambah workflow ke order**
```sql
ALTER TABLE orders ADD COLUMN workflow text[] NOT NULL DEFAULT '{}';
-- Backfill: ambil workflow dari layanan pertama di order_items
UPDATE orders o SET workflow = (
  SELECT l.workflow FROM order_items oi JOIN layanans l ON oi.layanan_id = l.id
  WHERE oi.order_id = o.id ORDER BY oi.created_at LIMIT 1
);
-- Fallback untuk order tanpa items atau layanan tanpa workflow:
UPDATE orders SET workflow = ARRAY['diterima','proses_cuci','proses_kering','setrika','siap_diambil','selesai'] WHERE workflow = '{}';
```

**Migration C: Delivery status terpisah (opsional, breaking)**
```sql
-- Hapus status delivery dari order_status enum
-- Tapi ini breaking change besar. Alternatif: biarkan enum, tapi workflow order tidak include mereka.
```

### 2. Workflow Generation Logic (saat order creation)

```typescript
function generateWorkflow(orderItems: OrderItem[], jalur: string): string[] {
  // 1. Union workflow dari semua layanan
  const baseWorkflows = orderItems.map(item => item.layanan.workflow);
  const merged = mergeWorkflows(baseWorkflows); // union berurutan

  // 2. Jalur modifier
  if (jalur === 'jemput') {
    // Insert delivery pickup di awal (sebelum diterima)
    merged.unshift('menunggu_jemput', 'dijemput_driver');
  }
  if (jalur === 'antar' || jalur === 'jemput_antar') {
    // Insert delivery dropoff di akhir (setelah siap_diambil)
    const idx = merged.indexOf('siap_diambil');
    if (idx !== -1) {
      merged.splice(idx + 1, 0, 'siap_diantar', 'dalam_pengiriman', 'terkirim');
    }
  }

  return merged;
}
```

**Contoh hasil:**
| Layanan | Jalur | Workflow |
|---------|-------|----------|
| Cuci + Setrika | Antar sendiri | diterima → proses_cuci → proses_kering → setrika → siap_diambil → selesai |
| Setrika saja | Antar sendiri | diterima → setrika → siap_diambil → selesai |
| Cuci + Setrika | Jemput + antar | menunggu_jemput → dijemput_driver → diterima → proses_cuci → proses_kering → setrika → siap_diambil → siap_diantar → dalam_pengiriman → terkirim → selesai |
| Setrika saja | Jemput + ambil sendiri | menunggu_jemput → dijemput_driver → diterima → setrika → siap_diambil → selesai |

### 3. Status Progression Logic (server)

```typescript
// orders/+page.server.ts — update_status action
const workflow = order.workflow;
const currentIndex = workflow.indexOf(order.status);
if (currentIndex === -1 || currentIndex >= workflow.length - 1) {
  return fail(400, { error: 'Status sudah final' });
}
const nextStatus = workflow[currentIndex + 1];
```

### 4. UI Changes

**orders/+page.svelte:**
- Filter dropdown status: ambil dari `UNION(workflow dari semua layanan yang ada)` — tidak hardcoded.
- Tombol "Proses ke ...": `nextStatusLabel(order)` menggunakan `order.workflow`.
- Badge status: tetap pakai `statusColors` map.

**pos/+page.svelte:**
- Jalur selector: tambah opsi "Jemput + Antar" (saat ini hanya "Antar sendiri" dan "Jemput").
- Saat simpan: generate workflow dan simpan ke `orders.workflow`.

### 5. Delivery Schedule Integration

Saat ini delivery schedule punya status sendiri (`terjadwal → driver_berangkat → dijemput → tiba_di_laundry → selesai`). Ini sebenarnya lebih baik — delivery status terpisah dari order status.

**Solusi bersih:**
- Order status = production workflow saja.
- Delivery schedule status = delivery lifecycle.
- Saat order status = `diterima` (setelah `dijemput_driver`), delivery schedule status = `tiba_di_laundry`.
- Saat order status = `selesai`, delivery schedule status = `selesai`.

Tapi ini breaking change. Alternatif pragmatis:
- Biarkan order status include delivery checkpoint.
- Delivery schedule tetap terpisah untuk tracking driver/rute.
- Sync manual: saat order status `dijemput_driver` → update delivery schedule ke `dijemput`. Saat order status `terkirim` → update delivery schedule ke `selesai`.

---

## Step-by-Step Plan

### Phase 1: DB + Data Model (1-2 jam)
1. **Migration** — `ALTER TABLE layanans ADD COLUMN workflow text[]` + backfill.
2. **Migration** — `ALTER TABLE orders ADD COLUMN workflow text[]` + backfill dari layanan pertama.
3. **Update POS server** — `create_order` action: generate workflow dari layanan items + jalur, simpan ke `orders.workflow`.
4. **Update orders server** — `update_status` action: gunakan `order.workflow` array, bukan `STATUS_SEQUENCE` hardcoded.

### Phase 2: UI Update (1-2 jam)
5. **orders/+page.svelte** — filter status dropdown: dinamis dari `data.allWorkflowStatuses` (UNION semua workflow yang ada di order list).
6. **orders/+page.svelte** — tombol "Proses ke ...": gunakan `order.workflow` untuk next status.
7. **orders/+page.server.ts** — `load()` — return `allWorkflowStatuses` untuk filter dropdown.

### Phase 3: Jalur Enhancement (1 jam)
8. **POS UI** — tambah jalur option: "Jemput + Antar" (value: `jemput_antar`).
9. **POS server** — `generateWorkflow()` function dengan jalur modifier.
10. **DB** — update `order_jalur` enum: tambah `jemput_antar`.

### Phase 4: Delivery Sync (1 jam, opsional)
11. **orders server** — saat status berubah ke `dijemput_driver` atau `terkirim`, sync ke `delivery_schedules`.
12. **delivery/+page.server.ts** — `load()` — join dengan orders untuk context.

---

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/20260601_xxxx_add_workflow.sql` | New — add workflow columns + backfill |
| `src/routes/(app)/[slug]/pos/+page.server.ts` | Generate workflow on order creation |
| `src/routes/(app)/[slug]/orders/+page.server.ts` | Use `order.workflow` for status progression |
| `src/routes/(app)/[slug]/orders/+page.svelte` | Dynamic status filter, workflow-aware next button |
| `src/routes/(app)/[slug]/pos/+page.svelte` | Add "Jemput + Antar" jalur option |

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| Breaking change for existing orders | Backfill migration dengan workflow default |
| Multiple layanan dengan workflow berbeda | Union/merge logic — ambil superset berurutan |
| Performance: workflow array per order | `text[]` di PostgreSQL — index tidak perlu, array kecil (max 10-15 elemen) |
| Jalur `jemput` saat ini tidak ada `antar` | Tambah enum value `jemput_antar` dan `antar` |

## Open Questions

1. **Apakah layanan baru (Express, Dry Clean, dll.) perlu workflow berbeda?** → Ya, kolom `workflow` di `layanans` memungkinkan ini.
2. **Bagaimana jika order punya 3 layanan dengan workflow berbeda?** → Merge logic ambil superset — contoh: Cuci [A,B,C,D] + Setrika [A,C,D] → merged [A,B,C,D].
3. **Apakah delivery schedule status perlu disederhanakan?** → Ya, idealnya hanya 3: `terjadwal → berjalan → selesai`. Tapi ini bisa jadi Phase 2 terpisah.

---

## Validation

- [ ] Order "Setrika saja" + "Antar sendiri" → workflow: diterima → setrika → siap_diambil → selesai (4 status)
- [ ] Order "Cuci + Setrika" + "Jemput + Antar" → workflow: menunggu_jemput → dijemput_driver → diterima → proses_cuci → proses_kering → setrika → siap_diambil → siap_diantar → dalam_pengiriman → terkirim → selesai (11 status)
- [ ] Tombol "Proses ke ..." selalu ke next status dalam workflow order
- [ ] Filter status dropdown hanya menampilkan status yang relevan dengan order yang ada
