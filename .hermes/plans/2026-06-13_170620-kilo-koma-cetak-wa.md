# LaundryIn — Kilo Koma, Cetak Billing, WhatsApp Integration Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Implement 3 MVP features: (1) decimal kg input in POS, (2) invoice printing/PDF, (3) per-tenant WhatsApp dashboard + GoWA integration.

**Architecture:** SvelteKit 5 full-stack with Supabase backend. WhatsApp uses external GoWA HTTP API per tenant. Invoice uses html2canvas + jsPDF (already installed). POS decimal input reuses existing `parseFloat` backend with new frontend controls.

**Tech Stack:** SvelteKit 5, Supabase, html2canvas + jsPDF (existing), GoWA REST API (external), TypeScript 6, Tailwind CSS 4

---

## Current State Summary

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| **Kilo Koma** | Backend `parseFloat(formData)` at `pos/+page.server.ts:45`, `OrderItem.qty: number`, `Order.berat_total: number` | Frontend only has +/- int buttons. `berat_total` hardcoded to `0` on insert. No weight input field for kg-type services |
| **Cetak Billing** | `window.print()` on success toast. jspdf + html2canvas installed. `generateNomorOrder()` works | No dedicated invoice page/component. No thermal printer support. No tenant branding in invoice. No "Powered by LaundryIn" footer |
| **WhatsApp** | `NotificationLog` TypeScript interface (`laundryin.ts:184-192`). DB schema has `notifications_log` table | Zero implementation code. No GoWA settings UI. No message template system. No trigger integration with order lifecycle. GoWA repo not cloned locally |

---

## Feature 1: Kilo Koma (Decimal Input)

### Task 1.1: Add decimal weight input to POS cart items

**Objective:** Replace integer +/- buttons with decimal input field for services with satuan='kg'

**Files:**
- Modify: `src/routes/(app)/[slug]/pos/+page.svelte` (cart section, ~lines 240-340)

**Step 1: Locate qty input section**

Open `pos/+page.svelte` and find the cart item rendering section where `qtyMap` increment/decrement buttons are. The current pattern is:
```svelte
<button onclick={() => updateQty(item.layanan_id, -1)}>-</button>
<span>{qtyMap[item.layanan_id] || 1}</span>
<button onclick={() => updateQty(item.layanan_id, 1)}>+</button>
```

**Step 2: Add decimal input for kg items**

Replace with:
```svelte
{#if item.satuan === 'kg'}
  <div class="flex items-center gap-1">
    <button class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 hover:bg-gray-200"
      onclick={() => updateQty(item.layanan_id, -0.5)}>−</button>
    <input type="number" step="0.1" min="0.5" max="999"
      value={qtyMap[item.layanan_id] || 1}
      oninput={(e) => updateQty(item.layanan_id, 0, parseFloat(e.target.value))}
      class="w-16 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
    <button class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 hover:bg-gray-200"
      onclick={() => updateQty(item.layanan_id, 0.5)}>+</button>
  </div>
{:else}
  <!-- existing integer counter for piece/set -->
  <div class="flex items-center gap-2">
    <button onclick={() => updateQty(item.layanan_id, -1)}>-</button>
    <span class="w-6 text-center font-medium">{qtyMap[item.layanan_id] || 1}</span>
    <button onclick={() => updateQty(item.layanan_id, 1)}>+</button>
  </div>
{/if}
```

**Step 3: Update `updateQty` function**

Modify the `updateQty` function to accept an absolute value override:
```ts
function updateQty(layananId: string, delta: number, absolute?: number) {
  const current = qtyMap[layananId] || 1;
  let newQty: number;
  
  if (absolute !== undefined) {
    newQty = Math.max(0.1, absolute);
  } else {
    const satuan = layanan.find(l => l.id === layananId)?.satuan;
    const step = satuan === 'kg' ? 0.5 : 1;
    newQty = Math.max(0.1, current + delta);
  }
  
  if (newQty <= 0) {
    const next = { ...qtyMap };
    delete next[layananId];
    qtyMap = next;
    return;
  }
  qtyMap = { ...qtyMap, [layananId]: Math.round(newQty * 10) / 10 };
}
```

**Step 4: Update subtotal calculation**

The current subtotal calc at ~line 80 should already work since it's `harga * qty`. Verify the `$derived` computation handles decimals:
```ts
let cartItems = $derived(
  Object.entries(qtyMap).map(([layananId, qty]) => {
    const svc = layanan.find(l => l.id === layananId);
    return { ...svc!, qty, subtotal: (svc?.harga || 0) * qty };
  })
);
```

**Verification:** Run `npm run build` — should compile without errors. Test manually: open POS, add a kg service, type "2.5" — subtotal should update.

### Task 1.2: Compute berat_total from kg items

**Objective:** Auto-compute `berat_total` as sum of qty for kg-type order items

**Files:**
- Modify: `src/routes/(app)/[slug]/pos/+page.server.ts:191`

**Step: Replace hardcoded `berat_total: 0`**

Current (line 191):
```ts
berat_total: 0,
```

Replace with:
```ts
berat_total: orderItems
  .filter(oi => oi.satuan === 'kg')
  .reduce((sum, oi) => sum + oi.qty, 0),
```

But `satuan` is not in the items array. Need to look up from `layananMap`. Add after line 148 (where `layananMap` is built):
```ts
const berat_total = items
  .map(i => ({ qty: i.qty, satuan: layananMap.get(i.layanan_id)?.satuan }))
  .filter(i => i.satuan === 'kg')
  .reduce((sum, i) => sum + i.qty, 0);
```

Then line 191 becomes:
```ts
berat_total,
```

**Verification:** Build + create test order with 2.5kg — `berat_total` should be 2.5 in DB.

### Task 1.3: Display kg correctly in order detail

**Objective:** Show weight with 1 decimal place in orders listing

**Files:**
- Modify: `src/routes/(app)/[slug]/orders/+page.svelte` — where order details are rendered (~lines 490-520)

**Step: Format berat_total display**

Find where berat_total is displayed. Add:
```svelte
<span>Berat: {order.berat_total > 0 ? order.berat_total.toFixed(1) + ' kg' : '-'}</span>
```

**Verification:** `npm run build` passes.

---

## Feature 2: Cetak Billing / Invoice

### Task 2.1: Create invoice template component

**Objective:** Build a hidden invoice HTML template for PDF generation

**Files:**
- Create: `src/lib/components/InvoiceTemplate.svelte`

**Complete code:**
```svelte
<script lang="ts">
  import { formatRupiah, formatTanggal } from '$lib/utils/format';
  import type { Order, OrderItem, Tenant } from '$lib/types/laundryin';

  let { order, items, tenant, customer }: {
    order: Order;
    items: OrderItem[];
    tenant: { nama: string; alamat?: string; nomor_hp?: string };
    customer: { nama: string; nomor_hp: string; alamat?: string };
  } = $props();
</script>

<div class="invoice-root bg-white p-6" style="width: 300px; font-family: system-ui, sans-serif;" id="invoice-print">
  <!-- Header -->
  <div class="text-center border-b-2 border-gray-800 pb-3 mb-3">
    <h2 class="text-lg font-bold text-gray-900">{tenant.nama}</h2>
    {#if tenant.alamat}<p class="text-xs text-gray-500">{tenant.alamat}</p>{/if}
    {#if tenant.nomor_hp}<p class="text-xs text-gray-500">{tenant.nomor_hp}</p>{/if}
  </div>

  <!-- Order Info -->
  <div class="text-xs mb-3 space-y-0.5">
    <div class="flex justify-between">
      <span class="text-gray-500">No. Order</span>
      <span class="font-semibold">{order.nomor_order}</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-500">Tanggal</span>
      <span>{formatTanggal(order.created_at)}</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-500">Pelanggan</span>
      <span class="font-semibold">{customer.nama}</span>
    </div>
    {#if customer.alamat}
    <div class="flex justify-between">
      <span class="text-gray-500">Alamat</span>
      <span class="text-right max-w-[60%]">{customer.alamat}</span>
    </div>
    {/if}
  </div>

  <!-- Items Table -->
  <table class="w-full text-xs mb-3">
    <thead>
      <tr class="border-b border-gray-300">
        <th class="text-left py-1">Layanan</th>
        <th class="text-center py-1">Qty</th>
        <th class="text-right py-1">Harga</th>
        <th class="text-right py-1">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      {#each items as item}
      <tr class="border-b border-gray-100">
        <td class="py-1">{item.nama_layanan}</td>
        <td class="text-center">{item.qty} {item.satuan}</td>
        <td class="text-right">{formatRupiah(item.harga_satuan)}</td>
        <td class="text-right">{formatRupiah(item.subtotal)}</td>
      </tr>
      {/each}
    </tbody>
  </table>

  <!-- Summary -->
  <div class="text-xs mb-3 space-y-0.5">
    <div class="flex justify-between">
      <span class="text-gray-500">Subtotal</span>
      <span>{formatRupiah(order.subtotal)}</span>
    </div>
    {#if order.diskon > 0}
    <div class="flex justify-between">
      <span class="text-gray-500">Diskon</span>
      <span class="text-red-500">-{formatRupiah(order.diskon)}</span>
    </div>
    {/if}
    <div class="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
      <span>Total</span>
      <span>{formatRupiah(order.total)}</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-500">Metode Bayar</span>
      <span>{order.metode_bayar || '-'}</span>
    </div>
    <div class="flex justify-between">
      <span class="text-gray-500">Status Bayar</span>
      <span class="{order.status_bayar === 'lunas' ? 'text-green-600' : 'text-red-500'}">
        {order.status_bayar === 'lunas' ? 'Lunas' : order.status_bayar === 'sebagian' ? 'Sebagian' : 'Belum Lunas'}
      </span>
    </div>
  </div>

  <!-- Footer -->
  <div class="text-center text-[10px] text-gray-400 border-t border-gray-200 pt-2">
    <p>Powered by LaundryIn</p>
  </div>
</div>
```

**Verification:** Component compiles with `npm run build`.

### Task 2.2: Add invoice PDF generation logic

**Objective:** Create utility to render InvoiceTemplate → PDF

**Files:**
- Create: `src/lib/utils/invoice.ts`

**Complete code:**
```ts
import { jsPDF } from 'jspdf';

/**
 * Generate PDF invoice from HTML element.
 * For thermal 58mm/80mm, width is set accordingly.
 */
export async function generateInvoicePDF(
  elementId: string,
  nomorOrder: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Invoice element not found');

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = 80; // 80mm thermal
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [imgWidth, imgHeight]
  });

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  pdf.save(`Invoice-${nomorOrder}.pdf`);
}
```

**Verification:** `npm run build` passes.

### Task 2.3: Add "Cetak Struk" button with invoice preview + PDF on order detail

**Objective:** Replace `window.print()` with proper invoice component rendering + PDF download

**Files:**
- Modify: `src/routes/(app)/[slug]/pos/+page.svelte` (success state ~lines 125-181)
- Modify: `src/routes/(app)/[slug]/orders/+page.svelte` (order detail ~lines 491+)

**Step 1: POS success page**

In `pos/+page.svelte`, find the success toast section. Replace `window.print()` with:
```svelte
<script>
  import { onMount } from 'svelte';
  import InvoiceTemplate from '$lib/components/InvoiceTemplate.svelte';
  import { generateInvoicePDF } from '$lib/utils/invoice';

  let showInvoice = $state(false);
  let invoiceData = $state<any>(null);

  async function cetakStruk() {
    if (!invoiceData) return;
    
    // Show the invoice briefly in a modal, then trigger PDF download
    showInvoice = true;
    await new Promise(r => setTimeout(r, 500));
    await generateInvoicePDF('invoice-print', invoiceData.nomor_order);
    showInvoice = false;
  }
</script>

<!-- Invoice Modal (hidden from view but rendered for PDF capture) -->
{#if showInvoice && invoiceData}
  <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" 
       onclick={() => showInvoice = false} role="dialog" tabindex="-1"
       onkeydown={(e) => { if (e.key === 'Escape') showInvoice = false; }}>
    <div class="bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-auto" 
         onclick={(e) => e.stopPropagation()} role="document">
      <div class="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
        <h3 class="font-semibold text-gray-800">Preview Struk</h3>
        <button onclick={() => showInvoice = false} class="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <div class="p-2">
        <InvoiceTemplate {...invoiceData} />
      </div>
      <div class="sticky bottom-0 bg-white p-4 border-t flex gap-2">
        <button onclick={cetakStruk} class="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-medium text-sm">
          📥 Download PDF
        </button>
        <button onclick={() => showInvoice = false} class="px-4 py-2.5 text-gray-500 text-sm">
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
```

**Step 2: Wire data after order creation**

After successful order creation in the server action response, include enough data for the invoice. Add to the return:
```ts
return {
  success: true,
  adminMessage: `Order ${order.nomor_order} berhasil dibuat!`,
  invoice: {
    order,
    items: orderItems,
    tenant: { nama: (locals.tenant as any)?.nama_toko, ... },
    customer: { nama: ..., nomor_hp: ... }
  }
};
```

**Verification:** Create order → see invoice preview → download PDF.

### Task 2.4: Add "Cetak Invoice" button on orders list

**Objective:** Add invoice button to each order row and the expanded order detail

**Files:**
- Modify: `src/routes/(app)/[slug]/orders/+page.svelte`

**Step: Add button in order detail expanded section (~line 491)**

Add a "🖨️ Cetak Invoice" button in the order header section:
```svelte
<button onclick={() => openInvoice(order)} 
  class="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
  🖨️ Cetak Invoice
</button>
```

Add `openInvoice` function that fetches order items and opens the invoice modal (same pattern as POS).

**Verification:** `npm run build` passes.

---

## Feature 3: WhatsApp Integration (GoWA)

### Task 3.1: Clone GoWA repo and document API

**Objective:** Understand GoWA API surface for integration

**Note:** GoWA repo exists at `github.com/inurdiansyah/go-whatsapp-web-multidevice` (found in subagent research). API likely provides endpoints for sending messages, QR login, logout, and connection status check.

**Step 1: Clone GoWA**

```bash
cd /home/ain && /home/ain/.local/bin/gh repo clone inurdiansyah/go-whatsapp-web-multidevice gowa-ref
```

**Step 2: Document key endpoints**

Read `README.md` and main source files in the GoWA repo. Create reference file at `src/lib/whatsapp/reference.md`:
```
GoWA API Endpoints (documented from source):
- POST /api/send-message — send text to number
- GET /api/qr — get QR code for WA Web login
- GET /api/status — check connection status
- POST /api/logout — disconnect
```

**Verification:** Repo cloned, API endpoints documented.

### Task 3.2: Create GoWA client utility

**Objective:** TypeScript utility to call GoWA API

**Files:**
- Create: `src/lib/whatsapp/gowa-client.ts`

**Complete code:**
```ts
export interface GoWAConfig {
  base_url: string;  // e.g. "http://192.168.1.100:3000"
  api_token: string;
}

export interface SendMessageParams {
  nomor: string;       // "62812xxxx" (no + prefix)
  pesan: string;
}

export type GoWAStatus = 'connected' | 'disconnected' | 'loading' | 'error';

export class GoWAClient {
  private config: GoWAConfig;

  constructor(config: GoWAConfig) {
    this.config = config;
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.config.base_url}${path}`;
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.api_token}`
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000)
    });
  }

  async sendMessage(params: SendMessageParams): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await this.request('POST', '/api/send-message', {
        phone: params.nomor.replace(/^0/, '62').replace(/[^0-9]/g, ''),
        message: params.pesan
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: (body as any).error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async getQR(): Promise<{ success: boolean; qr?: string; error?: string }> {
    try {
      const res = await this.request('GET', '/api/qr');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { success: true, qr: (data as any).qr || (data as any).image };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async getStatus(): Promise<{ status: GoWAStatus; error?: string }> {
    try {
      const res = await this.request('GET', '/api/status');
      if (res.status === 401) return { status: 'disconnected' };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { status: (data as any).status === 'connected' ? 'connected' : 'disconnected' };
    } catch (e) {
      return { status: 'error', error: (e as Error).message };
    }
  }

  async logout(): Promise<boolean> {
    try {
      const res = await this.request('POST', '/api/logout');
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

**Verification:** `npm run build` passes.

### Task 3.3: Create WhatsApp settings tab in tenant settings

**Objective:** Add "WhatsApp" tab to settings page where tenant configures their GoWA connection

**Files:**
- Modify: `src/routes/(app)/[slug]/settings/+page.svelte`
- Modify: `src/routes/(app)/[slug]/settings/+page.server.ts`

**Step 1: Add tab to settings navigation**

Find the tab navigation in settings `+page.svelte`. Add:
```svelte
<button onclick={() => activeSettingTab = 'whatsapp'} 
  class:active={activeSettingTab === 'whatsapp'}>
  💬 WhatsApp
</button>
```

**Step 2: Create WhatsApp panel**

```svelte
{#if activeSettingTab === 'whatsapp'}
  <div class="space-y-4">
    <h2 class="text-lg font-bold text-gray-800">⚡ Koneksi WhatsApp (GoWA)</h2>
    <p class="text-sm text-gray-500">Hubungkan akun WhatsApp bisnis Anda untuk mengirim notifikasi otomatis ke pelanggan.</p>

    <!-- Status Card -->
    <div class="p-4 rounded-xl border {gowaStatus === 'connected' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}">
      <div class="flex items-center gap-3">
        <span class="text-2xl">
          {gowaStatus === 'connected' ? '🟢' : gowaStatus === 'loading' ? '🟡' : '🔴'}
        </span>
        <div>
          <p class="font-semibold {gowaStatus === 'connected' ? 'text-green-700' : 'text-gray-700'}">
            {gowaStatus === 'connected' ? 'Terhubung' : 'Belum Terhubung'}
          </p>
          <p class="text-xs text-gray-500 mt-0.5">
            {gowaStatus === 'connected' ? 'WA siap mengirim notifikasi' : 'Masukkan URL GoWA dan API token untuk memulai'}
          </p>
        </div>
      </div>
    </div>

    <!-- Config Form -->
    <form method="POST" action="?/save_gowa" use:enhance class="space-y-3">
      <div>
        <label for="gowa_url" class="block text-sm font-medium text-gray-600 mb-1.5">URL Server GoWA</label>
        <input type="url" id="gowa_url" name="gowa_url" value={gowaConfig?.base_url || ''}
          placeholder="https://gowa.tenant-anda.com" required
          class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
      </div>
      <div>
        <label for="gowa_token" class="block text-sm font-medium text-gray-600 mb-1.5">API Token</label>
        <input type="password" id="gowa_token" name="gowa_token" value={gowaConfig?.api_token || ''}
          placeholder="Token dari GoWA dashboard" required
          class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500" />
      </div>
      <div class="flex gap-2">
        <button type="submit" class="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
          💾 Simpan
        </button>
        <button type="button" onclick={testConnection}
          class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
          🔌 Test Koneksi
        </button>
      </div>
    </form>

    <!-- QR Code Section (for scanning WA Web) -->
    {#if gowaStatus === 'disconnected' && gowaConfig?.base_url}
      <div class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
        <p class="text-sm font-medium text-yellow-800 mb-2">📱 Scan QR untuk menghubungkan WhatsApp</p>
        <button onclick={getQRCode} class="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200">
          🔍 Tampilkan QR Code
        </button>
        {#if qrImage}
          <div class="mt-3 flex justify-center">
            <img src={qrImage} alt="GoWA QR Code" class="w-48 h-48 border rounded-lg" />
          </div>
        {/if}
      </div>
    {/if}

    <!-- Template Pesan (future) -->
    <div class="mt-6 pt-4 border-t border-gray-200">
      <p class="text-sm text-gray-400">📝 Template pesan dikelola di menu terpisah (coming soon)</p>
    </div>
  </div>
{/if}
```

**Step 3: Add server action for saving GoWA config**

In `settings/+page.server.ts`, add new action:
```ts
export const actions: Actions = {
  // ... existing actions ...
  
  save_gowa: async ({ request, fetch, cookies, locals }) => {
    const supabase = getServerSupabase(fetch, cookies);
    const tenantId = locals.tenant?.tenant_id;
    const form = await request.formData();
    
    const gowa_url = form.get('gowa_url') as string;
    const gowa_token = form.get('gowa_token') as string;

    await supabase
      .from('tenant_configs')
      .upsert({
        tenant_id: tenantId,
        config_key: 'gowa',
        config_value: JSON.stringify({ base_url: gowa_url, api_token: gowa_token }),
        updated_at: new Date().toISOString()
      });

    return { success: true };
  }
};
```

**Verification:** `npm run build` passes.

### Task 3.4: Create DB migration for tenant_configs and notifications_log

**Objective:** Ensure Supabase tables exist for GoWA config and message logs

**Files:**
- Create: `supabase/migrations/20260613000000_add_tenant_configs.sql`
- Create: `supabase/migrations/20260613000001_add_notifications_log.sql`

**Migration 1 — tenant_configs:**
```sql
CREATE TABLE IF NOT EXISTS tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, config_key)
);

ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_configs_policy ON tenant_configs 
  FOR ALL USING (tenant_id = auth.jwt() -> 'app_metadata' ->> 'tenant_id'::text);
```

**Migration 2 — notifications_log:**
```sql
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nomor_tujuan TEXT NOT NULL,
  template TEXT NOT NULL,
  pesan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'terkirim' CHECK (status IN ('terkirim', 'gagal')),
  error_detail TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_log_tenant ON notifications_log(tenant_id, created_at DESC);
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
```

**Verification:** Run `supabase migration up` (if CLI available) or note that these get applied on deploy.

### Task 3.5: Create notification dispatch system

**Objective:** Server-side utility that sends WA messages and logs them automatically following order lifecycle events

**Files:**
- Create: `src/lib/whatsapp/dispatcher.ts`
- Modify: `src/lib/whatsapp/gowa-client.ts`

**Complete code (`dispatcher.ts`):**
```ts
import { GoWAClient, type GoWAConfig } from './gowa-client';
import { getServiceSupabase } from '$lib/supabase/server';

const TEMPLATES: Record<string, (params: Record<string, string>) => string> = {
  order_baru: (p) => `👋 Halo ${p.nama}! Pesanan #${p.nomor_order} sudah kami terima.
📋 Layanan: ${p.layanan}
⚖️ Berat: ${p.berat} kg
💰 Total: ${p.total}
⏰ Estimasi selesai: ${p.estimasi}

Terima kasih sudah laundry di ${p.nama_toko}! 🙏`,
  
  siap_diambil: (p) => `✅ Pesanan #${p.nomor_order} sudah siap diambil.
🧺 Total: ${p.total}
📍 ${p.nama_toko}

Silakan ambil di toko kami. Terima kasih! 😊`,
  
  siap_diantar: (p) => `🚚 Pesanan #${p.nomor_order} siap diantar ke alamat Anda.
📍 ${p.alamat}

Driver akan segera berangkat. Pantau status di link berikut.`,
};

export async function sendNotification(
  tenantId: string,
  nomorTujuan: string,
  template: string,
  params: Record<string, string>
): Promise<void> {
  // 1. Get GoWA config from tenant_configs
  const supabase = getServiceSupabase();
  const { data: configRow } = await supabase
    .from('tenant_configs')
    .select('config_value')
    .eq('tenant_id', tenantId)
    .eq('config_key', 'gowa')
    .single();

  if (!configRow?.config_value) return; // WA not configured

  const config = configRow.config_value as GoWAConfig;
  const client = new GoWAClient(config);

  // 2. Generate message
  const templateFn = TEMPLATES[template];
  if (!templateFn) return;
  const pesan = templateFn(params);

  // 3. Send & log
  const result = await client.sendMessage({ nomor: nomorTujuan, pesan });

  await supabase.from('notifications_log').insert({
    tenant_id: tenantId,
    nomor_tujuan: nomorTujuan,
    template,
    pesan,
    status: result.success ? 'terkirim' : 'gagal',
    error_detail: result.error || null
  });
}

export function formatPhoneForWA(phone: string): string {
  // 0812xxxx → 62812xxxx
  return phone.replace(/^0/, '62').replace(/[^0-9]/g, '');
}
```

**Verification:** `npm run build` passes.

### Task 3.6: Integrate notification triggers into order lifecycle

**Objective:** Auto-send WA when order status changes

**Files:**
- Modify: `src/routes/(app)/[slug]/orders/+page.server.ts` (update_status action)
- Modify: `src/routes/(app)/[slug]/pos/+page.server.ts` (order creation)

**Step 1: After order creation in pos/+page.server.ts**

Add after the success return (~line 230):
```ts
// 8. Send WhatsApp notification (fire and forget)
if (customer?.nomor_hp) {
  sendNotification(tenantId, customer.nomor_hp, 'order_baru', {
    nama: customer.nama,
    nomor_order,
    layanan: items.map(i => layananMap.get(i.layanan_id)?.nama).filter(Boolean).join(', '),
    berat: String(berat_total),
    total: formatRupiah(total),
    estimasi: estimasi_selesai || '-',
    nama_toko: (locals.tenant as any)?.nama_toko || ''
  }).catch(err => console.error('WA notification failed:', err));
}
```

**Step 2: After status update in orders/+page.server.ts**

Find the `update_status` action. After status change:
```ts
// Send WA notification on key status transitions
const notifyStatuses: Record<string, string> = {
  'siap_diambil': 'siap_diambil',
  'siap_diantar': 'siap_diantar',
};

const templateKey = notifyStatuses[newStatus];
if (templateKey && order?.customer?.nomor_hp) {
  sendNotification(tenantId, order.customer.nomor_hp, templateKey, {
    nama: order.customer.nama,
    nomor_order: order.nomor_order,
    total: formatRupiah(order.total),
    nama_toko: (locals.tenant as any)?.nama_toko || '',
    alamat: order.customer.alamat || ''
  }).catch(err => console.error('WA notification failed:', err));
}
```

**Verification:** Create order → if WA configured, message sent. Change status to "siap diambil" → message sent.

---

## Integration Test

### Final Verification

```bash
cd /home/ain/laundryin
npm run build
# Expected: zero errors, zero new warnings

# If GoWA deployed: test full flow
# 1. Open POS → add kg service → type 2.5 → subtotal updates
# 2. Create order → invoice preview → download PDF
# 3. Check WA message received
# 4. Update status → WA notification sent
```

---

## DB Migration Summary

| New Table | Columns | Purpose |
|-----------|---------|---------|
| `tenant_configs` | `tenant_id`, `config_key`, `config_value` (JSONB) | Per-tenant GoWA config |
| `notifications_log` | `tenant_id`, `nomor_tujuan`, `template`, `pesan`, `status`, `error_detail`, `retry_count` | WA message audit trail |

---

## Files Changed

| File | Action | Tasks |
|------|--------|-------|
| `pos/+page.svelte` | Modify | 1.1, 2.3 |
| `pos/+page.server.ts` | Modify | 1.2, 2.3, 3.6 |
| `orders/+page.svelte` | Modify | 1.3, 2.4 |
| `orders/+page.server.ts` | Modify | 3.6 |
| `settings/+page.svelte` | Modify | 3.3 |
| `settings/+page.server.ts` | Modify | 3.3 |
| `lib/components/InvoiceTemplate.svelte` | Create | 2.1 |
| `lib/utils/invoice.ts` | Create | 2.2 |
| `lib/whatsapp/gowa-client.ts` | Create | 3.2 |
| `lib/whatsapp/dispatcher.ts` | Create | 3.5 |
| `supabase/migrations/20260613*.sql` | Create ×2 | 3.4 |

---

## Risks & Open Questions

1. **GoWA API shape**: Endpoints assumed from common go-whatsapp-web patterns. **MUST verify** by reading the actual GoWA source code before Task 3.2 code is final. Adjust `GoWAClient` request paths accordingly.

2. **tenant_configs table**: If Supabase is managed by migrations, these SQL files will be applied on next push. If not, need to apply manually via Supabase dashboard.

3. **QR scanning flow**: The current plan shows QR in settings — but GoWA QR login typically requires a WebSocket connection to receive the QR. The `getQR()` method may need polling if GoWA exposes it as an HTTP endpoint, or it might require a different approach (e.g., GoWA provides a dashboard URL the tenant visits separately).

4. **Notification on Vercel serverless**: `sendNotification` is called inline — if GoWA is slow (>10s), this will timeout. Consider moving to a background pattern: insert into `notification_queue` table, then a cron edge function processes the queue.

5. **API token security**: `tenant_configs.config_value` stores GoWA token in plaintext JSONB. Recommended: encrypt before storage. But for MVP, this is acceptable with Row-Level Security.
