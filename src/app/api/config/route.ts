import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = getConfig();
    return NextResponse.json({
      itemTemplates: config.itemTemplates || [],
      business: config.business,
      invoiceTexts: config.invoiceTexts || {},
      emailTexts: config.emailTexts || {},
      paymentMethods: config.paymentMethods || [
        { name: 'bar' },
        { name: 'SumUp' },
        { name: 'Überweisung' },
        { name: 'PayPal' }
      ]
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
