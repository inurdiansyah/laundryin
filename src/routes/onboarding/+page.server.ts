import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.getSession();
	if (!session) throw redirect(303, '/auth/login');

	const tenant = await locals.getTenant();
	if (!tenant) throw redirect(303, '/auth/register');

	// Cek onboarding status dari locals.tenant (sudah terset oleh authGuard)
	const { data: tenantData } = await locals.supabase
		.from('tenants')
		.select('onboarding_completed, nama_toko, slug')
		.eq('id', tenant.tenant_id)
		.single();

	if (tenantData?.onboarding_completed === true) {
		throw redirect(303, `/${tenant.slug}`);
	}

	return {
		tenant: {
			id: tenant.tenant_id,
			nama_toko: tenant.nama_toko,
			slug: tenant.slug
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const session = await locals.getSession();
		if (!session) throw redirect(303, '/auth/login');

		const tenant = await locals.getTenant();
		if (!tenant) throw redirect(303, '/auth/register');

		const formData = await request.formData();
		const alamat = (formData.get('alamat') as string)?.trim();

		if (!alamat) {
			return fail(400, { errors: { alamat: 'Alamat toko wajib diisi' } });
		}

		// Update tenant — set onboarding_completed
		const { error } = await locals.supabase
			.from('tenants')
			.update({
				alamat: alamat,
				onboarding_completed: true
			})
			.eq('id', tenant.tenant_id);

		if (error) {
			return fail(500, { errors: { general: error.message } });
		}

		throw redirect(303, `/${tenant.slug}`);
	}
};
