import { NextResponse } from 'next/server';
import { getDbPath, readDb, getPdfPath } from '@/lib/db';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');
    if (!filename) throw new Error("File required");
    
    const receiptNumber = filename.replace('.pdf', '');
    const db = await readDb();
    const receipt = db.receipts.find((r: any) => r.receiptNumber === receiptNumber);
    
    let pdfPath;
    if (receipt) {
        pdfPath = await getPdfPath(receipt);
    } else {
        const dbRepo = await getDbPath();
        pdfPath = path.join(dbRepo, filename); // fallback for old ones
    }
    
    if (!fs.existsSync(pdfPath)) {
        return new NextResponse("Not found", { status: 404 });
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
