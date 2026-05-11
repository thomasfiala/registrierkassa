import { Command } from 'commander';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getConfig, getConfigPath } from '../lib/config';
import { getDbPath, readDb, commitReceipt, initDbRepo } from '../lib/db';
import { generateInvoicePdf } from '../lib/pdf';
import { encryptTurnover, buildRksvPayload, signPayloadJWS, hashJws } from '../lib/rksv';

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

async function setup() {
  try {
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (!fs.existsSync(configPath)) {
      // Find template
      let templatePath = path.join(process.cwd(), 'config.template.json');
      if (!fs.existsSync(templatePath)) {
          templatePath = path.join(__dirname, '../../config.template.json'); // if run from compiled dir
      }
      if (fs.existsSync(templatePath)) {
          const configTpl = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
          configTpl.dbGitRepoPath = "db"; // local inside ~/.registrierkassa/db
          fs.writeFileSync(configPath, JSON.stringify(configTpl, null, 2));
          console.log(`✅ Created config file at ${configPath}`);
      } else {
          console.error("❌ config.template.json not found!");
          return;
      }
    } else {
      console.log(`ℹ️ Config file already exists at ${configPath}`);
    }
    
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
    console.log("ℹ️ If you want to enable automatic Git backups for your DB, check the gitBackup section in your config and README.md.");
  } catch (error) {
    console.error(`❌ Setup failed:`, error);
  }
}

program.command('setup')
  .description('Initialize the configuration and database, and generate the Startbeleg')
  .action(() => setup());

program.command('startbeleg')
  .description('Generate the mandatory Startbeleg (Zero-Receipt to initialize the chain)')
  .action(() => createSystemBeleg('Startbeleg'));

program.command('monatsbeleg')
  .description('Generate the monthly zero-receipt (Monatsbeleg)')
  .action(() => createSystemBeleg('Monatsbeleg'));

program.command('jahresbeleg')
  .description('Generate the yearly zero-receipt (Jahresbeleg)')
  .action(() => createSystemBeleg('Jahresbeleg'));

program.command('tagesbeleg')
  .description('Generate a daily zero-receipt (Tagesbeleg)')
  .action(() => createSystemBeleg('Tagesbeleg'));

program.command('nullbeleg')
  .description('Generate a generic zero-receipt (Nullbeleg)')
  .action(() => createSystemBeleg('Nullbeleg'));

program.command('export')
  .description('Export the database receipts to a CSV file')
  .action(() => exportCsv());

program.parse();
