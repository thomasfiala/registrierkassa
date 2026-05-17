import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import { getConfig, getConfigPath } from './config';

export async function getDbPath() {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);
  const config = getConfig();
  if (path.isAbsolute(config.dbGitRepoPath)) {
    return config.dbGitRepoPath;
  }
  return path.resolve(configDir, config.dbGitRepoPath);
}

export async function initDbRepo() {
  const dbRepo = await getDbPath();
  if (!fs.existsSync(dbRepo)) fs.mkdirSync(dbRepo, { recursive: true });
  
  const git = simpleGit(dbRepo);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    const dbFile = path.join(dbRepo, 'db.json');
    if (!fs.existsSync(dbFile)) {
      let templatePath = path.join(process.cwd(), 'db.template.json');
      if (!fs.existsSync(templatePath)) {
          templatePath = path.join(__dirname, '../../db.template.json');
      }
      if (fs.existsSync(templatePath)) {
          fs.copyFileSync(templatePath, dbFile);
      } else {
          fs.writeFileSync(dbFile, JSON.stringify({ receipts: [], currentTurnover: 0, lastReceiptHash: "INITIAL_HASH" }, null, 2));
      }
    }
    await git.add('.');
    await git.commit('Initial database setup');
    await pushIfEnabled(git);
  }
}

export async function readDb() {
  const dbRepo = await getDbPath();
  const dbFile = path.join(dbRepo, 'db.json');
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

export async function writeDb(db: any) {
  const dbRepo = await getDbPath();
  const dbFile = path.join(dbRepo, 'db.json');
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

async function pushIfEnabled(git: any) {
  try {
    const config = getConfig();
    if (config.gitBackup?.enabled) {
      const remote = config.gitBackup.remote || 'origin';
      const branch = config.gitBackup.branch || 'main';
      console.log(`Pushing database to ${remote}/${branch}...`);
      await git.push(remote, branch);
    }
  } catch (error) {
    console.error('Failed to push database to git backup remote:', error);
  }
}

export async function commitReceipt(receiptData: any, pdfPath: string | undefined, newHash: string | undefined) {
  const dbRepo = await getDbPath();
  const db = await readDb();
  
  // Storno handling
  if (receiptData.isStorno && receiptData.stornoRef) {
    const original = db.receipts.find((r: any) => r.receiptNumber === receiptData.stornoRef);
    if (original) original.stornoed = true;
  }
  
  // If it's a new proforma saved as final, mark the old proforma as converted
  if (receiptData.fromProformaId) {
    const proforma = db.receipts.find((r: any) => r.id === receiptData.fromProformaId);
    if (proforma) proforma.convertedToFinal = true;
    delete receiptData.fromProformaId;
  }

  db.receipts.push(receiptData);
  if (receiptData.type === 'final' && !receiptData.isProformaPreview) {
    db.currentTurnover += receiptData.totalAmount || 0;
    if (newHash) {
      db.lastReceiptHash = newHash;
    }
  }
  
  await writeDb(db);
  
  const git = simpleGit(dbRepo);
  await git.add('db.json');
  if (pdfPath && fs.existsSync(pdfPath)) await git.add(pdfPath);
  
  await git.commit(`Receipt ${receiptData.receiptNumber}${receiptData.type === 'proforma' ? ' (Proforma)' : ''}`);
  await pushIfEnabled(git);
  return true;
}

export async function getPdfPath(receipt: any) {
  const dbRepo = await getDbPath();
  const d = new Date(receipt.date);
  const yearStr = d.getFullYear().toString();
  const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
  const dirPath = path.join(dbRepo, yearStr, monthStr);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return path.join(dirPath, `${receipt.receiptNumber}.pdf`);
}

export async function deleteProforma(id: string) {
  const dbRepo = await getDbPath();
  const db = await readDb();
  
  const receipt = db.receipts.find((r: any) => r.id === id);
  if (!receipt || receipt.type !== 'proforma') throw new Error("Proforma not found or not a proforma");
  
  db.receipts = db.receipts.filter((r: any) => r.id !== id);
  await writeDb(db);
  
  const git = simpleGit(dbRepo);
  await git.add('db.json');
  // Optional: delete pdf if exists, but ok to leave
  const pdfPath = await getPdfPath(receipt);
  if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      await git.add(pdfPath);
  }
  await git.commit(`Deleted Proforma ${receipt.receiptNumber}`);
  await pushIfEnabled(git);
}
export async function wipeDbHistory() { console.log('Wiping DB history... (Mocked for now)'); }
