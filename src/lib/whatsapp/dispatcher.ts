/**
 * WhatsApp Notification Dispatcher
 * Fire-and-forget notification sender for order lifecycle events.
 *
 * GoWA credentials (base URL, auth) are set at ENVIRONMENT level.
 * Each tenant gets their own device_id → own WhatsApp number.
 *
 * Gate: ENABLE_GOWA — when false, returns immediately without any API/DB calls.
 */
import { getGoWAConfig } from './gowa-config';
import { GoWAClient } from './gowa-client';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Per-tenant client cache ──
const _clients = new Map<string, GoWAClient>();

async function getTenantClient(
	supabase: SupabaseClient,
	tenantId: string
): Promise<GoWAClient | null> {
	const config = getGoWAConfig();
	if (!config.enabled) return null;

	// Check cache
	if (_clients.has(tenantId)) return _clients.get(tenantId)!;

	// Look up tenant's GoWA device_id
	const { data: tc } = await supabase
		.from('tenant_configs')
		.select('gowa_device_id')
		.eq('tenant_id', tenantId)
		.maybeSingle();

	const deviceId = tc?.gowa_device_id;
	if (!deviceId) return null; // tenant hasn't connected WA yet

	const client = new GoWAClient({
		base_url: config.base_url,
		username: config.username,
		password: config.password,
		device_id: deviceId
	});

	_clients.set(tenantId, client);
	return client;
}

// ── Templates ──
const TEMPLATES: Record<string, (p: Record<string, string>) => string> = {
	order_baru: (p) =>
		`👋 Halo ${p.nama}! Pesanan #${p.nomor_order} sudah kami terima.\nTotal: ${p.total}\nStatus: ${p.status}\n\nTerima kasih! 🙏`,

	siap_diambil: (p) =>
		`✅ Pesanan #${p.nomor_order} sudah SIAP DIAMBIL!\n🧺 Total: ${p.total}\n📍 Silakan ambil di toko kami.\n\nTerima kasih! 🙏`,

	dalam_pengiriman: (p) =>
		`🚚 Pesanan #${p.nomor_order} sedang dalam pengiriman!\nDriver kami sedang mengantarkan ke alamat Anda.\n\nTerima kasih! 🙏`,

	terkirim: (p) =>
		`📦 Pesanan #${p.nomor_order} telah TERKIRIM!\n🧺 Total: ${p.total}\n\nTerima kasih telah menggunakan jasa kami! 🙏⭐`
};

export { TEMPLATES };

export async function sendNotification(
	supabase: SupabaseClient,
	tenantId: string,
	nomorTujuan: string,
	template: string,
	params: Record<string, string>
): Promise<void> {
	// Gate: skip entirely when WhatsApp is disabled
	if (!getGoWAConfig().enabled) return;

	const templateFn = TEMPLATES[template];
	if (!templateFn) return;

	const client = await getTenantClient(supabase, tenantId);
	if (!client) return;

	const pesan = templateFn(params);
	const result = await client.sendMessage({ nomor: nomorTujuan, pesan });

	// Log to notifications_log
	await supabase.from('notifications_log').insert({
		tenant_id: tenantId,
		nomor_tujuan: nomorTujuan,
		template,
		pesan,
		status: result.success ? 'terkirim' : 'gagal',
		error_detail: result.error || null
	});
}
