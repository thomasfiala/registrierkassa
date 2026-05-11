import { NextResponse } from 'next/server';
import { commitReceipt, getDbPath, readDb } from '@/lib/db.ts';
import { generateInvoicePdf } from '@/lib/pdf.ts';
import { getConfig } from '@/lib/config.ts';
import { encryptTurnover, buildRksvPayload, signPayloadJWS, hashJws } from '@/lib/rksv.ts';
import crypto from 'crypto';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = getConfig();
    const db = await readDb();
    
    const receiptId = crypto.randomUUID();
    const receiptNumber = `INV-${Date.now()}`;
    const totalAmount = body.items.reduce((sum: number, item: any) => sum + item.price, 0);
    
    // RKSV Crypto Flow
    const newTurnoverCents = Math.round((db.currentTurnover + totalAmount) * 100);
    const encryptedTurnover = encryptTurnover(newTurnoverCents, config.rksv.kassenID, receiptNumber, config.rksv.aesKey);
    const previousHash = db.lastReceiptHash || "ICAgICAgICAgICg="; // "        " base64 encoded for initial start
    
    const rksvPayload = buildRksvPayload({ receiptNumber, date: new Date().toISOString(), items: body.items }, config, previousHash, encryptedTurnover);
    const jwsString = signPayloadJWS(rksvPayload);
    const newHash = hashJws(jwsString);

    const receiptData = {
      id: receiptId,
      receiptNumber,
      date: new Date().toISOString(),
      items: body.items || [],
      totalAmount: totalAmount,
      type: body.type || 'final',
      rksv: {
        payload: rksvPayload,
        jws: jwsString,
        hash: newHash
      }
    };

    const dbRepoPath = await getDbPath();
    const pdfFilename = `${receiptNumber}.pdf`;
    const pdfPath = path.join(dbRepoPath, pdfFilename);

    await generateInvoicePdf(receiptData, pdfPath);
    // Passing newHash to commit logic to update the running state
    await commitReceipt(receiptData, pdfPath, newHash);

    return NextResponse.json({ success: true, receipt: receiptData });
  } catch (error: any) {
    console.error('Failed to create invoice:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
