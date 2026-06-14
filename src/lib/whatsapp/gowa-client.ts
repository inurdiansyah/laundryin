/**
 * GoWA REST API client
 * Lightweight wrapper around GoWA's HTTP endpoints.
 *
 * GoWA API:
 * - QR login:   GET  /app/login
 * - Pairing:    GET  /app/login-with-code?phone=628xxx
 * - Status:     GET  /app/status  → { results: { is_connected, is_logged_in, jid } }
 * - Send msg:   POST /send/message  body: { phone: "628xxx", message: "..." }
 * - Logout:     GET  /app/logout
 * - Auth:       Basic Auth (header Authorization: Basic <base64>)
 * - Scoping:    X-Device-Id header (auto-selected if only 1 device)
 */

export interface GoWAConfig {
	base_url: string;
	username: string;
	password: string;
	device_id?: string;
}

export interface GoWAStatus {
	is_connected: boolean;
	is_logged_in: boolean;
	jid: string;
}

export interface SendResult {
	success: boolean;
	error?: string;
	message_id?: string;
}

export class GoWAClient {
	private base_url: string;
	private auth_header: string;
	private device_id: string | undefined;

	constructor(config: GoWAConfig) {
		// Normalise trailing slash
		this.base_url = config.base_url.replace(/\/+$/, '');
		const encoded = btoa(`${config.username}:${config.password}`);
		this.auth_header = `Basic ${encoded}`;
		this.device_id = config.device_id;
	}

	private headers(includeContentType = false): Record<string, string> {
		const h: Record<string, string> = {
			Authorization: this.auth_header
		};
		if (includeContentType) h['Content-Type'] = 'application/json';
		if (this.device_id) h['X-Device-Id'] = this.device_id;
		return h;
	}

	/** Send a WhatsApp message to a phone number */
	async sendMessage(params: { nomor: string; pesan: string }): Promise<SendResult> {
		try {
			const res = await fetch(`${this.base_url}/send/message`, {
				method: 'POST',
				headers: this.headers(true),
				body: JSON.stringify({ phone: params.nomor, message: params.pesan })
			});
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				return { success: false, error: json?.error || `HTTP ${res.status}` };
			}
			return { success: true, message_id: json?.message_id || json?.id };
		} catch (err: any) {
			return { success: false, error: err?.message || 'Network error' };
		}
	}

	/** Get QR login image (returns base64 data URL) */
	async getQR(): Promise<{ success: boolean; qr?: string; error?: string }> {
		try {
			const res = await fetch(`${this.base_url}/app/login`, {
				headers: { Authorization: this.auth_header }
			});
			if (!res.ok) {
				const text = await res.text();
				return { success: false, error: text || `HTTP ${res.status}` };
			}
			const buffer = await res.arrayBuffer();
			const base64 = btoa(
				Array.from(new Uint8Array(buffer)).map((b) => String.fromCharCode(b)).join('')
			);
			const contentType = res.headers.get('content-type') || 'image/png';
			return { success: true, qr: `data:${contentType};base64,${base64}` };
		} catch (err: any) {
			return { success: false, error: err?.message || 'Network error' };
		}
	}

	/** Get GoWA connection status */
	async getStatus(): Promise<{ success: boolean; status?: GoWAStatus; error?: string }> {
		try {
			const res = await fetch(`${this.base_url}/app/status`, {
				headers: this.headers()
			});
			const json = await res.json();
			if (!res.ok) {
				return { success: false, error: json?.error || `HTTP ${res.status}` };
			}
			return { success: true, status: json?.results ?? json };
		} catch (err: any) {
			return { success: false, error: err?.message || 'Network error' };
		}
	}

	/** Logout from WhatsApp (disconnect device) */
	async logout(): Promise<{ success: boolean; error?: string }> {
		try {
			const res = await fetch(`${this.base_url}/app/logout`, {
				headers: this.headers()
			});
			if (!res.ok) {
				const text = await res.text();
				return { success: false, error: text || `HTTP ${res.status}` };
			}
			return { success: true };
		} catch (err: any) {
			return { success: false, error: err?.message || 'Network error' };
		}
	}
}
