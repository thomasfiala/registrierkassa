import { NextResponse } from 'next/server';
import { commitReceipt, getDbPath, readDb, deleteProforma, getPdfPath } from '@/lib/db';
import { generateInvoicePdf } from '@/lib/pdf';
import { getConfig } from '@/lib/config';
import { encryptTurnover, buildRksvPayload, signPayloadJWS, hashJws } from '@/lib/rksv';
import { getCurrentTimezonedDate } from '@/lib/date';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
  try {
    const db = await readDb();
    return NextResponse.json({ success: true, receipts: db.receipts || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = getConfig();
    const db = await readDb();
    
    // Check if preview
    if (body.isPreview) {
      const receiptNumber = `PREVIEW-${Date.now()}`;
      const totalAmount = body.items.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 1)), 0);
      const receiptData = {
        receiptNumber,
        date: getCurrentTimezonedDate(),
        items: body.items || [],
        totalAmount,
        type: body.type || 'final',
        customerNameAndAddress: body.customerNameAndAddress,
        customerEmail: body.customerEmail,
        customMessage: body.customMessage,
        paymentMethod: body.paymentMethod,
        isProformaPreview: true
      };
      
      const os = require('os');
      const tempDir = os.tmpdir();
      const pdfPath = path.join(tempDir, `${receiptNumber}.pdf`);
      
      await generateInvoicePdf(receiptData, pdfPath);
      
      const pdfBuffer = fs.readFileSync(pdfPath);
      // clean up
      fs.unlinkSync(pdfPath);

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
        },
      });
    }

    const receiptId = crypto.randomUUID();
    const isProforma = body.type === 'proforma';
    const isStorno = body.isStorno === true;
    
    const receiptNumber = isProforma 
        ? `PROF-${Date.now()}` 
        : (isStorno ? `STORNO-${Date.now()}` : `INV-${Date.now()}`);

    const totalAmount = body.items.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 1)), 0);
    
    let rksvPayload, jwsString, newHash;
    
    if (!isProforma) {
      const newTurnoverCents = Math.round((db.currentTurnover + totalAmount) * 100);
      const dateFmt = getCurrentTimezonedDate().substring(0, 19);
      const encryptedTurnover = encryptTurnover(newTurnoverCents, config.rksv.kassenID, receiptNumber, config.rksv.aesKey);
      let previousHash = db.lastReceiptHash;
      if (!previousHash) {
        const hash = crypto.createHash('sha256').update(config.rksv.kassenID, 'utf8').digest();
        previousHash = hash.subarray(0, 8).toString('base64');
      }
      
      rksvPayload = buildRksvPayload({ receiptNumber, date: getCurrentTimezonedDate(), items: body.items }, config, previousHash, encryptedTurnover);
      jwsString = await signPayloadJWS(rksvPayload, config);
      newHash = hashJws(jwsString);
    }

    const receiptData = {
      id: receiptId,
      receiptNumber,
      date: getCurrentTimezonedDate(),
      items: body.items || [],
      totalAmount,
      type: body.type || 'final',
      customerNameAndAddress: body.customerNameAndAddress,
      customerEmail: body.customerEmail,
      customMessage: body.customMessage,
      paymentMethod: body.paymentMethod,
      isStorno,
      stornoRef: body.stornoRef,
      fromProformaId: body.fromProformaId,
      rksv: isProforma ? undefined : {
        payload: rksvPayload,
        jws: jwsString,
        hash: newHash
      }
    };

    const pdfPath = await getPdfPath(receiptData);

    await generateInvoicePdf(receiptData, pdfPath);
    await commitReceipt(receiptData, pdfPath, newHash);

    return NextResponse.json({ success: true, receipt: receiptData });
  } catch (error: any) {
    console.error('Failed to create invoice:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw new Error("ID required");
    await deleteProforma(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
