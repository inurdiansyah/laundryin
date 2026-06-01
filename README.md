# LaundryIn 

**Kelola Laundry Anda, Dari Mana Saja**

SaaS platform manajemen laundry rumahan kecil di Indonesia. Multi-tenant, mobile-first PWA, dengan POS, order tracking, pembukuan, inventori, antar jemput, dan notifikasi WhatsApp.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | SvelteKit (TypeScript) |
| Styling | TailwindCSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| PWA | Vite PWA Plugin |
| Hosting | Vercel |
| Maps | Leaflet.js + OpenStreetMap |

## Struktur Project

```
src/
  lib/
    components/      # Komponen Svelte reusable
    stores/          # Svelte stores (state global)
    supabase/        # Supabase client setup
    types/           # TypeScript interfaces & types
    utils/           # Helper functions (formatRupiah, dll)
    i18n/            # Bahasa Indonesia strings
  routes/
    +page.svelte     # Landing page
    auth/            # Login & register
    (app)/           # Layout tenant workspace
      [slug]/        # Tenant dashboard & modul
        pos/         # Point of Sale
        orders/      # Manajemen order
        customers/   # Pelanggan
        inventory/   # Inventori
        delivery/    # Antar Jemput
        members/     # Membership
        reports/     # Laporan
        settings/    # Pengaturan tenant
    superadmin/      # Dashboard platform
```

## Setup Development

```bash
# Install dependencies
npm install

# Copy env example
cp .env.example .env

# Edit .env dengan URL Supabase & Anon Key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Jalankan dev server
npm run dev

# Build production
npm run build

# Preview production build
npm run preview
```

## Paket SaaS

| Fitur | Free | Starter (Rp 49K) | Pro (Rp 99K) |
|-------|------|------------------|--------------|
| User | 2 | 5 | Unlimited |
| POS & Order Tracking | ✓ | ✓ | ✓ |
| Laporan Harian | ✓ | ✓ | ✓ |
| Laporan Bulanan | ✓ | ✓ | ✓ |
| Membership & Poin | - | ✓ | ✓ |
| Jadwal Antar Jemput | - | ✓ | ✓ |
| Optimasi Rute Driver | - | - | ✓ |
| Multi-cabang | - | - | ✓ |
| Custom Domain | - | - | ✓ |
| White Label | - | - | ✓ |

## Priority Roadmap (Fase 1 MVP)

1. ✅ Setup project & scaffold
2. 🔲 Supabase RLS + Auth multi-tenant
3. 🔲 Onboarding wizard (5 langkah)
4. 🔲 POS input order + combobox pelanggan
5. 🔲 Order tracking dashboard
6. 🔲 GoWA notifikasi WhatsApp
7. 🔲 Pembayaran (bayar awal/akhir)
8. 🔲 Laporan harian
9. 🔲 PWA installable
10. 🔲 Demo Gevana Laundry

---

*LaundryIn © 2026 — Gevana Laundry adalah tenant demo resmi.*
