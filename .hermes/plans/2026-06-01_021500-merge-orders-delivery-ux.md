# UX Research & Plan: Orders vs Pengantaran — Merge or Fix Sync?

**Date:** 2026-06-01
**Status:** Research & Recommendation

---

## 1. Current State: Two Pages, Two Universes

### Pesanan (`/orders`)
- Lists all orders with workflow status badges
- Has inline "next step" button that advances order status
- When next status = `dijemput_driver` or `dalam_pengiriman`: shows driver dropdown + button
- Driver assignment in orders page → creates/updates `delivery_schedules` records

### Pengantaran (`/delivery`)
- Fetches `delivery_schedules` grouped by `order_id`
- 3 tabs: Tersedia, Dalam Proses, Selesai
- Assign driver modal (separate from orders)
- Click "Proses" to advance delivery_status: `terjadwal` → `driver_berangkat` → `dijemput` → `tiba_di_laundry` → `selesai`
- Only when delivery reaches `selesai`: updates order status to `diterima` (jemput) or `terkirim` (antar)

### POS (`/pos`)
- On order creation: auto-creates `delivery_schedules` for jemput/antar variants
- Toast after "Simpan Pesanan" now has "Lihat Pesanan →" button (just added)

---

## 2. Identified Sync Gaps

| # | Gap | Impact |
|---|-----|--------|
| 1 | **Dual driver assignment** — orders page and delivery page both have driver assignment UIs that don't know about each other | Confusion: user assigns driver in orders, but delivery page shows "Belum ada driver" until refresh |
| 2 | **Delivery status ≠ order status while in-progress** — delivery can be at `tiba_di_laundry` but order still shows `dijemput_driver` (only syncs on `selesai`) | User sees inconsistent state between pages |
| 3 | **Workflow ownership is split** — "next step" logic lives in orders page, but delivery lifecycle management lives in delivery page | User must switch pages to track one order end-to-end |
| 4 | **Delivery page shows orders, orders page doesn't show delivery** — asymmetric visibility | Orders page doesn't indicate whether a pickup/dropoff is scheduled/in-progress |
| 5 | **Duplicate data concerns** — `delivery_schedules` is essentially a mirror of order workflow for jemput/antar variants, but with its own status machine | Two state machines for one process |

---

## 3. Competitive Research: How Real Laundry SaaS Handle This

### Products studied:
| Product | Approach | URL |
|---------|----------|-----|
| **CleanCloud** | Single "Orders" list. Each order row shows delivery icon (🚚) if pickup/delivery scheduled. Click order → detail panel with delivery timeline inline. | cleancloudapp.com |
| **LaundryApp (AU)** | Combined "Pickups & Deliveries" tab that shows orders filtered to those with delivery. No separate Orders menu for delivery-related orders. | laundryapp.com.au |
| **WashOS** | Orders page is the hub. Delivery status as a column/icon in the order list. Filter by "Awaiting Pickup" / "Out for Delivery". | washos.com |
| **LaundryHeap** | Single "Orders" view. "Delivery" is a filter, not a page. Order cards show delivery status badges. | not public |
| **GoSend/GrabExpress** | Single order tracking view. Pickup & delivery are lifecycle stages of one order, never separate pages. | — |
| **ShopeeFood/Gofood** | Orders have "Preparing → Picked up → Delivering → Delivered" — all in one view. Kitchen and driver panels are different role views, not different pages for same user. | — |

### Consensus pattern:
> **Delivery is a property of the order, not a separate entity warranting its own page.** The industry treats "pickup" and "delivery" as workflow stages of an order that the same user tracks in one place.

---

## 4. Recommendation: Merge into Unified "Pesanan" Page

### Why merge (not just fix sync):
1. **Single source of truth** — eliminate the dual state-machine confusion
2. **Reduces cognitive load** — laundry owner doesn't think "I need to switch to Pengantaran to track the pickup" — it's all in one place
3. **Matches industry standard** — every major laundry SaaS does this
4. **Fewer pages, less code** — delivery page becomes a filter on orders, not a separate page with its own queries/actions
5. **`delivery_schedules` stays** — it's still the persistence layer for delivery tracking, but the UI collapses into one view

### What happens to Pengantaran page:
- **Remove** the separate `/delivery` route
- **Remove** "🚚 Pengantaran" from sidebar
- **Add** `?tab=pengantaran` filter to `/orders` page that shows only orders with delivery needs

---

## 5. Proposed Architecture: Unified Orders Page

### URL structure:
```
/orders                  → all orders (default tab)
/orders?tab=aktif        → active orders (not selesai/batal)
/orders?tab=pengantaran  → orders with delivery (jemput/antar variants only)
/orders?tab=selesai      → completed/cancelled
```

### Tab layout (replaces current single-list view):
```
┌─────────────────────────────────────────┐
│ 📋 Pesanan                              │
│                                         │
│ [Semua] [Aktif] [🚚 Pengantaran] [Selesai] │
│                                         │
│ ┌─ STATUS FILTER: [diterima] [proses...] │
│ └─ SEARCH: [________]                   │
│                                         │
│ Order cards with inline delivery info   │
└─────────────────────────────────────────┘
```

### Order card changes (when order has delivery):
```
Before:
┌──────────────────────────────────────────────┐
│ #GEVA-001  Siti Rahmawati     [dijemput_driver] │
│ Cuci Kering Setrika 5kg · Rp35.000            │
│ [Pilih Driver ▼] [Lanjutkan →]                │
└──────────────────────────────────────────────┘

After:
┌──────────────────────────────────────────────┐
│ #GEVA-001  Siti Rahmawati     [dijemput_driver] │
│ Cuci Kering Setrika 5kg · Rp35.000            │
│ ┌──────────────────────────────────────────┐  │
│ │ 🛵 Jemput: Indra · Driver Berangkat      │  │
│ │    📍 Jl. Thamrin 91 · Pagi (08:00-10:00)│  │
│ │    [✓ Dijemput] [× Batal]                │  │
│ ├──────────────────────────────────────────┤  │
│ │ 🚚 Antar: Belum dijadwalkan (hari+2)     │  │
│ └──────────────────────────────────────────┘  │
│ [Lanjutkan → diterima]                        │
└──────────────────────────────────────────────┘
```

### Delivery actions inside order card:
- When order has `delivery_schedules` records → show inline mini-cards
- Each delivery card shows: type icon, driver, address, time slot, status
- Driver assignment: dropdown inside delivery card (not separate modal)
- Status advancement: inline button per delivery card
- All actions use the existing `delivery_schedules` table — no data model changes needed

---

## 6. Implementation Plan

### Phase 1: Enhance Orders Page Server (load function)

**File:** `src/routes/(app)/[slug]/orders/+page.server.ts`

1. Add `tab` query param handling (`semua`, `aktif`, `pengantaran`, `selesai`)
2. Fetch `delivery_schedules` for loaded orders (bulk join):
   ```
   from('delivery_schedules').in('order_id', orderIds)
   ```
3. Fetch `drivers` for active drivers (already exists)
4. Attach delivery data to each order:
   ```ts
   order.delivery = {
     jemput: deliveryMap.get(order.id)?.find(d => d.tipe === 'jemput') || null,
     antar:  deliveryMap.get(order.id)?.find(d => d.tipe === 'antar') || null
   }
   ```
5. Filter orders by `tab`:
   - `pengantaran`: orders with `jalur` in (`jemput_ambil`, `jemput_antar`, `drop_antar`) AND status not `selesai`/`dibatalkan`
   - `aktif`: orders with status not `selesai`/`dibatalkan`
   - `selesai`: orders with status `selesai`/`dibatalkan`
   - `semua` (default): all orders

### Phase 2: Enhance Orders Page UI (Svelte component)

**File:** `src/routes/(app)/[slug]/orders/+page.svelte`

1. Add tab bar at top: Semua | Aktif | 🚚 Pengantaran | Selesai
2. Inside each order card, when `order.delivery` exists:
   - Show inline delivery mini-cards (jemput + antar if present)
   - Show driver info, address, time slot, status
   - Driver assignment: dropdown form (reuse from delivery page)
   - Delivery status advancement: inline button (reuse from delivery page)
3. Keep existing "next step" button for non-delivery workflow steps
4. When driver step (dijemput_driver / dalam_pengiriman) and delivery already exists:
   - Show the delivery card instead of driver dropdown
   - "Lanjutkan" button advances both order status AND delivery status

### Phase 3: Migrate Delivery Actions

**New actions in orders `+page.server.ts`:**

1. `assign_driver` (from delivery page) → assign driver to a delivery_schedule
2. `update_delivery_status` (from delivery page) → advance delivery_schedule status
3. `add_driver` (from delivery page) → create new driver
4. Keep existing `update_status` (next step) — enhanced to sync delivery when applicable

### Phase 4: Remove Delivery Page

1. Delete `src/routes/(app)/[slug]/delivery/` directory
2. Remove `🚚 Pengantaran` from sidebar in `+layout.svelte` (actually: keep the sidebar link but point to `/orders?tab=pengantaran`)

### Phase 5: Redirect legacy links

1. Add redirect in delivery route or hooks: `/delivery` → `/orders?tab=pengantaran`

---

## 7. What Stays, What Goes

### Stays (data layer):
- `delivery_schedules` table — unchanged
- `drivers` table — unchanged
- `delivery_routes`, `route_stops` tables — unchanged
- POS auto-creates delivery_schedules — unchanged
- `tipe_delivery`, `delivery_status`, `slot_waktu` enums — unchanged

### Goes (UI layer):
- `/delivery` page component — removed
- Delivery page server load function — removed
- Delivery page actions (merged into orders) — migrated
- Sidebar "🚚 Pengantaran" separate link — replaced with tab link

### Changes:
- Orders `+page.server.ts` — enhanced load + new actions
- Orders `+page.svelte` — tab bar + inline delivery cards
- Sidebar `+layout.svelte` — one line change

---

## 8. Wireframe: Unified Orders Page

```
╔══════════════════════════════════════════════════════╗
║ 📋 Pesanan                                          ║
║                                                     ║
║ [Semua (20)] [Aktif (5)] [🚚 Pengantaran (3)] [Selesai (12)] ║
║                                                     ║
║ Filter: [diterima ▾]  🔍 [Cari pesanan...]          ║
║                                                     ║
║ ┌─────────────────────────────────────────────────┐ ║
║ │ #GEVA-001    Siti Rahmawati   [dijemput_driver] │ ║
║ │ Cuci Kering Setrika 5kg · Rp35.000             │ ║
║ │ ┌─────────────────────────────────────────────┐ │ ║
║ │ │ 🛵 Jemput · Indra · Driver Berangkat        │ │ ║
║ │ │    Jl. Thamrin 91 · Pagi (08:00-10:00)     │ │ ║
║ │ │    [✓ Dijemput]  [✗ Batal]                  │ │ ║
║ │ ├─────────────────────────────────────────────┤ │ ║
║ │ │ 🚚 Antar · Belum dijadwalkan                │ │ ║
║ │ │    Dijadwalkan 3 Jun · Sore (14:00-18:00)   │ │ ║
║ │ └─────────────────────────────────────────────┘ │ ║
║ │ [Lanjutkan ke diterima →]                      │ ║
║ └─────────────────────────────────────────────────┘ ║
║                                                     ║
║ ┌─────────────────────────────────────────────────┐ ║
║ │ #GEVA-002    Budi Santoso     [dalam_pengiriman]│ ║
║ │ Cuci Kering Setrika 7kg · Rp49.000             │ ║
║ │ ┌─────────────────────────────────────────────┐ │ ║
║ │ │ 🛵 Jemput · Rudi · Selesai ✓                │ │ ║
║ │ │ 🚚 Antar · Rudi · Driver Berangkat          │ │ ║
║ │ │    Jl. Anggrek 78 · Sore (14:00-18:00)      │ │ ║
║ │ │    [✓ Terkirim]                             │ │ ║
║ │ └─────────────────────────────────────────────┘ │ ║
║ │ [Lanjutkan ke selesai →]                        │ ║
║ └─────────────────────────────────────────────────┘ ║
║                                                     ║
║ ┌─────────────────────────────────────────────────┐ ║
║ │ #GEVA-005    Rina Marlina      [proses_cuci]    │ ║
║ │ Cuci Basah 2kg · Rp10.000                      │ ║
║ │ (no delivery — drop_ambil)                      │ ║
║ │ [Lanjutkan ke siap_diambil →]                   │ ║
║ └─────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════╝
```

---

## 9. Files to Change

| File | Change |
|------|--------|
| `src/routes/(app)/[slug]/orders/+page.server.ts` | Add tab filter, delivery data, driver actions |
| `src/routes/(app)/[slug]/orders/+page.svelte` | Tab bar, inline delivery cards, delivery actions |
| `src/routes/(app)/+layout.svelte` | Sidebar link update (optional: keep or remove) |
| `src/routes/(app)/[slug]/delivery/+page.server.ts` | Delete |
| `src/routes/(app)/[slug]/delivery/+page.svelte` | Delete |

### Files NOT changed:
- `supabase/migrations/*` — no schema changes
- `src/routes/(app)/[slug]/pos/*` — POS flow unchanged
- `src/lib/supabase/server.ts` — unchanged
- `src/hooks.server.ts` — unchanged
- All other pages — unchanged

---

## 10. Risks & Tradeoffs

| Risk | Mitigation |
|------|-----------|
| Orders page becomes too heavy (large component) | Extract delivery card into separate Svelte component `DeliveryCard.svelte` |
| Too many queries on `/orders?tab=pengantaran` | Delivery data already fetched in bulk; only +1 query per page load |
| Users accustomed to separate delivery page | Keep sidebar link as `/orders?tab=pengantaran` for muscle memory; add ?tab= hint on navigation |
| Mobile UX: inline delivery cards push order info down | Collapsible delivery section (click to expand), or horizontal scroll on mobile |

---

## 11. Open Questions

1. **Should sidebar keep "🚚 Pengantaran" as a shortcut to `/orders?tab=pengantaran`?**  
   → Yes. It's a common workflow entry point. Just redirect to the tab.

2. **Should the delivery page be removed entirely, or should it redirect for a transition period?**  
   → Redirect for 1-2 sprints, then remove. Add a banner: "Pengantaran sekarang ada di halaman Pesanan →"

3. **What about the driver management (add driver) that currently lives in delivery page?**  
   → Move to a small modal accessible from both orders page and settings page. Or keep it in settings.

4. **Should we keep `delivery_routes` and `route_stops` for future batch delivery optimization?**  
   → Yes. Those tables are for route planning (optimize N pickups in one trip), which is a separate feature from per-order delivery tracking.

---

## 12. Verification Plan

1. Create order with `jemput_antar` via POS → verify it appears in `tab=pengantaran` with both jemput + antar cards
2. Assign driver from orders page → verify delivery_status updates in DB
3. Advance delivery status from orders page → verify order status syncs on completion
4. Create order with `drop_ambil` → verify it does NOT appear in `tab=pengantaran`
5. Filter by status → verify orders with delivery show inline delivery info
6. Existing delivery page URL → verify redirect to `/orders?tab=pengantaran`
7. Build passes ✅
