/**
 * Format angka ke format Rupiah
 */
export function formatRupiah(nominal: number): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(nominal);
}

/**
 * Format tanggal ke format Indonesia
 */
export function formatTanggal(tanggal: string | Date): string {
	const date = typeof tanggal === 'string' ? new Date(tanggal) : tanggal;
	return new Intl.DateTimeFormat('id-ID', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(date);
}

/**
 * Generate slug dari string
 */
export function generateSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

/**
 * Generate nomor order unik per tenant
 * Format: [SLUG]-YYYYMMDD-XXX
 */
export function generateNomorOrder(slug: string, counter: number): string {
	const date = new Date();
	const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
	const seq = String(counter).padStart(3, '0');
	return `${slug.toUpperCase()}-${ymd}-${seq}`;
}

/**
 * Generate nomor member unik per tenant
 * Format: [SLUG]-MEM-XXXX
 */
export function generateNomorMember(slug: string, counter: number): string {
	const seq = String(counter).padStart(4, '0');
	return `${slug.toUpperCase()}-MEM-${seq}`;
}
