import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getConfig } from '@/lib/config';
import { readDb, getPdfPath } from '@/lib/db';
import fs from 'fs';

export async function POST(request: Request) {
  try {
    const { to, subject, text, receiptNumber } = await request.json();

    if (!to || !subject || !text || !receiptNumber) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const config = getConfig();
    if (!config.emailSettings || !config.emailSettings.host) {
      return NextResponse.json({ success: false, error: 'Email settings are not configured in config.json' }, { status: 500 });
    }

    // Find the receipt
    const db = await readDb();
    const receipt = db.receipts.find((r: any) => r.receiptNumber === receiptNumber);
    if (!receipt) {
      return NextResponse.json({ success: false, error: 'Receipt not found' }, { status: 404 });
    }

    // Get PDF path
    const pdfPath = await getPdfPath(receipt);
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ success: false, error: 'PDF file not found' }, { status: 404 });
    }

    // Configure Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: config.emailSettings.host,
      port: config.emailSettings.port || 587,
      secure: config.emailSettings.port === 465,
      auth: {
        user: config.emailSettings.user,
        pass: config.emailSettings.pass,
      },
    });

    // Send the email
    await transporter.sendMail({
      from: config.emailSettings.from || config.emailSettings.user,
      to,
      subject,
      text,
      attachments: [
        {
          filename: `Rechnung_${receiptNumber}.pdf`,
          path: pdfPath,
          contentType: 'application/pdf',
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
