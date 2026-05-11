import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import { getConfig } from './config.ts';

export async function getDbPath() {
  const config = getConfig();
  return path.resolve(process.cwd(), config.dbGitRepoPath);
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
      const templatePath = path.join(process.cwd(), 'db.template.json');
      fs.copyFileSync(templatePath, dbFile);
    }
    await git.add('.');
    await git.commit('Initial database setup');
  }
}

export async function readDb() {
  const dbRepo = await getDbPath();
  const dbFile = path.join(dbRepo, 'db.json');
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

export async function commitReceipt(receiptData: any, pdfPath: string | undefined, newHash: string) {
  const dbRepo = await getDbPath();
  const dbFile = path.join(dbRepo, 'db.json');
  const db = await readDb();
  
  db.receipts.push(receiptData);
  db.currentTurnover += receiptData.totalAmount || 0;
  db.lastReceiptHash = newHash;
  
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  
  const git = simpleGit(dbRepo);
  await git.add('db.json');
  if (pdfPath && fs.existsSync(pdfPath)) await git.add(pdfPath);
  
  await git.commit(`Receipt ${receiptData.receiptNumber}`);
  return true;
}
