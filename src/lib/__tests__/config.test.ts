import fs from 'fs';
import path from 'path';
import os from 'os';
import { deepMerge, splitConfig, getConfig, getConfigPath, getDbDirPath, getCertificatePath } from '../config';

describe('Config and Database Synchronization', () => {
  const tmpDir = path.join(os.tmpdir(), `rk-config-test-${Date.now()}`);
  const rootConfigPath = path.join(tmpDir, 'config.json');
  const dbDir = path.join(tmpDir, 'db');
  const dbConfigPath = path.join(dbDir, 'config.json');

  beforeAll(() => {
    fs.mkdirSync(dbDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('deepMerge', () => {
    it('should correctly merge nested objects without mutating source', () => {
      const target = {
        appHeader: 'FeWo Kassa',
        rksv: { kassenID: '123', certSerial: '7FEED511' },
        items: ['a']
      };
      const source = {
        rksv: { certSerial: 'NEW_SERIAL' },
        dbGitRepoPath: 'db',
        items: ['b']
      };

      const merged = deepMerge(target, source);
      expect(merged.appHeader).toBe('FeWo Kassa');
      expect(merged.rksv.kassenID).toBe('123');
      expect(merged.rksv.certSerial).toBe('NEW_SERIAL');
      expect(merged.dbGitRepoPath).toBe('db');
      expect(merged.items).toEqual(['b']);
    });
  });

  describe('splitConfig', () => {
    it('should extract dbGitRepoPath to rootConfig and all other parts to dbConfig', () => {
      const fullConfig = {
        appHeader: 'FeWo Kassa',
        timezone: 'Europe/Vienna',
        dbGitRepoPath: 'db',
        business: { name: 'Test Business' },
        rksv: { kassenID: '123' }
      };

      const { rootConfig, dbConfig } = splitConfig(fullConfig);
      expect(rootConfig).toEqual({ dbGitRepoPath: 'db' });
      expect(dbConfig.appHeader).toBe('FeWo Kassa');
      expect(dbConfig.timezone).toBe('Europe/Vienna');
      expect(dbConfig.dbGitRepoPath).toBeUndefined();
      expect(dbConfig.business).toEqual({ name: 'Test Business' });
    });
  });
});
