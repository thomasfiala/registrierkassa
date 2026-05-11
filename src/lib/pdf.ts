import PDFDocument from 'pdfkit';
import fs from 'fs';
import QRCode from 'qrcode';
import { getConfig } from './config';

export async function generateInvoicePdf(receiptData: any, outputPath: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const config = getConfig();
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      doc.fontSize(20).text(config.business.name, { align: 'right' });
      doc.fontSize(10).text(`UID: ${config.business.uid}`, { align: 'right' });
      doc.text(config.business.address, { align: 'right' });
      doc.moveDown(2);
      
      if (receiptData.customerNameAndAddress) {
        doc.fontSize(10).text(receiptData.customerNameAndAddress);
        doc.moveDown(1);
      }

      let headerText = receiptData.type === 'proforma' ? config.invoiceTexts.proformaHeader : config.invoiceTexts.header;
      if (receiptData.isSystemBeleg) {
         headerText = receiptData.systemType;
      }

      doc.fontSize(16).text(headerText);
      const belegY = doc.y;
      doc.fontSize(10).text(`Belegnummer: ${receiptData.receiptNumber}`, 50, belegY);
      doc.text(`Datum: ${new Date(receiptData.date).toLocaleString('de-AT')}`, 50, belegY, { align: 'right', width: 430 });
      doc.y = belegY + 15;
      
      if (receiptData.isStorno) {
        doc.text(`Storno zu Beleg: ${receiptData.stornoRef}`, 50, doc.y);
        doc.y += 15;
      }
      doc.moveDown(1);
      
      let y = doc.y;
      // Header row
      doc.fontSize(10).text("Menge", 50, y, { width: 40 });
      doc.text("Bezeichnung", 100, y, { width: 170 });
      doc.text("MWSt.", 270, y, { width: 50 });
      doc.text("Preis", 320, y, { width: 80, align: 'right' });
      doc.text("Gesamt", 400, y, { width: 80, align: 'right' });
      y += 15;
      doc.moveTo(50, y).lineTo(480, y).stroke();
      y += 10;

      const taxes: Record<string, number> = {};
      receiptData.items.forEach((item: any) => {
        const qty = item.quantity || 1;
        const total = item.price * qty;
        
        const rateStr = item.taxRate || '0%';
        if (!taxes[rateStr]) taxes[rateStr] = 0;
        const rateNum = parseFloat(rateStr.replace('%', ''));
        if (!isNaN(rateNum) && rateNum > 0) {
            const net = total / (1 + rateNum / 100);
            taxes[rateStr] += (total - net);
        }

        doc.text(`${qty}`, 50, y, { width: 40 });
        doc.text(`${item.name}`, 100, y, { width: 170 });
        doc.text(rateStr, 270, y, { width: 50 });
        doc.text(`€ ${item.price.toFixed(2)}`, 320, y, { width: 80, align: 'right' });
        doc.text(`€ ${total.toFixed(2)}`, 400, y, { width: 80, align: 'right' });
        y += 15;
      });
      doc.y = y + 20;
      doc.moveTo(250, doc.y).lineTo(480, doc.y).stroke();
      doc.y += 10;
      
      doc.fontSize(14).text(`Gesamtbetrag: € ${receiptData.totalAmount.toFixed(2)}`, 50, doc.y, { align: 'right', width: 430 });
      doc.y += 15;
      
      doc.fontSize(10);
      Object.keys(taxes).forEach(rate => {
          if (taxes[rate] > 0) {
              doc.text(`darin enthalten ${rate} USt: € ${taxes[rate].toFixed(2)}`, 50, doc.y, { align: 'right', width: 430 });
              doc.y += 15;
          }
      });
      doc.moveDown(1);
      
      if (receiptData.paymentMethod) {
          doc.text(`Zahlungsmittel: ${receiptData.paymentMethod}`, 50, doc.y, { align: 'left' });
          doc.moveDown(1);
      }

      if (receiptData.customMessage) {
        doc.text(receiptData.customMessage, 50, doc.y, { align: 'left' });
        doc.moveDown(1);
      }

      doc.moveDown(1);
      if (config.invoiceTexts.footer) {
          doc.text(config.invoiceTexts.footer, 50, doc.y, { align: 'center', width: 430 });
          doc.moveDown(1);
      }
      if (config.invoiceTexts.bottomFooter) {
          doc.text(config.invoiceTexts.bottomFooter, 50, doc.y, { align: 'center', width: 430 });
          doc.moveDown(1);
      }

      if (receiptData.type === 'final' && receiptData.rksv?.jws && !receiptData.isProformaPreview) {
        doc.moveDown(1);
        doc.text('Maschinenlesbarer Code (RKSV):', 50, doc.y, { align: 'center', width: 430 });
        const qrBuffer = await QRCode.toBuffer(receiptData.rksv.jws, { errorCorrectionLevel: 'M', margin: 2 });
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
