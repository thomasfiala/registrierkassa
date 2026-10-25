const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function getConfigPath() {
  const userConfig = path.join(os.homedir(), '.registrierkassa', 'config.json');
  if (fs.existsSync(userConfig)) {
    return userConfig;
  }
  const localConfig = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(localConfig)) {
    return localConfig;
  }
  return userConfig;
}

function getDbDir() {
  if (process.env.DB_DIR) {
    return path.resolve(process.env.DB_DIR);
  }

  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(`config.json not found at ${configPath}. Please run "npm run cli setup" or configure registrierkassa.`);
  }

  const configDir = path.dirname(configPath);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const dbRepoPath = config.dbGitRepoPath || 'db';

  if (path.isAbsolute(dbRepoPath)) {
    return dbRepoPath;
  }
  return path.resolve(configDir, dbRepoPath);
}

let DB_DIR;
try {
  DB_DIR = getDbDir();
} catch (err) {
  console.error(`[DEP Export] Configuration Error:`, err.message);
  process.exit(1);
}

const DB_PATH = path.join(DB_DIR, 'db.json');
const EXPORT_PATH = path.join(DB_DIR, 'dep-export.json');

console.log(`[DEP Export] Starting export...`);
console.log(`[DEP Export] Using database directory: ${DB_DIR}`);

try {
  // 1. Read database
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[DEP Export] Error: Database not found at ${DB_PATH}`);
    process.exit(1);
  }
  
  const dbContent = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(dbContent);

  // 2. Extract JWS strings from all receipts
  const jwsList = (db.receipts || [])
    .filter(r => r.rksv && r.rksv.jws)
    .map(r => r.rksv.jws);

  // 3. Build the official DEP structure
  let certSerial = "STUB_CERT_SERIAL";
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.rksv && config.rksv.certSerial) {
        certSerial = config.rksv.certSerial;
      }
    }
  } catch (err) {
    // Keep fallback
  }

  const depExport = {
    "Belege-Gruppe": [
      {
        "Signaturzertifikat": certSerial,
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
  try {
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
  } catch (gitErr) {
    console.error(`[DEP Export] Git error:`, gitErr.message);
  }

} catch (e) {
  console.error('[DEP Export] Error:', e.message);
  process.exit(1);
}
