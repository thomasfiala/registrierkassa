import fs from 'fs';
import path from 'path';
import os from 'os';

export function getConfigPath(): string {
  return path.join(os.homedir(), '.registrierkassa', 'config.json');
}

export function getDbDirPath(): string {
  const rootConfigPath = getConfigPath();
  const configDir = path.dirname(rootConfigPath);
  if (!fs.existsSync(rootConfigPath)) {
    return path.join(configDir, 'db');
  }
  try {
    const rootConfig = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
    const dbPath = rootConfig.dbGitRepoPath || 'db';
    if (path.isAbsolute(dbPath)) {
      return dbPath;
    }
    return path.resolve(configDir, dbPath);
  } catch {
    return path.join(configDir, 'db');
  }
}

export function getDbConfigPath(): string {
  return path.join(getDbDirPath(), 'config.json');
}

export function getCertificatePath(): string {
  const dbDir = getDbDirPath();
  const dbCert = path.join(dbDir, 'certificate.cer');
  if (fs.existsSync(dbCert)) {
    return dbCert;
  }
  const rootCert = path.join(path.dirname(getConfigPath()), 'certificate.cer');
  if (fs.existsSync(rootCert)) {
    return rootCert;
  }
  return dbCert;
}

export function deepMerge(target: any, source: any): any {
  if (!source) return target;
  if (!target) return source;
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== undefined && source[key] !== null) {
      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }
  return output;
}

export function splitConfig(fullConfig: any): { rootConfig: any; dbConfig: any } {
  const { dbGitRepoPath, ...dbParts } = fullConfig || {};
  return {
    rootConfig: {
      dbGitRepoPath: dbGitRepoPath || 'db'
    },
    dbConfig: dbParts
  };
}

export function getConfig(): any {
  const rootConfigPath = getConfigPath();
  if (!fs.existsSync(rootConfigPath)) {
    throw new Error('config.json is missing in ~/.registrierkassa/. Please run "npm run cli setup" to initialize it.');
  }

  let rootConfig: any = {};
  try {
    rootConfig = JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
  } catch (e: any) {
    throw new Error(`Failed to parse root config at ${rootConfigPath}: ${e.message}`);
  }

  const dbConfigPath = getDbConfigPath();
  if (fs.existsSync(dbConfigPath)) {
    try {
      const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));
      // Database config provides tracked settings; root config provides dbGitRepoPath & local overrides
      return deepMerge(dbConfig, rootConfig);
    } catch (e: any) {
      console.warn(`Failed to parse db config at ${dbConfigPath}, falling back to root config: ${e.message}`);
      return rootConfig;
    }
  }

  return rootConfig;
}

export function saveConfig(fullConfig: any): void {
  const { rootConfig, dbConfig } = splitConfig(fullConfig);

  const rootConfigPath = getConfigPath();
  const rootConfigDir = path.dirname(rootConfigPath);
  if (!fs.existsSync(rootConfigDir)) {
    fs.mkdirSync(rootConfigDir, { recursive: true });
  }

  const dbDirPath = getDbDirPath();
  if (!fs.existsSync(dbDirPath)) {
    fs.mkdirSync(dbDirPath, { recursive: true });
  }

  const dbConfigPath = getDbConfigPath();
  fs.writeFileSync(dbConfigPath, JSON.stringify(dbConfig, null, 2), 'utf8');
  fs.writeFileSync(rootConfigPath, JSON.stringify(rootConfig, null, 2), 'utf8');
}
