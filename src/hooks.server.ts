import { getServerSupabase } from '$lib/supabase/server';
import { type Handle, redirect, error } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const supabase: Handle = async ({ event, resolve }) => {
	const supabase = getServerSupabase(event.fetch, event.cookies);
	event.locals.supabase = supabase;

	event.locals.getSession = async () => {
		const { data: { session } } = await supabase.auth.getSession();
		return session;
	};

	event.locals.getTenant = async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) return null;

		// Panggil RPC get_user_default_tenant
		const { data: tenant, error: rpcError } = await supabase
			.rpc('get_user_default_tenant', { p_user_id: session.user.id });

		if (rpcError || !tenant) return null;
		return tenant as {
			tenant_id: string;
			slug: string;
			nama_toko: string;
			nama_user: string;
			role: string;
			paket: string;
		};
	};

	return resolve(event);
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	const publicPaths = ['/', '/auth/login', '/auth/register', '/auth/callback', '/auth/logout', '/onboarding'];
	const isPublic = publicPaths.some((p) => pathname === p);
	const isAuth = pathname.startsWith('/auth/');
	const isApi = pathname.startsWith('/api/');

	if (isApi || isPublic) return resolve(event);

	const session = await event.locals.getSession();
	if (!session) {
		throw redirect(303, '/auth/login');
	}

	// Tenant guard: untuk route workspace tenant, cek apakah user punya akses
	const tenantMatch = pathname.match(/^\/([^\/]+)(?:\/|$)/);
	if (tenantMatch) {
		const slug = tenantMatch[1];
		const tenant = await event.locals.getTenant();

		// Kalau bukan tenant workspace (bukan auth, superadmin, dll), lewat
		if (['auth', 'api', 'superadmin', 'sverdle'].includes(slug)) return resolve(event);

		// Kalau user belum punya tenant, redirect ke onboarding
		if (!tenant) {
			throw redirect(303, '/auth/register');
		}

		// Simpan tenant info ke locals untuk dipakai di route
		event.locals.tenant = tenant;

		// Onboarding guard: jika onboarding belum selesai, redirect ke /onboarding
		const { data: tenantData } = await event.locals.supabase
			.from('tenants')
			.select('onboarding_completed')
			.eq('id', tenant.tenant_id)
			.single();

		const onboardingDone = tenantData?.onboarding_completed === true;
		// Jangan redirect kalau sudah di halaman onboarding atau logout
		if (!onboardingDone && pathname !== '/onboarding' && pathname !== '/auth/logout') {
			throw redirect(303, '/onboarding');
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard);
