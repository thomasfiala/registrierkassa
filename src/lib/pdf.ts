import PDFDocument from 'pdfkit';
import fs from 'fs';
import QRCode from 'qrcode';
import { getConfig } from './config.ts';

export async function generateInvoicePdf(receiptData: any, outputPath: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const config = getConfig();
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // ... [Header and Line items logic remains same, shortening for brevity here, assuming it's standard PDFKit writing]
      doc.fontSize(20).text(config.business.name);
      doc.fontSize(10).text(`UID: ${config.business.uid}`);
      doc.moveDown(2);
      
      const headerText = receiptData.type === 'proforma' ? config.invoiceTexts.proformaHeader : config.invoiceTexts.header;
      doc.fontSize(16).text(headerText);
      doc.fontSize(10).text(`Belegnummer: ${receiptData.receiptNumber}`);
      doc.moveDown(2);
      
      let y = doc.y;
      receiptData.items.forEach((item: any) => {
        doc.text(`${item.name} (${item.taxRate})`, 50, y, { width: 250 });
        doc.text(`€ ${item.price.toFixed(2)}`, 300, y, { align: 'right' });
        y += 15;
      });
      doc.y = y + 20;
      doc.fontSize(14).text(`Gesamtbetrag: € ${receiptData.totalAmount.toFixed(2)}`, { align: 'right' });
      
      // Render RKSV QR Code if it's a final receipt
      if (receiptData.type === 'final' && receiptData.rksv?.jws) {
        doc.moveDown(2);
        doc.fontSize(10).text('Maschinenlesbarer Code (RKSV):', { align: 'center' });
        
        // Generate QR code buffer
        const qrBuffer = await QRCode.toBuffer(receiptData.rksv.jws, { errorCorrectionLevel: 'M', margin: 2 });
        
        // Center the QR code
        const qrSize = 120;
        doc.image(qrBuffer, (doc.page.width - qrSize) / 2, doc.y + 10, { width: qrSize });
      }

      doc.end();
      stream.on('finish', () => resolve(true));
      stream.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}
