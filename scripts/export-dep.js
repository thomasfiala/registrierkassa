const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_DIR = path.join(__dirname, '../../registrierkassa-db');
const DB_PATH = path.join(DB_DIR, 'db.json');
const EXPORT_PATH = path.join(DB_DIR, 'dep-export.json');

console.log(`[DEP Export] Starting export...`);

try {
  // 1. Read database
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[DEP Export] Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }
  
  const dbContent = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(dbContent);

  // 2. Extract JWS strings from all receipts
  const jwsList = db.receipts
    .filter(r => r.rksv && r.rksv.jws)
    .map(r => r.rksv.jws);

  // 3. Build the official DEP structure
  // Note: Certificate details should eventually be dynamically fetched from config/smartcard
  const depExport = {
    "Belege-Gruppe": [
      {
        "Signaturzertifikat": "STUB_CERT_SERIAL",
        "Zertifizierungsdiensteanbieter": "AT1",
        "Belege-kompakt": jwsList
      }
    ]
  };

  // 4. Write export file
  fs.writeFileSync(EXPORT_PATH, JSON.stringify(depExport, null, 2), 'utf8');
  console.log(`[DEP Export] Wrote ${jwsList.length} receipts to ${EXPORT_PATH}`);

  // 5. Commit and push to backup repository
  console.log(`[DEP Export] Committing and pushing to git repository...`);
  execSync('git add dep-export.json', { cwd: DB_DIR, stdio: 'inherit' });
  
  try {
    execSync('git commit -m "chore: automated DEP export backup"', { cwd: DB_DIR, stdio: 'ignore' });
  } catch (commitErr) {
    // Commit fails if there are no changes, which is fine
    console.log(`[DEP Export] No new changes to commit.`);
  }
  
  try {
    execSync('git push', { cwd: DB_DIR, stdio: 'inherit' });
    console.log('[DEP Export] Push successful.');
  } catch (pushErr) {
    console.error('[DEP Export] Warning: git push failed. Ensure the remote is configured.');
  }

} catch (e) {
  console.error('[DEP Export] Error:', e.message);
  process.exit(1);
}
