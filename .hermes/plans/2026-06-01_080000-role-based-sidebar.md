# Plan: Sidebar Navigation — Role-Based Visibility

**Date:** 2026-06-01
**Target:** `src/routes/(app)/[slug]/+layout.svelte`

---

## Context

Saat ini sidebar menampilkan 8 menu untuk semua role. Setelah implementasi manajemen pengguna, kasir dan driver bisa login — tapi mereka tidak boleh akses semua fitur.

### 3 Role

| Role | Bisa akses |
|------|-----------|
| **admin** | Semua (Dashboard, POS, Pesanan, Pelanggan, Inventori, Member, Laporan, Pengaturan) |
| **kasir** | Dashboard, POS, Pesanan, Pelanggan, Inventori, Member |
| **driver** | Dashboard, POS, Pesanan, Pelanggan, Inventori, Member |

**Yang disembunyikan dari kasir & driver:**
- **Laporan** (📈) — data sensitif revenue
- **Pengaturan** (⚙️) — hanya admin yang boleh manage

**Yang tetap sama semua role:**
- Dashboard, POS, Pesanan, Pelanggan, Inventori, Member

---

## Approach

### 1. Pass role ke layout data (jika belum)

`event.locals.tenant.role` sudah ada dari hooks authGuard. Cukup pastikan diteruskan ke `+layout.svelte`.

### 2. Filter sidebar links berdasarkan role

Di `+layout.svelte`, tambahkan `$derived` computed links yang memfilter berdasarkan `tenant.role`.

```ts
let sidebarLinks = $derived([
  { href: `/${tenant?.slug}`, label: 'Dashboard', icon: '📊' },
  { href: `/${tenant?.slug}/pos`, label: 'Kasir (POS)', icon: '🧺' },
  { href: `/${tenant?.slug}/orders`, label: 'Pesanan', icon: '📋' },
  { href: `/${tenant?.slug}/customers`, label: 'Pelanggan', icon: '👥' },
  { href: `/${tenant?.slug}/inventory`, label: 'Inventori', icon: '📦' },
  { href: `/${tenant?.slug}/members`, label: 'Member', icon: '💎' },
  // Admin only below
  ...(tenant?.role === 'admin' ? [
    { href: `/${tenant?.slug}/reports`, label: 'Laporan', icon: '📈' },
    { href: `/${tenant?.slug}/settings`, label: 'Pengaturan', icon: '⚙️' }
  ] : [])
]);
```

### 3. Server-side guard (defense in depth)

Meskipun UI menyembunyikan link, kasir/driver masih bisa mengetik URL langsung. Tambah guard di `hooks.server.ts` untuk redirect kalau role bukan admin akses `/reports` atau `/settings`.

Atau lebih simpel: guard di masing-masing `+page.server.ts` (sudah ada untuk settings, tambah untuk reports).

---

## Files to change

### 1. `src/routes/(app)/[slug]/+layout.svelte`
- Ganti array statis link jadi `sidebarLinks` $derived
- Filter Laporan dan Pengaturan untuk admin only
- ~5 line change

### 2. `src/routes/(app)/[slug]/reports/+page.server.ts`
- Tambah guard: if `locals.tenant.role !== 'admin'` → redirect ke dashboard
- ~3 line change

### 3. `src/routes/(app)/[slug]/settings/+page.server.ts`
- Cek apakah sudah ada guard untuk non-admin (saat ini hanya di actions, bukan di load)
- Tambah di load function if role !== 'admin'
- ~3 line change

### 4. `src/hooks.server.ts`
- Alternatif: tambah role-based guard di sini instead of per-file
- Lebih DRY tapi kurang eksplisit
- **Keputusan: guard per-file** — lebih eksplisit dan mudah dimaintain

---

## Edge cases

- **Kasir ketik URL `/reports`** → redirect ke dashboard
- **Driver ketik URL `/settings`** → redirect ke dashboard  
- **Reload halaman** — role tetap ada di `event.locals.tenant` (dari hook), aman

---

## Verification

1. Login sebagai admin → semua 8 menu muncul
2. Login sebagai kasir → hanya 6 menu (tanpa Laporan & Pengaturan)
3. Login sebagai driver → hanya 6 menu
4. Kasir ketik `/slug/reports` di address bar → redirect ke dashboard
5. Driver ketik `/slug/settings` di address bar → redirect ke dashboard

---

## Open questions
- Perlu redirect ke `/slug` (dashboard) atau tampilkan 403 page?
  - **Keputusan: redirect ke `/slug` dashboard** — lebih smooth UX, tidak perlu bikin error page
