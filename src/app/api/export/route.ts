import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await readDb();
    
    // Create CSV content
    const headers = ["ID", "ReceiptNumber", "Date", "Type", "TotalAmount", "Customer", "StornoRef", "IsStorno", "Stornoed"].join(",");
    const rows = db.receipts.map((r: any) => {
        return [
            r.id,
            r.receiptNumber,
            r.date,
            r.type,
            r.totalAmount,
            `"${r.customerNameAndAddress ? r.customerNameAndAddress.replace(/"/g, '""').replace(/\n/g, ' ') : ''}"`,
            r.stornoRef || "",
            r.isStorno ? "Yes" : "No",
            r.stornoed ? "Yes" : "No"
        ].join(",");
    });
    
    const csvContent = [headers, ...rows].join("\n");
    
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="export.csv"'
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
