import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SalesOrder, CompanyProfile } from '../types';
import { getCachedLogo, ARTEX7_LOGO_URL } from './logoLoader';

export function generateSalesOrderPDF(order: SalesOrder, company: CompanyProfile, shouldDownload = true): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const brandColor: [number, number, number] = [15, 23, 42]; // Slate-900 / Black professional
  const accentColor: [number, number, number] = [79, 70, 229]; // Indigo accent
  const currency = company.currency || 'R$';

  // --- 1. Top Decorative Bar ---
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, 210, 4, 'F');

  // --- 2. Logo Branding (Top Right) ---
  const logoData = company.logoUrl || getCachedLogo() || ARTEX7_LOGO_URL;
  let hasLogoDrawn = false;

  if (logoData) {
    try {
      // 46mm width x 15.3mm height (~3:1 ratio)
      doc.addImage(logoData, 'PNG', 196 - 48, 8, 48, 16, undefined, 'FAST');
      hasLogoDrawn = true;
    } catch (err) {
      console.warn('Erro ao inserir logo no PDF:', err);
    }
  }

  if (!hasLogoDrawn) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(company.name || 'ARTEX7', 196, 18, { align: 'right' });
  }

  // --- 3. Document Title & Order Meta (Top Left) ---
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PEDIDO DE VENDA', 14, 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Nº do Pedido: ${order.orderNumber || 'PED-DRAFT'}`, 14, 24);
  doc.text(`Data de Emissão: ${order.orderDate || new Date().toISOString().split('T')[0]}`, 14, 29);
  if (order.orderDueDate) {
    doc.text(`Data de Vencimento: ${order.orderDueDate}`, 14, 34);
  }

  // Company details under logo (Right aligned)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  const compDetails = [
    company.name && company.name !== 'ARTEX7' ? company.name : '',
    company.address,
    company.taxId ? `CNPJ / CPF: ${company.taxId}` : '',
    [company.email, company.phone].filter(Boolean).join(' | '),
  ].filter(Boolean);

  let compY = 26;
  compDetails.forEach((line) => {
    doc.text(line, 196, compY, { align: 'right' });
    compY += 3.8;
  });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 44, 196, 44);

  // --- 4. Customer / Bill To Box ---
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 48, 182, 25, 2, 2, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('DADOS DO CLIENTE / DESTINATÁRIO:', 18, 54);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(order.customer.name || 'Cliente Não Informado', 18, 60);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const customerMeta = [
    order.customer.taxId ? `CNPJ/CPF: ${order.customer.taxId}` : '',
    order.customer.email ? `E-mail: ${order.customer.email}` : '',
    order.customer.phone ? `Tel/WhatsApp: ${order.customer.phone}` : '',
  ].filter(Boolean).join('   |   ');

  if (customerMeta) {
    doc.text(customerMeta, 18, 65);
  }

  if (order.customer.address) {
    const addressLine = doc.splitTextToSize(`Endereço: ${order.customer.address}`, 174);
    doc.text(addressLine, 18, 70);
  }

  // --- 5. Line Items Table ---
  const tableRows = order.items.map((item, index) => [
    (index + 1).toString(),
    item.code || `SKU-${1000 + index}`,
    item.description || 'Produto',
    item.quantity.toString(),
    `${currency} ${item.unitPrice.toFixed(2)}`,
    `${currency} ${item.total.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 77,
    head: [['#', 'Código / SKU', 'Descrição do Produto', 'Qtd', 'Preço Unitário', 'Total']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42], // Slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // --- 6. Summary / Totals Section ---
  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 140;

  // Notes Box on left
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Termos & Observações:', 14, finalY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const noteLines = doc.splitTextToSize(
    order.notes || 'Agradecemos a sua preferência. Pedido gerado para conferência e faturamento.',
    100
  );
  doc.text(noteLines, 14, finalY + 5);

  // Financial Summary on right
  const summaryX = 132;
  let summaryY = finalY;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal dos Itens:', summaryX, summaryY);
  doc.text(`${currency} ${order.subtotal.toFixed(2)}`, 196, summaryY, { align: 'right' });
  summaryY += 5;

  if (order.discountRate > 0) {
    doc.text(`Desconto (${order.discountRate}%):`, summaryX, summaryY);
    doc.setTextColor(225, 29, 72);
    doc.text(`-${currency} ${order.discountAmount.toFixed(2)}`, 196, summaryY, { align: 'right' });
    doc.setTextColor(71, 85, 105);
    summaryY += 5;
  }

  if (order.taxRate > 0) {
    doc.text(`Impostos / Taxas (${order.taxRate}%):`, summaryX, summaryY);
    doc.text(`+${currency} ${order.taxAmount.toFixed(2)}`, 196, summaryY, { align: 'right' });
    summaryY += 5;
  }

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX, summaryY, 196, summaryY);
  summaryY += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL GERAL:', summaryX, summaryY);
  doc.setTextColor(79, 70, 229);
  doc.text(`${currency} ${order.grandTotal.toFixed(2)}`, 196, summaryY, { align: 'right' });

  // Signature Block
  const signY = summaryY + 22;
  if (signY < 270) {
    doc.setDrawColor(148, 163, 184);
    doc.line(14, signY, 75, signY);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura Autorizada / Carimbo & Data', 14, signY + 4);
  }

  // --- 7. Attached Image Pages (Prints do pedido) ---
  const imagesToAttach = order.attachedImages && order.attachedImages.length > 0
    ? order.attachedImages
    : (order.attachedImageUrl ? [order.attachedImageUrl] : []);

  imagesToAttach.forEach((imgData, idx) => {
    try {
      doc.addPage();
      doc.setFillColor(...brandColor);
      doc.rect(0, 0, 210, 4, 'F');

      // Top logo watermark / header on attachments
      if (logoData) {
        try {
          doc.addImage(logoData, 'PNG', 196 - 36, 8, 36, 12, undefined, 'FAST');
        } catch {
          // ignore
        }
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`ANEXO: PRINT DO PEDIDO ${imagesToAttach.length > 1 ? `#${idx + 1}` : ''}`, 14, 16);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Referente ao Pedido: ${order.orderNumber || 'PED-DRAFT'}  |  Comprovante de itens lidos`, 14, 22);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 26, 196, 26);

      // Embed image safely
      doc.addImage(imgData, 'PNG', 14, 30, 182, 245, undefined, 'FAST');
    } catch (err) {
      console.warn(`Não foi possível anexar imagem #${idx + 1} no PDF:`, err);
    }
  });

  if (shouldDownload) {
    const filename = `Pedido_${order.orderNumber || 'ARTEX7'}.pdf`;
    doc.save(filename);
  }

  return doc;
}
