/**
 * WhatsApp Notification Dispatcher
 * Fire-and-forget notification sender for order lifecycle events.
 *
 * GoWA credentials are set at ENVIRONMENT level (shared across all tenants).
 * Gate: ENABLE_GOWA — when false, returns immediately without any API/DB calls.
 */
import { getGoWAConfig, type GoWAConfig } from './gowa-config';
import { GoWAClient } from './gowa-client';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Shared GoWA client (lazy, env-level, one per process) ──
let _client: GoWAClient | null = null;
function getClient(): GoWAClient | null {
	const config = getGoWAConfig();
	if (!config.enabled) return null;
	if (!_client) {
		_client = new GoWAClient({
			base_url: config.base_url,
			username: config.username,
			password: config.password
		});
	}
	return _client;
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

	const client = getClient();
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
