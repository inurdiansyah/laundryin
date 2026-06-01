# Plan: Manajemen Pengguna — Admin Bikin Akun Pekerja + Set Password Langsung

**Date:** 2026-06-01
**Target:** `src/routes/(app)/[slug]/settings/`

---

## Konteks & Constraints Baru

| Constraint | Detail |
|------------|--------|
| **Free plan limit** | Admin + 1 pekerja = max 2 user. Starter: 5, Pro: unlimited |
| **No invite link** | Tidak pakai invite/email link — admin langsung bikin akun + set password |
| **Admin sets password** | Admin isi email, nama, role, dan password untuk pekerja |
| **Service role key** | Diperlukan untuk `auth.admin.createUser()` — harus ada di `.env` |
| **Role options** | Admin hanya bisa bikin worker (`kasir` atau `driver`), bukan admin lain |

---

## Arsitektur

```
Admin Settings Page
  └─ Form: email, nama, password, role (kasir/driver)
       └─ Server action "add_user":
            1. Validasi admin role
            2. Cek limit paket (free = max 2 user total termasuk admin)
            3. Panggil Supabase Auth admin API: createUser({ email, password, email_confirm: true })
            4. Insert ke tenant_users: { tenant_id, user_id, nama, email, role, status: 'aktif' }
            5. Return success → user langsung bisa login
```

---

## Prasyarat

### Service Role Key
Harus ada di `.env`:
```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```
Didapat dari Supabase Dashboard → Project Settings → API → `service_role` key.

Jika tidak ada, admin harus set manual. Tanpa ini, tidak bisa panggil `auth.admin.createUser()`.

### Supabase Auth settings
Di Supabase Dashboard → Authentication → Settings:
- Enable "Allow sign up via email/password" = ON
- "Confirm email" — bisa ON (email_confirm: true) supaya langsung aktif tanpa verifikasi

---

## Rencana Implementasi

### 1. Setup: Tambah `SUPABASE_SERVICE_ROLE_KEY` ke `.env`

User harus:
1. Buka Supabase Dashboard → Project Settings → API
2. Copy `service_role` key (secret, bukan anon/publishable)
3. Tambah ke `.env`: `SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx`

### 2. Lib: Buat `getServiceSupabase()` helper

**File:** `src/lib/supabase/server.ts`

```typescript
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export function getServiceSupabase(fetch?: typeof globalThis.fetch) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

### 3. Server: Actions baru di settings

**File:** `src/routes/(app)/[slug]/settings/+page.server.ts`

**Action `add_user`:**
```typescript
add_user: async ({ request, fetch, cookies, locals }) => {
  const supabase = getServerSupabase(fetch, cookies);
  const serviceSupabase = getServiceSupabase();
  const tenant = locals.tenant;
  
  // 1. Only admin can add users
  if (tenant?.role !== 'admin') return fail(403, { error: 'Hanya admin yang bisa menambah pengguna' });
  
  // 2. Parse form
  const { email, nama, password, role } = parseFormData(await request.formData());
  if (!email || !nama || !password || !role) return fail(400, { error: 'Semua field wajib diisi' });
  if (!['kasir', 'driver'].includes(role)) return fail(400, { error: 'Role tidak valid' });
  
  // 3. Check limit based on paket
  const paket = tenant?.paket || 'free';
  const { count } = await supabase.from('tenant_users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.tenant_id);
  
  const limits = { free: 2, starter: 5, pro: 999 };
  if ((count ?? 0) >= (limits[paket] ?? 2)) {
    return fail(400, { error: `Paket ${paket} maksimal ${limits[paket]} pengguna` });
  }
  
  // 4. Create auth user via service role
  const { data: authUser, error: authError } = await serviceSupabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nama }
  });
  if (authError) return fail(400, { error: authError.message });
  
  // 5. Insert into tenant_users
  const { error } = await supabase.from('tenant_users').insert({
    tenant_id: tenant.tenant_id,
    user_id: authUser.user.id,
    nama, email, role, status: 'aktif'
  });
  
  if (error) return fail(500, { error: error.message });
  return { success: true, message: `${nama} berhasil ditambahkan sebagai ${role}` };
}
```

**Action `remove_user`:**
```typescript
remove_user: async ({ request, fetch, cookies, locals }) => {
  // Only admin, only non-admin users (can't remove self/admin)
  const { user_id } = parseFormData(await request.formData());
  // Delete from tenant_users (don't delete auth user — they might have other tenants)
  const { error } = await supabase.from('tenant_users')
    .delete().eq('id', user_id).eq('tenant_id', tenant.tenant_id);
  if (error) return fail(500, { error: error.message });
  return { success: true, message: 'Pengguna dihapus' };
}
```

### 4. Frontend: Modal tambah user

**File:** `src/routes/(app)/[slug]/settings/+page.svelte`

**Tombol "+ Tambah Pengguna"** di header tab users (opsional: sembunyikan kalau role bukan admin atau limit tercapai).

**Modal form:**
- Email — input email
- Nama — input text
- Role — select: kasir / driver
- Password — input password (admin set manual)
- Submit button → panggil `add_user` action via form `use:enhance`

**Perubahan lain:**
- Toast success setelah user ditambahkan
- Di tiap row user: ikon 🗑️ (kalau bukan admin + bisa dihapus)
- Konfirmasi sebelum hapus
- Info limit: "2/5 pengguna" di header

### 5. Validasi Limit (UI feedback)

Tampilkan di header:
```
👤 Pengguna (2/5)
```
Atau untuk free:
```
👤 Pengguna (2/2) —  ⚠️ Paket Free penuh
```

Jika limit tercapai, tombol "+ Tambah Pengguna" disabled dengan tooltip "Upgrade ke paket Starter untuk tambah pengguna".

---

## Files yang berubah

| File | Perubahan |
|------|-----------|
| `.env` | + `SUPABASE_SERVICE_ROLE_KEY` (manual by user) |
| `src/lib/supabase/server.ts` | + `getServiceSupabase()` |
| `src/routes/(app)/[slug]/settings/+page.server.ts` | + actions: `add_user`, `remove_user`. Tambah `paket` & `userLimit` di load |
| `src/routes/(app)/[slug]/settings/+page.svelte` | + modal add user, + tombol hapus, + limit counter, + password field |

---

## Tidak Berubah

- **Auth register page** — tidak perlu diubah karena admin yang bikin akun, bukan user daftar sendiri
- **hooks.server.ts** — RPC `get_user_default_tenant` sudah mengembalikan role, tidak perlu diubah

---

## Risiko

1. **Service role key leak** — key ini sangat powerful (bypass RLS). Harus di `.env` (server-side only), JANGAN pakai `VITE_` prefix
2. **Password plaintext di form** — dikirim via HTTPS POST, aman. Tapi admin bisa lihat password yang diketik (acceptable — admin yang set)
3. **User sudah ada di auth.users** — kalau email sudah terdaftar, `createUser` akan error. Handle error dengan pesan jelas: "Email sudah terdaftar di sistem"
4. **Remove user tidak menghapus dari auth** — disengaja. User mungkin punya tenant lain. Kalau mau full delete, perlu service role lagi

---

## Open Questions

1. Apakah service role key tersedia? Tanpa ini, tidak bisa implementasi. Perlu dicek di Supabase Dashboard.
2. Apakah perlu toggle "aktif/nonaktif" untuk user? Atau cukup remove?
3. Apakah perlu edit user (ganti role, ganti password)? Bisa iterasi berikutnya.
