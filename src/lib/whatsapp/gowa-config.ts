/**
 * GoWA Configuration — unified env reader
 *
 * Uses $env/dynamic/private so builds succeed even when vars aren't set.
 * Falls back to safe defaults (disabled) when any config is missing.
 */
import {
	env as privateEnv
} from '$env/dynamic/private';

export interface GoWAConfig {
	enabled: boolean;
	base_url: string;
	username: string;
	password: string;
	device_id?: string;
}

const EMPTY: GoWAConfig = {
	enabled: false,
	base_url: '',
	username: '',
	password: ''
};

let _cached: GoWAConfig | null = null;

export function getGoWAConfig(): GoWAConfig {
	if (_cached) return _cached;

	const enabled = privateEnv.ENABLE_GOWA === 'true';
	const base_url = (privateEnv.GOWA_BASE_URL || '').trim().replace(/\/+$/, '');
	const username = (privateEnv.GOWA_USERNAME || '').trim();
	const password = (privateEnv.GOWA_PASSWORD || '').trim();
	const device_id = (privateEnv.GOWA_DEVICE_ID || '').trim() || undefined;

	_cached = enabled && base_url && username && password
		? { enabled: true, base_url, username, password, device_id }
		: EMPTY;

	return _cached;
}
