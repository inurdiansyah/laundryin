import { jsPDF } from 'jspdf';

export async function generateInvoicePDF(elementId: string, nomorOrder: string): Promise<void> {
	const element = document.getElementById(elementId);
	if (!element) throw new Error('Invoice element not found');

	const { default: html2canvas } = await import('html2canvas');
	const canvas = await html2canvas(element, {
		scale: 2,
		useCORS: true,
		logging: false,
		backgroundColor: '#ffffff'
	});

	const imgData = canvas.toDataURL('image/png');
	const imgWidth = 80; // 80mm for thermal receipt
	const imgHeight = (canvas.height * imgWidth) / canvas.width;

	const pdf = new jsPDF({
		orientation: 'portrait',
		unit: 'mm',
		format: [imgWidth, imgHeight]
	});

	pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
	pdf.save(`Invoice-${nomorOrder}.pdf`);
}
