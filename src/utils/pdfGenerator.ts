import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SalesOrder, CompanyProfile } from '../types';

export function generateSalesOrderPDF(order: SalesOrder, company: CompanyProfile, shouldDownload = true): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const brandColor: [number, number, number] = [79, 70, 229]; // Indigo-600
  const currency = company.currency || '$';

  // --- 1. Top Decorative Bar ---
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, 210, 5, 'F');

  // --- 2. Document Title & Order Meta ---
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('SALES ORDER', 14, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Order Ref: ${order.orderNumber || 'SO-DRAFT'}`, 14, 28);
  doc.text(`Date: ${order.orderDate || new Date().toISOString().split('T')[0]}`, 14, 33);
  if (order.orderDueDate) {
    doc.text(`Due Date: ${order.orderDueDate}`, 14, 38);
  }

  // --- 3. Company Header (Right aligned) ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(company.name || 'Apex Industrial Solutions Inc.', 196, 22, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  const compDetails = [
    company.address,
    company.taxId ? `Tax ID / CNPJ: ${company.taxId}` : '',
    company.email,
    company.phone
  ].filter(Boolean);

  let compY = 27;
  compDetails.forEach((line) => {
    doc.text(line, 196, compY, { align: 'right' });
    compY += 4.2;
  });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 46, 196, 46);

  // --- 4. Customer / Bill To Box ---
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 50, 182, 26, 2, 2, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('CLIENTE / BILL TO:', 18, 56);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(order.customer.name || 'Cliente Não Informado', 18, 62);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const customerMeta = [
    order.customer.taxId ? `Doc/Tax ID: ${order.customer.taxId}` : '',
    order.customer.email ? `Email: ${order.customer.email}` : '',
    order.customer.phone ? `Tel: ${order.customer.phone}` : '',
  ].filter(Boolean).join('  |  ');

  if (customerMeta) {
    doc.text(customerMeta, 18, 67);
  }

  if (order.customer.address) {
    const addressLine = doc.splitTextToSize(`Endereço: ${order.customer.address}`, 174);
    doc.text(addressLine, 18, 72);
  }

  // --- 5. Line Items Table ---
  const tableRows = order.items.map((item, index) => [
    (index + 1).toString(),
    item.code || `SKU-${1000 + index}`,
    item.description || 'Produto / Serviço',
    item.quantity.toString(),
    `${currency} ${item.unitPrice.toFixed(2)}`,
    `${currency} ${item.total.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 82,
    head: [['#', 'Código / SKU', 'Descrição do Item', 'Qtd', 'Preço Unitário', 'Total']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: brandColor,
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
    order.notes || 'Agradecemos a sua preferência. Prazo de pagamento acordado previamente.',
    100
  );
  doc.text(noteLines, 14, finalY + 5);

  // Financial Summary on right
  const summaryX = 130;
  let summaryY = finalY;

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', summaryX, summaryY);
  doc.text(`${currency} ${order.subtotal.toFixed(2)}`, 196, summaryY, { align: 'right' });
  summaryY += 5.5;

  if (order.discountRate > 0) {
    doc.text(`Desconto (${order.discountRate}%):`, summaryX, summaryY);
    doc.text(`-${currency} ${order.discountAmount.toFixed(2)}`, 196, summaryY, { align: 'right' });
    summaryY += 5.5;
  }

  if (order.taxRate > 0) {
    doc.text(`Impostos / VAT (${order.taxRate}%):`, summaryX, summaryY);
    doc.text(`${currency} ${order.taxAmount.toFixed(2)}`, 196, summaryY, { align: 'right' });
    summaryY += 5.5;
  }

  // Grand Total Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(summaryX, summaryY, 196, summaryY);
  summaryY += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('TOTAL GERAL:', summaryX, summaryY);
  doc.setTextColor(79, 70, 229);
  doc.text(`${currency} ${order.grandTotal.toFixed(2)}`, 196, summaryY, { align: 'right' });

  // Signature Block
  const signY = summaryY + 24;
  if (signY < 270) {
    doc.setDrawColor(148, 163, 184);
    doc.line(14, signY, 75, signY);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura Autorizada / Carimbo & Data', 14, signY + 4);
  }

  // --- 7. Attached Image Pages (Optional proof of order/receipt prints) ---
  const imagesToAttach = order.attachedImages && order.attachedImages.length > 0
    ? order.attachedImages
    : (order.attachedImageUrl ? [order.attachedImageUrl] : []);

  imagesToAttach.forEach((imgData, idx) => {
    try {
      doc.addPage();
      doc.setFillColor(...brandColor);
      doc.rect(0, 0, 210, 5, 'F');

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`ANEXO: PRINT / COMPROVANTE ${imagesToAttach.length > 1 ? `#${idx + 1}` : 'DO PEDIDO'}`, 14, 18);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Referente ao Pedido: ${order.orderNumber || 'SO-DRAFT'}  |  Documento digitalizado`, 14, 24);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 28, 196, 28);

      // Embed image safely
      doc.addImage(imgData, 'PNG', 14, 32, 182, 240, undefined, 'FAST');
    } catch (err) {
      console.warn(`Não foi possível anexar imagem #${idx + 1} no PDF:`, err);
    }
  });

  if (shouldDownload) {
    const filename = `SalesOrder_${order.orderNumber || 'Draft'}.pdf`;
    doc.save(filename);
  }

  return doc;
}
