import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/supabase';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			getSession(): Promise<Session | null>;
			getTenant(): Promise<{
				tenant_id: string;
				slug: string;
				nama_toko: string;
				nama_user: string;
				role: string;
				paket: string;
			} | null>;
			tenant?: {
				tenant_id: string;
				slug: string;
				nama_toko: string;
				nama_user: string;
				role: string;
				paket: string;
			};
		}
		interface PageData {
			session: Session | null;
			tenant: App.Locals['tenant'] | null;
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
