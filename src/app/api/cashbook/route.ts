import { NextResponse } from 'next/server';
import { readCashEntries, addCashEntry, updateCashEntry, deleteCashEntry, CashEntryType } from '@/lib/db';
import { getCurrentTimezonedDate } from '@/lib/date';

export async function GET() {
  try {
    const entries = await readCashEntries();
    return NextResponse.json({ success: true, entries });
  } catch (error: any) {
    console.error('Failed to read cashbook entries:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type: CashEntryType = body.type;
    if (type !== 'Einzahlung' && type !== 'Auszahlung') {
      return NextResponse.json({ success: false, error: 'Ungültiger Buchungstyp (muss Einzahlung oder Auszahlung sein)' }, { status: 400 });
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Ungültiger Betrag' }, { status: 400 });
    }

    const defaultDate = getCurrentTimezonedDate().substring(0, 10);
    const date = body.date && typeof body.date === 'string' && body.date.trim() ? body.date.trim() : defaultDate;
    const comment = body.comment ? String(body.comment).trim() : '';

    const entry = await addCashEntry({
      type,
      amount,
      date,
      comment
    });

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    console.error('Failed to add cashbook entry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, type, amount, date, comment } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID erforderlich' }, { status: 400 });
    }

    if (type !== undefined && type !== 'Einzahlung' && type !== 'Auszahlung') {
      return NextResponse.json({ success: false, error: 'Ungültiger Buchungstyp' }, { status: 400 });
    }

    let parsedAmount: number | undefined = undefined;
    if (amount !== undefined) {
      parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ success: false, error: 'Ungültiger Betrag' }, { status: 400 });
      }
    }

    const updated = await updateCashEntry(id, {
      type,
      amount: parsedAmount,
      date,
      comment
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (error: any) {
    console.error('Failed to update cashbook entry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch (_) {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID erforderlich' }, { status: 400 });
    }

    const deleted = await deleteCashEntry(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Eintrag nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete cashbook entry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
