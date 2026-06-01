import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.getSession();
	const tenant = session ? await locals.getTenant() : null;

	return {
		session,
		tenant
	};
};
