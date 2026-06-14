# Invoice PDF Fix + Customer Tracking Dashboard

> **For Hermes:** Implement task-by-task in order.

**Goal:** Invoice PDF native jsPDF (no screenshot), customer public tracking page, WhatsApp sends tracking link.

**Tech Stack:** SvelteKit 5, jsPDF, Supabase, GoWA WhatsApp

---

## 1. Invoice PDF — Native jsPDF (DONE ✅)
- `src/lib/utils/invoice.ts` rewritten: native jsPDF text drawing, 80mm thermal format, vector-based (no html2canvas)
- Signature changed: `generateInvoicePDF(data: InvoiceData, nomorOrder)` instead of `(elementId, nomorOrder)`

## 2. Update Invoice Callers

### Task 1: Update POS invoice download
**File:** `src/routes/(app)/[slug]/pos/+page.svelte`
**Change:** `printInvoice()` build `InvoiceData` object + call `generateInvoicePDF(data, nomorOrder)`
- Get data from `receiptSnapshot` instead of screenshotting DOM
- Remove `captureReceipt()` DOM mutation

### Task 2: Update Orders invoice download
**File:** `src/routes/(app)/[slug]/orders/+page.svelte`
**Change:** Same as POS — build `InvoiceData` from `invoiceOrderData`, call `generateInvoicePDF(data, nomorOrder)`

## 3. Customer Tracking Dashboard

### Task 3: Create public customer tracking page
**File:** `src/routes/track/[customerId]/+page.server.ts` + `+page.svelte`
- Public route (no auth required)
- Shows all orders for that customer
- Filter by paid/unpaid status
- Simple mobile-friendly UI

### Task 4: Update POS to show tracking link after order
**File:** `src/routes/(app)/[slug]/pos/+page.svelte`
- After successful order, show tracking link in WhatsApp text + on screen
- Link format: `laundriin.web.id/track/<customer_id>`

### Task 5: Update WhatsApp dispatcher to include tracking link
**File:** `src/lib/whatsapp/dispatcher.ts`
- Append tracking link to WhatsApp message
- Read customer_id from order data

## 4. Deploy
- Build, commit, push, Vercel deploy
