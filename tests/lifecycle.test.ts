import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
    generateFeature,
    listFeatures,
    printFeatureTree,
    removeFeatureOrSlice,
} from '../src/index';

describe('lifecycle & management (list, add, remove)', () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-lifecycle-test-'));
        process.chdir(tempDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await fs.remove(tempDir);
    });

    describe('listFeatures', () => {
        it('returns empty array when target directory does not exist', async () => {
            const nonExistentDir = path.join(tempDir, 'does-not-exist');
            const features = await listFeatures({ targetDir: nonExistentDir });
            expect(features).toEqual([]);
        });

        it('returns empty array for an empty directory', async () => {
            const emptyDir = path.join(tempDir, 'features');
            await fs.ensureDir(emptyDir);

            const features = await listFeatures({ targetDir: emptyDir });
            expect(features).toEqual([]);
        });

        it('ignores non-feature directories and files', async () => {
            const featuresDir = path.join(tempDir, 'features');
            await fs.ensureDir(featuresDir);

            // Create an empty subdirectory that is not a feature
            await fs.ensureDir(path.join(featuresDir, 'random-empty-folder'));
            // Create a plain file
            await fs.writeFile(path.join(featuresDir, 'notes.txt'), 'hello world');
            // Create a hidden directory
            await fs.ensureDir(path.join(featuresDir, '.hidden'));

            const features = await listFeatures({ targetDir: featuresDir });
            expect(features).toEqual([]);
        });

        it('discovers Next.js features, slices, shared folders, and presets', async () => {
            const featuresDir = path.join(tempDir, 'src', 'features');

            // Generate an auth feature with Next.js slices and query preset
            await generateFeature({
                name: 'auth',
                isNextjs: true,
                slices: ['login', 'register'],
                outputDir: 'src/features',
                query: true,
                serverActions: true,
            });

            // Generate a billing feature with Zustand preset
            await generateFeature({
                name: 'billing',
                isNextjs: true,
                slices: ['invoices'],
                outputDir: 'src/features',
                zustand: true,
                withTests: true,
            });

            const features = await listFeatures({ targetDir: featuresDir });

            expect(features).toHaveLength(2);

            // Auth feature
            const authFeature = features.find((f) => f.name === 'auth');
            expect(authFeature).toBeDefined();
            expect(authFeature?.slices).toEqual(['login', 'register']);
            expect(authFeature?.sharedFolders).toContain('components');
            expect(authFeature?.sharedFolders).toContain('types');
            expect(authFeature?.sharedFolders).toContain('services');
            expect(authFeature?.sharedFolders).toContain('actions');
            expect(authFeature?.presets).toContain('TanStack Query');
            expect(authFeature?.presets).toContain('Server Actions');

            // Billing feature
            const billingFeature = features.find((f) => f.name === 'billing');
            expect(billingFeature).toBeDefined();
            expect(billingFeature?.slices).toEqual(['invoices']);
            expect(billingFeature?.sharedFolders).toContain('store');
            expect(billingFeature?.presets).toContain('Zustand');
            expect(billingFeature?.presets).toContain('Tests');
        });

        it('discovers React features and minimal scaffolding', async () => {
            const featuresDir = path.join(tempDir, 'src', 'modules');

            await generateFeature({
                name: 'dashboard',
                isNextjs: false,
                slices: ['analytics'],
                outputDir: 'src/modules',
                minimal: true,
            });

            const features = await listFeatures({ targetDir: featuresDir });

            expect(features).toHaveLength(1);
            expect(features[0].name).toBe('dashboard');
            expect(features[0].slices).toEqual(['analytics']);
            expect(features[0].sharedFolders).toEqual(['components', 'types']);
            expect(features[0].presets).toEqual([]);
        });

        it('outputs JSON when json option is true', async () => {
            const featuresDir = path.join(tempDir, 'features');

            await generateFeature({
                name: 'profile',
                isNextjs: true,
                slices: ['settings'],
                outputDir: 'features',
            });

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const features = await listFeatures({ targetDir: featuresDir, json: true });

            expect(consoleSpy).toHaveBeenCalled();
            const loggedString = consoleSpy.mock.calls.find((call) => {
                try {
                    const parsed = JSON.parse(call[0]);
                    return Array.isArray(parsed) && parsed.length > 0 && parsed[0].name === 'profile';
                } catch {
                    return false;
                }
            });

            expect(loggedString).toBeDefined();
            expect(features).toHaveLength(1);
            expect(features[0].name).toBe('profile');

            consoleSpy.mockRestore();
        });

        it('supports pointing targetDir directly to a specific feature directory', async () => {
            await generateFeature({
                name: 'checkout',
                isNextjs: true,
                slices: ['payment', 'confirmation'],
                outputDir: 'features',
            });

            const specificFeatureDir = path.join(tempDir, 'features', 'checkout');
            const features = await listFeatures({ targetDir: specificFeatureDir });

            expect(features).toHaveLength(1);
            expect(features[0].name).toBe('checkout');
            expect(features[0].slices).toEqual(['confirmation', 'payment']);
        });

        it('prints readable feature tree without error', async () => {
            const featuresDir = path.join(tempDir, 'features');

            await generateFeature({
                name: 'users',
                isNextjs: true,
                slices: ['list', 'detail'],
                outputDir: 'features',
                query: true,
                zustand: true,
            });

            const features = await listFeatures({ targetDir: featuresDir });

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            printFeatureTree(features, featuresDir);
            expect(consoleSpy).toHaveBeenCalled();

            // Also test empty tree
            printFeatureTree([], featuresDir);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('add slices to existing feature', () => {
        it('adds new slices to an existing feature without modifying existing slices', async () => {
            const featuresDir = path.join(tempDir, 'src', 'features');

            // Initial feature with one slice
            await generateFeature({
                name: 'users',
                isNextjs: true,
                slices: ['profile'],
                outputDir: 'src/features',
            });

            const profilePage = path.join(featuresDir, 'users', 'profile', 'page.tsx');
            await fs.writeFile(profilePage, '// custom user profile code');

            // Add new slice 'settings'
            await generateFeature({
                name: 'users',
                isNextjs: true,
                slices: ['settings'],
                outputDir: 'src/features',
            });

            // Check original slice is untouched
            const profileContent = await fs.readFile(profilePage, 'utf-8');
            expect(profileContent).toBe('// custom user profile code');

            // Check new slice exists
            const settingsPage = path.join(featuresDir, 'users', 'settings', 'page.tsx');
            expect(await fs.pathExists(settingsPage)).toBe(true);

            // Check listFeatures sees both slices
            const features = await listFeatures({ targetDir: featuresDir });
            expect(features).toHaveLength(1);
            expect(features[0].slices).toEqual(['profile', 'settings']);
        });

        it('supports dry-run when adding slices', async () => {
            const featuresDir = path.join(tempDir, 'src', 'features');

            await generateFeature({
                name: 'users',
                isNextjs: true,
                slices: ['profile'],
                outputDir: 'src/features',
            });

            await generateFeature({
                name: 'users',
                isNextjs: true,
                slices: ['avatar'],
                outputDir: 'src/features',
                dryRun: true,
            });

            const avatarPage = path.join(featuresDir, 'users', 'avatar', 'page.tsx');
            expect(await fs.pathExists(avatarPage)).toBe(false);
        });
    });

    describe('removeFeatureOrSlice', () => {
        beforeEach(async () => {
            // Scaffold a feature with two slices
            await generateFeature({
                name: 'orders',
                isNextjs: true,
                slices: ['cart', 'history'],
                outputDir: 'src/features',
            });
        });

        it('removes a specific slice from a feature', async () => {
            const featureDir = path.join(tempDir, 'src', 'features', 'orders');
            const cartSlice = path.join(featureDir, 'cart');
            const historySlice = path.join(featureDir, 'history');

            expect(await fs.pathExists(cartSlice)).toBe(true);
            expect(await fs.pathExists(historySlice)).toBe(true);

            const result = await removeFeatureOrSlice({
                feature: 'orders',
                slice: 'cart',
                targetDir: 'src/features',
            });

            expect(result).toBe(true);
            expect(await fs.pathExists(cartSlice)).toBe(false);
            expect(await fs.pathExists(historySlice)).toBe(true);
            expect(await fs.pathExists(featureDir)).toBe(true);
        });

        it('performs dry run when removing a slice without deleting files', async () => {
            const cartSlice = path.join(tempDir, 'src', 'features', 'orders', 'cart');
            expect(await fs.pathExists(cartSlice)).toBe(true);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const result = await removeFeatureOrSlice({
                feature: 'orders',
                slice: 'cart',
                targetDir: 'src/features',
                dryRun: true,
            });

            expect(result).toBe(true);
            expect(await fs.pathExists(cartSlice)).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[DRY RUN] Would remove slice')
            );

            consoleSpy.mockRestore();
        });

        it('removes an entire feature directory when slice is omitted', async () => {
            const featureDir = path.join(tempDir, 'src', 'features', 'orders');
            expect(await fs.pathExists(featureDir)).toBe(true);

            const result = await removeFeatureOrSlice({
                feature: 'orders',
                targetDir: 'src/features',
            });

            expect(result).toBe(true);
            expect(await fs.pathExists(featureDir)).toBe(false);
        });

        it('performs dry run when removing an entire feature without deleting it', async () => {
            const featureDir = path.join(tempDir, 'src', 'features', 'orders');
            expect(await fs.pathExists(featureDir)).toBe(true);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const result = await removeFeatureOrSlice({
                feature: 'orders',
                targetDir: 'src/features',
                dryRun: true,
            });

            expect(result).toBe(true);
            expect(await fs.pathExists(featureDir)).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[DRY RUN] Would remove feature')
            );

            consoleSpy.mockRestore();
        });

        it('returns false when feature does not exist', async () => {
            const result = await removeFeatureOrSlice({
                feature: 'nonexistent-feature',
                targetDir: 'src/features',
            });

            expect(result).toBe(false);
        });

        it('returns false when slice does not exist in an existing feature', async () => {
            const result = await removeFeatureOrSlice({
                feature: 'orders',
                slice: 'nonexistent-slice',
                targetDir: 'src/features',
            });

            expect(result).toBe(false);
        });

        it('returns false when feature name is empty', async () => {
            const result = await removeFeatureOrSlice({
                feature: '',
                targetDir: 'src/features',
            });

            expect(result).toBe(false);
        });
    });
});
