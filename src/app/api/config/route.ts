import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export async function GET() {
  try {
    const config = getConfig();
    return NextResponse.json({
      itemTemplates: config.itemTemplates || [],
      business: config.business
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
