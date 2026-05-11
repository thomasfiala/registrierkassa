import fs from 'fs';
import path from 'path';

export function getConfig() {
  const configPath = path.join(process.cwd(), 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json is missing. Please copy config.template.json to config.json and fill it out.');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
