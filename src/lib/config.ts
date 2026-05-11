import fs from 'fs';
import path from 'path';
import os from 'os';

export function getConfigPath() {
  return path.join(os.homedir(), '.registrierkassa', 'config.json');
}

export function getConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json is missing in ~/.registrierkassa/. Please run "npm run cli setup" to initialize it.');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
