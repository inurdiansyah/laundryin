# Plan: Delivery Driver Assignment + Settings Fix

## Goal

Three interconnected problems to solve:

1. **Order workflow `dijemput_driver` lacks driver selection** — operator clicks "Proses ke dijemput driver" but no prompt to pick a driver
2. **Delivery menu redesign** — replace standalone delivery_schedules list with a task-based board where drivers claim tasks; deliveries should be auto-generated from orders needing pickup/dropoff
3. **Settings profile alamat not saving** + **no toast confirmations** across settings operations

---

## Context

- Project: laudryin at `/Users/inurdiansyah/project/laudryin`
- Stack: SvelteKit + Supabase + Tailwind CSS
- Current auth: per-tenant RLS via `user_has_tenant_access(tenant_id)` and `get_current_tenant_id()`
- Orders have `workflow text[]` — dynamically generated per service + jalur
- Delivery flow is triggered by POS server when jalur = `jemput_ambil` or `jemput_antar` or `drop_antar`

### What works
- POS auto-creates `delivery_schedules` for jemput/antar orders
- Orders page shows next status button based on workflow array
- Settings page renders profile form with nama, alamat, nomor_hp
- Settings page has toast (`successMessage`) and form handling (`handleProfileResult`)

### Actual bugs found

**Bug A — RLS policy missing for tenants UPDATE:**
File: `supabase/migrations/20260531091719_init_schema.sql` line 435-440
Only `tenants_select_own` exists. There is NO `tenants_update` policy.
Supabase silently blocks the UPDATE, returns no error to the client (returns success but no rows affected). The `invalidateAll()` reloads the old data from DB.

**Bug B — Toast disappears after invalidateAll():**
`handleProfileResult` calls `showSuccess(msg)` then `invalidateAll()`. `invalidateAll()` re-runs the page load function which updates `data` — Svelte re-renders the page, and since `successMessage` is a local `$state`, the component state is **not** lost on data invalidation. However, the `invalidateAll()` may cause `applyAction` result to be consumed before the toast renders. The actual issue is more subtle: `invalidateAll` triggers a re-render cycle and the form-level `use:enhance` callback already called `applyAction(result)` — the result was already applied. The `invalidateAll` is redundant here and may cause the successMessage to flash then disappear because the `$effect` on the form result doesn't clear it. But the real issue is **Bug A** — `update_profile` returns success but DB doesn't actually change, so after invalidateAll the data reload shows old values (seems like "not saved").

**Bug C — Layanan CRUD lacks invalidateAll:**
`handleResult` for add/update/delete layanan only calls `showSuccess` + `closeLayananModal()` — no `invalidateAll()`. After closing the modal, the list doesn't refresh.

---

## Proposed Changes

### Phase 1: Fix Settings — DB + Toast (20 min)

**1a. Add missing RLS policy for tenants UPDATE**

File: new migration `supabase/migrations/20260601170000_fix_tenants_update_rls.sql`
```sql
-- Allow tenant owners to update their own tenant profile
create policy "tenants_update_own"
  on public.tenants for update
  using (id = (select get_current_tenant_id()))
  with check (id = (select get_current_tenant_id()));
```

**1b. Fix toast + refresh for all settings operations**

File: `src/routes/(app)/[slug]/settings/+page.svelte`

- `handleProfileResult`: keep `showSuccess` + `applyAction(result)` — remove `invalidateAll()` since `applyAction` is enough. Actually, we need BOTH: `applyAction` signals the form result to the UI, and `invalidateAll` refreshes the page data. The double-render is not the issue. The real fix is **1a**.

- `handleResult` (layanan): add `invalidateAll()` after `showSuccess` to refresh list

- Also add `invalidateAll()` to the delete handler

**1c. Verify toast persistence**

Add a `$effect` that resets `submitError` when form result changes (to clear stale errors after success). Actually, the current code already clears errors on new form submissions via `use:enhance={() => { submitError = ''; ... }}` — this is fine.

### Phase 2: Driver Selection on Order Status Change (30 min)

**2a. Server action — add driver_id to `update_status`**

File: `src/routes/(app)/[slug]/orders/+page.server.ts`

When the next status is `dijemput_driver`:
- Require `driver_id` from form data
- Validate driver belongs to same tenant and is active
- Auto-create `delivery_schedules` record for pickup
- The `update_status` return should include the driver name for the toast

**2b. Order detail UI — show driver picker when next step is `dijemput_driver`**

File: `src/routes/(app)/[slug]/orders/+page.svelte`

In the expanded order card, when `nextStatusLabel(order)` resolves to a `dijemput_driver`-type status:
- Instead of a single submit button, show:
  - Driver dropdown (select from tenant drivers)
  - "Proses ke dijemput driver" button (disabled until driver selected)

The form submits `order_id` + `driver_id` + current status.

**2c. Route-level: load drivers for the form**

File: `src/routes/(app)/[slug]/orders/+page.server.ts`

Add to `load()`:
```ts
supabase.from('drivers').select('id, nama, nomor_hp, status')
  .eq('tenant_id', tenantId).eq('status', 'aktif').order('nama')
```
Return as `data.drivers`.

### Phase 3: Delivery Task Board Redesign (45 min)

**3a. Conceptual model**

Current: `delivery_schedules` are standalone — each jemput/antar creates one row. They appear as separate cards. No way for drivers to "claim" tasks.

New: The delivery page becomes a **task board** with three columns:

```
┌─────────────────┬──────────────────┬─────────────────┐
│  Tersedia        │  Dalam Proses     │  Selesai         │
│  (terjadwal)     │  (driver_brgkt/   │  (selesai)       │
│                  │   dijemput/       │                  │
│                  │   tiba_di_lndry)  │                  │
├─────────────────┼──────────────────┼─────────────────┤
│ Order #LD-001   │ Order #LD-002    │ Order #LD-000   │
│ Jemput: 📅 12/6 │ Antar: 📅 12/6   │ Jemput: ✅      │
│ Alamat: Jl.X    │ Driver: Budi     │ Driver: Anto    │
│ [Driver ▼] [Ambil]│                │                 │
│                 │                  │                 │
└─────────────────┴──────────────────┴─────────────────┘
```

Each card = one order with its delivery needs (jemput + antar grouped). The order is the unit, not individual delivery schedule rows.

**3b. Server: load all delivery tasks grouped by order**

File: `src/routes/(app)/[slug]/delivery/+page.server.ts`

Already partially done in previous fix — `deliveryGroups` groups by order_id.
Add filter: only show deliveries for orders that have `status` not `selesai`/`dibatalkan` (active orders).
Add driver self-assignment: `assign_self` action where driver_id comes from the driver's user_id lookup.

**3c. Server: add `claim_task` action**

New action: a driver (from the driver list) clicks "Ambil Tugas" → updates `delivery_schedules.driver_id = <selected driver id>`, advances status to `driver_berangkat`.

**3d. UI: Kanban board layout**

File: `src/routes/(app)/[slug]/delivery/+page.svelte`

Rewrite the main delivery list area:
- 3-column grid: Tersedia / Dalam Proses / Selesai
- Each column renders `deliveryGroups` filtered by the group's most-advanced delivery status
- Each card shows:
  - Order number + customer name
  - List of deliveries (jemput icon + status, antar icon + status)
  - Driver assignment dropdown (for "Tersedia" column)
  - "Ambil Tugas" button for drivers
  - Status advance button (for "Dalam Proses" column)

**3e. Keep existing features:**
- Driver sidebar (desktop) — shows all drivers
- Add driver modal
- Pagination: now groups-based — page through orders, not deliveries
- Filter tabs: keep but simplified — Tersedia / Dalam Proses / Selesai (map to delivery status ranges)

---

## Files to Change

| File | Phase | Change |
|------|-------|--------|
| `supabase/migrations/20260601170000_fix_tenants_update_rls.sql` | 1a | NEW: add tenants UPDATE policy |
| `src/routes/(app)/[slug]/settings/+page.svelte` | 1b | Add `invalidateAll()` to layanan CRUD handlers |
| `src/routes/(app)/[slug]/orders/+page.server.ts` | 2a, 2c | Add driver lookup, modify `update_status` to accept `driver_id` and auto-create delivery |
| `src/routes/(app)/[slug]/orders/+page.svelte` | 2b | Show driver picker when next step involves driver |
| `src/routes/(app)/[slug]/delivery/+page.server.ts` | 3b, 3c | Refactor load to task-board model, add `claim_task` action |
| `src/routes/(app)/[slug]/delivery/+page.svelte` | 3d | Complete UI rewrite to Kanban board |

---

## Verification

1. **Settings alamat:** Navigate to Settings → Profil Toko → type alamat → Simpan → refresh page → alamat should persist. Green toast "Profil toko diperbarui" should appear.

2. **Settings layanan:** Add/edit/delete layanan → list should refresh without full page reload. Green toast on success.

3. **Orders driver selection:** Create order with "Jemput + Ambil" jalur → go to Orders → expand order → click "Proses ke dijemput driver" → driver dropdown appears → select driver → submit → delivery created, order status advances.

4. **Delivery task board:** Go to Pengantaran → see 3 columns → "Tersedia" shows unassigned delivery tasks → pick a driver → click "Ambil Tugas" → task moves to "Dalam Proses" → advance status → eventually "Selesai".

---

## Risks / Open Questions

1. **RLS migration:** Adding `tenants_update_own` policy is safe — only lets tenant owners (via `get_current_tenant_id()`) update their own profile. No breaking change.

2. **Driver claiming mechanism:** Should drivers "self-claim" (click their own name) or should admin/operator assign? User's description says "driver tinggal pilih mau ambil task yg mana". This implies self-service. But the current UI has both operator and driver views in one page. For now, implement both: admin can assign via dropdown, drivers can self-claim via button.

3. **Delivery grouping edge case:** What if an order has both jemput AND antar delivery? They should be one card with two sub-tasks. The grouping by `order_id` handles this. The card's column placement is determined by the **most advanced** sub-task (if antar is selesai but jemput is still terjadwal → card shows in "Dalam Proses"). Alternatively, group by the **least advanced** sub-task. Decision: use least-advanced so the card stays in the earliest relevant column.

4. **Pagination with grouped data:** Currently pagination works on raw delivery_schedules rows. After grouping, we paginate on unique orders. Need to rewrite the count logic. Simplest: fetch all active deliveries, group in server, paginate groups. For MVP with <100 orders/month this is fine.
