import { Command } from 'commander';
import crypto from 'crypto';
import path from 'path';
import { getConfig } from '../lib/config.ts';
import { getDbPath, readDb, commitReceipt, initDbRepo } from '../lib/db.ts';
import { generateInvoicePdf } from '../lib/pdf.ts';
import { encryptTurnover, buildRksvPayload, signPayloadJWS, hashJws } from '../lib/rksv.ts';

const program = new Command();

program
  .name('registrierkassa')
  .description('Austrian RKSV-compliant cash register CLI')
  .version('1.0.0');

async function createSystemBeleg(type: 'Startbeleg' | 'Monatsbeleg' | 'Jahresbeleg') {
  try {
    await initDbRepo();
    const config = getConfig();
    const db = await readDb();
    
    const receiptId = crypto.randomUUID();
    const receiptNumber = `${type.toUpperCase()}-${Date.now()}`;
    const date = new Date().toISOString();
    
    // System receipts have 0 turnover impact
    const items = [{ name: type, price: 0, taxRate: '0%' }];
    const totalAmount = 0;
    
    // Cryptography chain
    const newTurnoverCents = Math.round(db.currentTurnover * 100);
    const encryptedTurnover = encryptTurnover(newTurnoverCents, config.rksv.kassenID, receiptNumber, config.rksv.aesKey);
    const previousHash = db.lastReceiptHash || "ICAgICAgICAgICg="; 
    
    const rksvPayload = buildRksvPayload({ receiptNumber, date, items }, config, previousHash, encryptedTurnover);
    const jwsString = signPayloadJWS(rksvPayload);
    const newHash = hashJws(jwsString);

    const receiptData = {
      id: receiptId,
      receiptNumber,
      date,
      items,
      totalAmount,
      type: 'final', // It's a final receipt, just with 0 value
      isSystemBeleg: true,
      systemType: type,
      rksv: {
        payload: rksvPayload,
        jws: jwsString,
        hash: newHash
      }
    };

    const dbRepoPath = await getDbPath();
    const pdfFilename = `${receiptNumber}.pdf`;
    const pdfPath = path.join(dbRepoPath, pdfFilename);

    console.log(`Generating PDF for ${type}...`);
    await generateInvoicePdf(receiptData, pdfPath);
    
    console.log(`Committing to Git Database...`);
    await commitReceipt(receiptData, pdfPath, newHash);

    console.log(`✅ Successfully created ${type}: ${receiptNumber}`);
    console.log(`JWS Payload: ${jwsString}`);
    console.log(`PDF saved at: ${pdfPath}`);

  } catch (error) {
    console.error(`❌ Failed to create ${type}:`, error);
  }
}

program.command('startbeleg')
  .description('Generate the mandatory Startbeleg (Zero-Receipt to initialize the chain)')
  .action(() => createSystemBeleg('Startbeleg'));

program.command('monatsbeleg')
  .description('Generate the monthly zero-receipt (Monatsbeleg)')
  .action(() => createSystemBeleg('Monatsbeleg'));

program.command('jahresbeleg')
  .description('Generate the yearly zero-receipt (Jahresbeleg)')
  .action(() => createSystemBeleg('Jahresbeleg'));

program.parse();
