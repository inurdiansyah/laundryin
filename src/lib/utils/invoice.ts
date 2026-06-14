import { jsPDF } from 'jspdf';
import { formatRupiah, formatTanggal } from './format';

interface InvoiceTenant {
	nama: string;
	alamat?: string;
	phone?: string;
}

interface InvoiceCustomer {
	nama: string;
	phone?: string;
	alamat?: string;
}

interface InvoiceItem {
	nama: string;
	qty: number;
	satuan: string;
	harga: number;
	subtotal: number;
}

interface InvoiceOrder {
	nomor_order: string;
	tanggal: string;
	subtotal: number;
	diskon: number;
	total: number;
	status_bayar: string;
	metode_bayar: string;
}

interface InvoiceData {
	tenant: InvoiceTenant;
	order: InvoiceOrder;
	customer: InvoiceCustomer;
	items: InvoiceItem[];
}

// Thermal receipt: 80mm wide
const PAGE_W = 80;
const MARGIN = 4;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP_PAD = 8; // 8mm pad atas — header bold fontSize=10 nggak kepotong

export async function generateInvoicePDF(data: InvoiceData, nomorOrder: string): Promise<void> {
	const pdf = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: [PAGE_W, 200] // height auto-adjusted
	});

	const { tenant, order, customer, items } = data;

	pdf.setFont('helvetica', 'normal');
	let y = MARGIN + TOP_PAD;

	// ── Header ──
	pdf.setFontSize(10);
	pdf.setFont('helvetica', 'bold');
	pdf.text(tenant.nama, PAGE_W / 2, y, { align: 'center' });
	y += 5;
	if (tenant.alamat) {
		pdf.setFontSize(7);
		pdf.setFont('helvetica', 'normal');
		pdf.text(tenant.alamat, PAGE_W / 2, y, { align: 'center' });
		y += 3.5;
	}
	if (tenant.phone) {
		pdf.setFontSize(7);
		pdf.text(`Telp: ${tenant.phone}`, PAGE_W / 2, y, { align: 'center' });
		y += 3.5;
	}

	// ── Divider ──
	y += 1;
	pdf.setDrawColor(180);
	pdf.setLineDashPattern([1, 1], 0);
	pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
	pdf.setLineDashPattern([], 0);
	y += 4;

	// ── Order Info ──
	pdf.setFontSize(7);
	const infoX1 = MARGIN;
	const infoX2 = PAGE_W - MARGIN;
	const lineH = 3.5;

	function infoRow(label: string, value: string) {
		pdf.setFont('helvetica', 'normal');
		pdf.setTextColor(100);
		pdf.text(label, infoX1, y);
		pdf.setTextColor(0);
		pdf.setFont('helvetica', 'bold');
		pdf.text(value, infoX2, y, { align: 'right' });
		y += lineH;
	}

	infoRow('No. Order', order.nomor_order);
	infoRow('Tanggal', formatTanggal(order.tanggal));
	pdf.setFont('helvetica', 'normal');
	pdf.setTextColor(100);
	pdf.text('Pelanggan', infoX1, y);
	pdf.setTextColor(0);
	pdf.setFont('helvetica', 'bold');
	pdf.text(customer.nama, infoX2, y, { align: 'right' });
	y += lineH;
	if (customer.phone) {
		infoRow('HP', customer.phone);
	}
	if (customer.alamat) {
		pdf.setFontSize(7);
		pdf.setFont('helvetica', 'normal');
		pdf.setTextColor(100);
		pdf.text('Alamat:', infoX1, y);
		pdf.setTextColor(0);
		const addrLines = pdf.splitTextToSize(customer.alamat, CONTENT_W - 12);
		pdf.text(addrLines, infoX1 + 10, y);
		y += (addrLines.length + 0.2) * lineH;
	}

	// ── Divider ──
	y += 1;
	pdf.setDrawColor(180);
	pdf.setLineDashPattern([1, 1], 0);
	pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
	pdf.setLineDashPattern([], 0);
	y += 4;

	// ── Items Table ──
	pdf.setFontSize(7);
	pdf.setFont('helvetica', 'bold');
	pdf.setTextColor(120);
	pdf.text('Layanan', MARGIN, y);
	pdf.text('Qty', PAGE_W - MARGIN - 22, y, { align: 'right' });
	pdf.text('Subtotal', PAGE_W - MARGIN, y, { align: 'right' });
	y += lineH + 1;
	pdf.setDrawColor(200);
	pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
	y += 3;

	pdf.setFont('helvetica', 'normal');
	pdf.setTextColor(0);
	for (const item of items) {
		pdf.text(item.nama, MARGIN, y, { maxWidth: CONTENT_W - 38 });
		pdf.text(`${item.qty} ${item.satuan}`, PAGE_W - MARGIN - 22, y, { align: 'right' });
		pdf.text(formatRupiah(item.subtotal), PAGE_W - MARGIN, y, { align: 'right' });
		y += lineH + 0.5;
	}

	// ── Divider ──
	y += 1;
	pdf.setDrawColor(180);
	pdf.setLineDashPattern([1, 1], 0);
	pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
	pdf.setLineDashPattern([], 0);
	y += 4;

	// ── Totals ──
	pdf.setFontSize(7);
	totalRow('Subtotal', formatRupiah(order.subtotal), false);
	if (order.diskon > 0) {
		totalRow('Diskon', `-${formatRupiah(order.diskon)}`, false);
	}
	y += 0.5;
	pdf.setDrawColor(200);
	pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
	y += 3;
	totalRow('TOTAL', formatRupiah(order.total), true);

	function totalRow(label: string, value: string, bold: boolean) {
		pdf.setFontSize(bold ? 9 : 7);
		pdf.setFont('helvetica', bold ? 'bold' : 'normal');
		pdf.setTextColor(bold ? 0 : 100);
		pdf.text(label, MARGIN, y);
		pdf.text(value, PAGE_W - MARGIN, y, { align: 'right' });
		y += bold ? 5 : 3.5;
	}

	// ── Divider ──
	y += 1;
	pdf.setDrawColor(180);
	pdf.setLineDashPattern([1, 1], 0);
	pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
	pdf.setLineDashPattern([], 0);
	y += 4;

	// ── Payment Info ──
	pdf.setFontSize(7);
	infoRow('Metode Bayar', order.metode_bayar.charAt(0).toUpperCase() + order.metode_bayar.slice(1));
	infoRow('Status Bayar', order.status_bayar.replace('_', ' '));

	// ── Footer ──
	y += 2;
	pdf.setDrawColor(180);
	pdf.setLineDashPattern([1, 1], 0);
	pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
	pdf.setLineDashPattern([], 0);
	y += 4;
	pdf.setFontSize(7);
	pdf.setFont('helvetica', 'normal');
	pdf.setTextColor(150);
	pdf.text('Terima kasih telah menggunakan jasa kami', PAGE_W / 2, y, { align: 'center' });
	y += 3.5;
	pdf.setTextColor(130);
	pdf.text('Powered by LaundryIn', PAGE_W / 2, y, { align: 'center' });

	// Trim to actual height + margin
	const totalH = y + 6;
	pdf.internal.pageSize.height = totalH;

	pdf.save(`Invoice-${nomorOrder}.pdf`);
}
