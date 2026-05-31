import PDFDocument from 'pdfkit';
import fs from 'fs';
import QRCode from 'qrcode';
import { getConfig } from './config';
import { getQrCodeRepresentation } from './rksv';

export async function generateInvoicePdf(receiptData: any, outputPath: string) {
  return new Promise(async (resolve, reject) => {
    try {
      const config = getConfig();
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - 100;

      doc.fontSize(20).text(config.business.name, { align: 'right' });
      doc.fontSize(10).text(`UID: ${config.business.uid}`, { align: 'right' });
      doc.text(config.business.address, { align: 'right' });
      doc.moveDown(2);
      
      if (receiptData.customerNameAndAddress) {
        doc.fontSize(10).text(receiptData.customerNameAndAddress);
        doc.moveDown(2);
      }

      let headerText = receiptData.type === 'proforma' ? config.invoiceTexts.proformaHeader : config.invoiceTexts.header;
      if (receiptData.isSystemBeleg) {
         headerText = receiptData.systemType;
      }

      doc.fontSize(16).text(headerText);
      const belegY = doc.y;
      doc.fontSize(10).text(`Belegnummer: ${receiptData.receiptNumber}`, 50, belegY);
      doc.text(`Datum: ${new Date(receiptData.date).toLocaleString('de-AT', { timeZone: config.timezone || 'Europe/Vienna' })}`, 50, belegY, { align: 'right', width: contentWidth });
      doc.y = belegY + 15;
      
      if (receiptData.isStorno) {
        doc.text(`Storno zu Beleg: ${receiptData.stornoRef}`, 50, doc.y);
        doc.y += 15;
      }
      doc.moveDown(1);
      
      let y = doc.y;
      // Header row
      doc.fontSize(10).text("Menge", 50, y, { width: 40 });
      doc.text("Bezeichnung", 100, y, { width: 200 });
      doc.text("USt.", 300, y, { width: 40 });
      doc.text("Preis", 340, y, { width: 90, align: 'right' });
      doc.text("Gesamt", 430, y, { width: 115, align: 'right' });
      y += 15;
      doc.moveTo(50, y).lineTo(545, y).stroke();
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
        doc.text(`${item.name}`, 100, y, { width: 200 });
        doc.text(rateStr, 300, y, { width: 40 });
        doc.text(`€ ${item.price.toFixed(2).replace('.', ',')}`, 340, y, { width: 90, align: 'right' });
        doc.text(`€ ${total.toFixed(2).replace('.', ',')}`, 430, y, { width: 115, align: 'right' });
        y += 15;
      });
      doc.y = y + 20;
      doc.moveTo(340, doc.y).lineTo(545, doc.y).stroke();
      doc.y += 10;
      
      const summaryY = doc.y;

      let sepaHeight = 0;
      if (config.sepa && config.sepa.iban && receiptData.paymentMethod === 'Überweisung') {
        const sepaString = `BCD\n002\n1\nSCT\n${config.sepa.bic || ''}\n${config.sepa.recipientName}\n${config.sepa.iban}\nEUR${receiptData.totalAmount.toFixed(2)}\n\n\n${receiptData.receiptNumber}`;
        const sepaBuffer = await QRCode.toBuffer(sepaString, { errorCorrectionLevel: 'M', margin: 1 });
        doc.fontSize(8).text('QR-Code für SEPA Überweisung', 50, summaryY);
        doc.image(sepaBuffer, 50, summaryY + 12, { width: 80 });
        sepaHeight = 100; // text + image
      }

      doc.fontSize(14).text(`Gesamtbetrag: € ${receiptData.totalAmount.toFixed(2).replace('.', ',')}`, 50, summaryY, { align: 'right', width: contentWidth });
      let currentRightY = summaryY + 18;
      
      doc.fontSize(10);
      Object.keys(taxes).forEach(rate => {
          if (taxes[rate] > 0) {
              doc.text(`darin enthalten ${rate} USt: € ${taxes[rate].toFixed(2).replace('.', ',')}`, 50, currentRightY, { align: 'right', width: contentWidth });
              currentRightY += 15;
          }
      });
      
      doc.y = Math.max(summaryY + sepaHeight, currentRightY);
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
          doc.text(config.invoiceTexts.footer, 50, doc.y, { align: 'left', width: contentWidth });
          doc.moveDown(1);
      }

      if (receiptData.type === 'final' && receiptData.rksv?.jws && !receiptData.isProformaPreview) {
        doc.moveDown(1);
        doc.text('Maschinenlesbarer Code (RKSV):', 50, doc.y, { align: 'center', width: contentWidth });
        const qrContent = getQrCodeRepresentation(receiptData.rksv.jws);
        const qrBuffer = await QRCode.toBuffer(qrContent, { errorCorrectionLevel: 'M', margin: 2 });
        const qrSize = 120;
        doc.image(qrBuffer, (pageWidth - qrSize) / 2, doc.y + 10, { width: qrSize });
      }

      if (config.invoiceTexts.bottomFooter) {
          doc.fontSize(9).text(config.invoiceTexts.bottomFooter, 50, pageHeight - 70, { align: 'center', width: contentWidth });
      }

      doc.end();
      stream.on('finish', () => resolve(true));
      stream.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}
