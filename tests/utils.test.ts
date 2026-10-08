import { capitalize, detectFeatureDir } from '../src/utils';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('utils', () => {
  describe('capitalize', () => {
    it('should capitalize a single word', () => {
      expect(capitalize('auth')).toBe('Auth');
    });

    it('should capitalize kebab-case string into PascalCase', () => {
      expect(capitalize('user-profile')).toBe('UserProfile');
      expect(capitalize('order-management-system')).toBe('OrderManagementSystem');
    });

    it('should handle parentheses and remove them', () => {
      expect(capitalize('auth(admin)')).toBe('AuthAdmin');
    });

    it('should handle already capitalized words', () => {
      expect(capitalize('Auth')).toBe('Auth');
    });
  });

  describe('detectFeatureDir', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-detect-'));
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('detects src/features when present', async () => {
      await fs.ensureDir(path.join(tempDir, 'src', 'features'));
      const detected = await detectFeatureDir(tempDir);
      expect(detected).toBe(path.join('src', 'features'));
    });

    it('detects src/modules when present and src/features is not', async () => {
      await fs.ensureDir(path.join(tempDir, 'src', 'modules'));
      const detected = await detectFeatureDir(tempDir);
      expect(detected).toBe(path.join('src', 'modules'));
    });

    it('detects features when present in root', async () => {
      await fs.ensureDir(path.join(tempDir, 'features'));
      const detected = await detectFeatureDir(tempDir);
      expect(detected).toBe('features');
    });

    it('returns "." when already inside a features directory', async () => {
      const nestedFeatures = path.join(tempDir, 'features');
      await fs.ensureDir(nestedFeatures);
      const detected = await detectFeatureDir(nestedFeatures);
      expect(detected).toBe('.');
    });

    it('defaults to "." when no feature directory exists', async () => {
      const detected = await detectFeatureDir(tempDir);
      expect(detected).toBe('.');
    });
  });
});
