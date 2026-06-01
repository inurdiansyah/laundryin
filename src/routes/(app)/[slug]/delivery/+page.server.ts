import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const slug = locals.tenant?.slug;
	if (slug) {
		const qs = 'tab=pengantaran';
		throw redirect(303, `/${slug}/orders?${qs}`);
	}
	throw redirect(303, '/auth/login');
};
