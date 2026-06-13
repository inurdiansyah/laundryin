/**
 * WhatsApp Notification Dispatcher
 * Fire-and-forget notification sender for order lifecycle events.
 *
 * The entire module is gated by ENABLE_GOWA — when false, sendNotification
 * returns immediately without making any API calls or DB queries.
 */
import { ENABLE_GOWA } from '$env/static/private';
import { GoWAClient } from './gowa-client';
import type { SupabaseClient } from '@supabase/supabase-js';

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
	if (!ENABLE_GOWA) return;

	const templateFn = TEMPLATES[template];
	if (!templateFn) return;

	// Load GoWA config from tenant_configs
	const { data: configRow } = await supabase
		.from('tenant_configs')
		.select('config_value')
		.eq('tenant_id', tenantId)
		.eq('config_key', 'gowa')
		.single();

	if (!configRow?.config_value) return;

	const config = configRow.config_value as any;
	if (!config.base_url || !config.username || !config.password) return;

	const client = new GoWAClient({
		base_url: config.base_url,
		username: config.username,
		password: config.password
	});

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
