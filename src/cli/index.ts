import { Command } from 'commander';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-ignore
import { prompt } from 'enquirer';
import { getConfig, getConfigPath } from '../lib/config';
import { getDbPath, readDb, commitReceipt, initDbRepo, wipeDbHistory, writeDb } from '../lib/db';
import { generateInvoicePdf } from '../lib/pdf';
import { encryptTurnover, buildRksvPayload, signPayloadJWS, hashJws } from '../lib/rksv';
import { sendEmail } from '../lib/email';

const program = new Command();

program
  .name('registrierkassa')
  .description('Austrian RKSV-compliant cash register CLI')
  .version('1.0.0');

async function createSystemBeleg(type: 'Startbeleg' | 'Monatsbeleg' | 'Jahresbeleg' | 'Tagesbeleg' | 'Nullbeleg') {
  try {
    await initDbRepo();
    const config = getConfig();
    const db = await readDb();
    
    const receiptId = crypto.randomUUID();
    const receiptNumber = `${type.toUpperCase()}-${Date.now()}`;
    const date = new Date().toISOString();
    
    const items = [{ name: type, price: 0, taxRate: '0%', quantity: 1 }];
    const totalAmount = 0;
    
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
      type: 'final', 
      isSystemBeleg: true,
      systemType: type,
      rksv: {
        payload: rksvPayload,
        jws: jwsString,
        hash: newHash
      }
    };

    const pdfPath = await require('../lib/db').getPdfPath(receiptData);

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

async function exportCsv() {
  try {
    const db = await readDb();
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
    const outPath = path.join(process.cwd(), 'export.csv');
    fs.writeFileSync(outPath, csvContent);
    console.log(`✅ Exported CSV to ${outPath}`);
  } catch (error) {
    console.error(`❌ Failed to export CSV:`, error);
  }
}

async function setupInteractive() {
  try {
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let configTpl: any = {};
    let templatePath = path.join(process.cwd(), 'config.template.json');
    if (!fs.existsSync(templatePath)) {
        templatePath = path.join(__dirname, '../../config.template.json');
    }
    if (fs.existsSync(templatePath)) {
        configTpl = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    }

    let existingConfig: any = {};
    if (fs.existsSync(configPath)) {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`ℹ️ Config file exists at ${configPath}.`);
      const { wipeHistory } = await prompt<{wipeHistory: boolean}>({
        type: 'confirm',
        name: 'wipeHistory',
        message: 'Do you want to wipe the existing git history and database?',
        initial: false
      });
      if (wipeHistory) {
        if (wipeDbHistory) await wipeDbHistory();
        else console.log('wipeDbHistory not available, skipping db wipe.');
      }
    } else {
      console.log('No existing config found. Starting fresh.');
    }

    const mergeConfig = { ...configTpl, ...existingConfig };

    const questions = [
      { type: 'input', name: 'dbGitRepoPath', message: 'DB Git Repo Path', initial: mergeConfig.dbGitRepoPath || "db" },
      { type: 'input', name: 'rksv.kassenID', message: 'RKSV Kassen ID', initial: mergeConfig.rksv?.kassenID || "KASSA_1" },
      { type: 'input', name: 'rksv.aesKey', message: 'RKSV AES Key (Base64)', initial: mergeConfig.rksv?.aesKey || "" },
      { type: 'input', name: 'business.name', message: 'Business Name', initial: mergeConfig.business?.name || "" },
      { type: 'input', name: 'business.address', message: 'Business Address', initial: mergeConfig.business?.address || "" },
      { type: 'input', name: 'business.uid', message: 'Business UID (ATU...)', initial: mergeConfig.business?.uid || "" },
    ];

    const answers: any = {};
    for (const q of questions) {
      const parts = q.name.split('.');
      const val = await prompt({ type: q.type as any, name: 'res', message: q.message, initial: q.initial });
      if (parts.length === 1) answers[parts[0]] = (val as any).res;
      else {
        if (!answers[parts[0]]) answers[parts[0]] = {};
        answers[parts[0]][parts[1]] = (val as any).res;
      }
    }

    const finalConfig = { ...mergeConfig, ...answers };
    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
    console.log(`✅ Config updated at ${configPath}`);

    console.log("Initializing database repository...");
    await initDbRepo();
    
    const db = await readDb();
    if (db.receipts.length === 0) {
      console.log("Database is empty. Generating Startbeleg...");
      await createSystemBeleg('Startbeleg');
    } else {
      console.log("Database already contains receipts. Skipping Startbeleg.");
    }
    
    console.log("✅ Setup completed successfully!");
  } catch (error) {
    console.error(`❌ Setup failed:`, error);
  }
}

async function createReceiptInteractive() {
  // basic dummy placeholder to match frontend (interactive in full version)
  console.log('Creating a standard receipt... (in this subagent dummy implementation, creating 0-value nullbeleg as placeholder)');
  await createSystemBeleg('Nullbeleg');
}

async function listReceipts() {
  const db = await readDb();
  console.log('--- Receipts ---');
  db.receipts.forEach((r: any) => {
    console.log(`${r.receiptNumber} - ${r.date} - ${r.totalAmount} EUR`);
  });
}

async function stornoReceipt(receiptNumber: string) {
  console.log(`Storno for ${receiptNumber} not fully implemented in this CLI stub, but registered.`);
}

async function sendEmailCommand(receiptNumber: string, emailTo: string) {
  console.log(`Sending email for ${receiptNumber} to ${emailTo}...`);
  try {
    const db = await readDb();
    const receipt = db.receipts.find((r:any) => r.receiptNumber === receiptNumber);
    if(!receipt) throw new Error("Receipt not found");
    const pdfPath = await require('../lib/db').getPdfPath(receipt);
    const config = getConfig();
    await sendEmail({
      to: emailTo,
      subject: config.emailTexts.subject,
      text: config.emailTexts.body,
      attachments: [{ filename: 'Rechnung.pdf', path: pdfPath }]
    }, config);
    console.log('Email sent.');
  } catch (err) {
    console.error('Email failed:', err);
  }
}


program.command('setup')
  .description('Interactive setup')
  .action(() => setupInteractive());

program.command('startbeleg').action(() => createSystemBeleg('Startbeleg'));
program.command('monatsbeleg').action(() => createSystemBeleg('Monatsbeleg'));
program.command('jahresbeleg').action(() => createSystemBeleg('Jahresbeleg'));
program.command('tagesbeleg').action(() => createSystemBeleg('Tagesbeleg'));
program.command('nullbeleg').action(() => createSystemBeleg('Nullbeleg'));
program.command('export').action(() => exportCsv());

program.command('create-receipt')
  .description('Interactive receipt creation')
  .action(() => createReceiptInteractive());

program.command('list')
  .description('List all receipts')
  .action(() => listReceipts());

program.command('storno')
  .argument('<receiptNumber>', 'Receipt number to cancel')
  .action((rn) => stornoReceipt(rn));

program.command('email')
  .argument('<receiptNumber>', 'Receipt number to email')
  .argument('<email>', 'Destination email')
  .action((rn, email) => sendEmailCommand(rn, email));

program.parse();
