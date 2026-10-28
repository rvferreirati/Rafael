/**
 * Generates sample invoice/order images as Blobs and DataURLs for instantaneous testing
 */

export interface SampleInvoicePreset {
  id: string;
  title: string;
  subtitle: string;
  orderNumber: string;
  customerName: string;
  items: Array<{ desc: string; qty: number; price: number }>;
}

export const SAMPLE_PRESETS: SampleInvoicePreset[] = [
  {
    id: 'cosmetics',
    title: 'Cosméticos & Esmalteria',
    subtitle: 'Top coat incolor, base bomba e removedor de acetona',
    orderNumber: 'PED-2026-5501',
    customerName: 'Studio Beleza & Unhas Ltda',
    items: [
      { desc: 'Top coat incolor', qty: 2, price: 15.00 },
      { desc: 'Base bomba', qty: 3, price: 18.50 },
      { desc: 'Removedor a base de acetona', qty: 1, price: 12.00 }
    ]
  },
  {
    id: 'hardware',
    title: 'Hardware & TI Solutions',
    subtitle: 'Fatura de TI com 4 produtos detalhados',
    orderNumber: 'SO-2026-8812',
    customerName: 'TechCorp Brasil Ltda',
    items: [
      { desc: 'Roteador Wi-Fi 6 Gigabit Pro', qty: 2, price: 450.00 },
      { desc: 'Cabo de Rede Cat6 30m Blindado', qty: 5, price: 65.50 },
      { desc: 'Switch Gerenciável 24 Portas PoE', qty: 1, price: 1280.00 },
      { desc: 'Patch Panel 24 Portas Modular', qty: 2, price: 190.00 }
    ]
  },
  {
    id: 'consulting',
    title: 'Consultoria & Serviços',
    subtitle: 'Orçamento de serviços e suporte técnico',
    orderNumber: 'PO-2026-4401',
    customerName: 'Global Logistics Solutions Inc',
    items: [
      { desc: 'Consultoria de Arquitetura em Nuvem (horas)', qty: 20, price: 175.00 },
      { desc: 'Migração de Banco de Dados Postgre', qty: 1, price: 1850.00 },
      { desc: 'Auditoria de Segurança e Conformidade', qty: 1, price: 920.00 }
    ]
  },
  {
    id: 'office',
    title: 'Materiais & Suprimentos',
    subtitle: 'Nota simples de compras corporativas',
    orderNumber: 'INV-2026-1099',
    customerName: 'Inovação e Comércio ME',
    items: [
      { desc: 'Cadeira Ergonômica Presidente Mesh', qty: 4, price: 680.00 },
      { desc: 'Monitor LED 27 polegadas 4K IPS', qty: 3, price: 1150.00 },
      { desc: 'Suporte Articulado a Gás para Monitores', qty: 3, price: 145.00 }
    ]
  }
];

export function createSampleInvoiceImage(preset: SampleInvoicePreset): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header border top
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(0, 0, canvas.width, 16);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('SALES ORDER / FATURA COMERCIAL', 80, 100);

    // Order number and date
    ctx.font = '600 26px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`ORDER: ${preset.orderNumber}`, 80, 160);
    ctx.fillText(`DATE: 2026-10-28`, 80, 200);

    // Vendor info right side
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('APEX INDUSTRIAL SUPPLIES', 720, 100);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('CNPJ / TAX ID: 12.345.678/0001-90', 720, 135);
    ctx.fillText('contato@apexsupplies.com', 720, 165);
    ctx.fillText('Av. Paulista, 1000 - São Paulo, SP', 720, 195);

    // Line divider
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 240);
    ctx.lineTo(1120, 240);
    ctx.stroke();

    // Customer section
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('CLIENTE / BILL TO:', 80, 280);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(preset.customerName, 80, 320);

    ctx.fillStyle = '#475569';
    ctx.font = '20px sans-serif';
    ctx.fillText('Tax ID / Doc: BR-998822-10', 80, 355);
    ctx.fillText('compras@cliente.com.br', 80, 385);
    ctx.fillText('Rua das Américas, 450 - Centro Empresarial', 80, 415);

    // Items Table Header
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(80, 460, 1040, 50);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SKU', 100, 492);
    ctx.fillText('DESCRICAO DO ITEM', 280, 492);
    ctx.fillText('QTD', 760, 492);
    ctx.fillText('VALOR UNIT', 870, 492);
    ctx.fillText('TOTAL', 1020, 492);

    // Items rows
    let currentY = 550;
    let grandSubtotal = 0;

    preset.items.forEach((item, index) => {
      const lineTotal = item.qty * item.price;
      grandSubtotal += lineTotal;

      // zebra background
      if (index % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(80, currentY - 32, 1040, 48);
      }

      ctx.fillStyle = '#334155';
      ctx.font = '600 19px monospace';
      ctx.fillText(`SKU-${1000 + index * 12}`, 100, currentY);

      ctx.font = '19px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(item.desc, 280, currentY);

      ctx.font = '600 20px sans-serif';
      ctx.fillText(item.qty.toString(), 780, currentY);
      ctx.fillText(`$${item.price.toFixed(2)}`, 880, currentY);
      ctx.fillText(`$${lineTotal.toFixed(2)}`, 1020, currentY);

      currentY += 56;
    });

    // Divider before totals
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, currentY + 20);
    ctx.lineTo(1120, currentY + 20);
    ctx.stroke();

    // Summary Box
    const boxY = currentY + 60;
    const tax = grandSubtotal * 0.08;
    const grandTotal = grandSubtotal + tax;

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Subtotal:', 800, boxY);
    ctx.fillText(`$${grandSubtotal.toFixed(2)}`, 1020, boxY);

    ctx.fillText('Impostos (8%):', 800, boxY + 40);
    ctx.fillText(`$${tax.toFixed(2)}`, 1020, boxY + 40);

    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('VALOR TOTAL:', 760, boxY + 95);
    ctx.fillText(`$${grandTotal.toFixed(2)}`, 1000, boxY + 95);

    // Notes
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 18px sans-serif';
    ctx.fillText('Observações: Pagamento em até 30 dias após emissão.', 80, boxY + 60);
    ctx.fillText('Documento gerado para conferência e importação via SalesOrder Pro OCR.', 80, boxY + 95);

    // Signature line
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(80, boxY + 220);
    ctx.lineTo(400, boxY + 220);
    ctx.stroke();
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Assinatura do Responsável / Data', 80, boxY + 245);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const dataUrl = canvas.toDataURL('image/png');
      resolve({ blob, dataUrl });
    }, 'image/png');
  });
}
