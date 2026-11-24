import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
    generateFeature,
    renameFeatureOrSlice,
    moveSlice,
    addPresetsToFeature,
    listFeatures,
} from '../src/index';

describe('Safe Refactoring & Preset Lifecycle (rename, move, preset add)', () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-refactor-test-'));
        process.chdir(tempDir);
        await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'test-app' });
        await fs.writeJson(path.join(tempDir, 'tsconfig.json'), {
            compilerOptions: {
                baseUrl: '.',
                paths: {
                    '@/*': ['src/*'],
                },
            },
        });
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await fs.remove(tempDir);
    });

    it('renames a feature, internal files, symbols, and updates relative & alias imports', async () => {
        await generateFeature({
            name: 'auth',
            isNextjs: true,
            slices: ['login'],
            outputDir: 'src/features',
            query: true,
            zustand: true,
        });

        await fs.ensureDir(path.join(tempDir, 'src/app'));
        const appFile = path.join(tempDir, 'src/app/page.tsx');
        await fs.writeFile(
            appFile,
            [
                `import { authService } from '../features/auth';`,
                `import Login from '@/features/auth/login/page';`,
            ].join('\n')
        );

        // Dry run should not modify anything
        const dryRes = await renameFeatureOrSlice({
            source: 'auth',
            newName: 'identity',
            targetDir: 'src/features',
            dryRun: true,
        });
        expect(dryRes.success).toBe(true);
        expect(await fs.pathExists(path.join(tempDir, 'src/features/auth'))).toBe(true);
        expect(await fs.pathExists(path.join(tempDir, 'src/features/identity'))).toBe(false);

        // Real rename
        const res = await renameFeatureOrSlice({
            source: 'auth',
            newName: 'identity',
            targetDir: 'src/features',
        });
        expect(res.success).toBe(true);
        expect(await fs.pathExists(path.join(tempDir, 'src/features/auth'))).toBe(false);
        expect(await fs.pathExists(path.join(tempDir, 'src/features/identity'))).toBe(true);
        expect(
            await fs.pathExists(
                path.join(tempDir, 'src/features/identity/api/services/Identity.service.ts')
            )
        ).toBe(true);
        expect(
            await fs.pathExists(
                path.join(tempDir, 'src/features/identity/store/useIdentityStore.ts')
            )
        ).toBe(true);

        const updatedApp = await fs.readFile(appFile, 'utf-8');
        expect(updatedApp).toContain("from '../features/identity'");
        expect(updatedApp).toContain("from '@/features/identity/login/page'");
    });

    it('renames a slice and updates external imports', async () => {
        await generateFeature({
            name: 'auth',
            isNextjs: true,
            slices: ['login'],
            outputDir: 'src/features',
            withTests: true,
        });

        await fs.ensureDir(path.join(tempDir, 'src/app'));
        const routeFile = path.join(tempDir, 'src/app/login.tsx');
        await fs.writeFile(routeFile, `export { default } from '@/features/auth/login/page';\n`);

        const res = await renameFeatureOrSlice({
            source: 'auth/login',
            newName: 'sign-in',
            targetDir: 'src/features',
        });

        expect(res.success).toBe(true);
        expect(await fs.pathExists(path.join(tempDir, 'src/features/auth/sign-in/page.tsx'))).toBe(true);
        expect(
            await fs.pathExists(path.join(tempDir, 'src/features/auth/sign-in/sign-in.test.tsx'))
        ).toBe(true);

        const updatedRoute = await fs.readFile(routeFile, 'utf-8');
        expect(updatedRoute).toContain("from '@/features/auth/sign-in/page'");
    });

    it('moves a slice between features and updates external imports', async () => {
        await generateFeature({
            name: 'auth',
            isNextjs: true,
            slices: ['login', 'profile'],
            outputDir: 'src/features',
        });
        await generateFeature({
            name: 'users',
            isNextjs: true,
            slices: ['list'],
            outputDir: 'src/features',
        });

        await fs.ensureDir(path.join(tempDir, 'src/app'));
        const routeFile = path.join(tempDir, 'src/app/profile.tsx');
        await fs.writeFile(routeFile, `export { default } from '@/features/auth/profile/page';\n`);

        const res = await moveSlice({
            source: 'auth/profile',
            targetFeature: 'users',
            targetDir: 'src/features',
        });

        expect(res.success).toBe(true);
        expect(await fs.pathExists(path.join(tempDir, 'src/features/auth/profile'))).toBe(false);
        expect(await fs.pathExists(path.join(tempDir, 'src/features/users/profile/page.tsx'))).toBe(true);

        const updatedRoute = await fs.readFile(routeFile, 'utf-8');
        expect(updatedRoute).toContain("from '@/features/users/profile/page'");
    });

    it('retrofits presets onto an existing feature and updates its Public API barrel', async () => {
        await generateFeature({
            name: 'billing',
            isNextjs: true,
            slices: ['invoices'],
            outputDir: 'src/features',
        });

        const invoicePage = path.join(tempDir, 'src/features/billing/invoices/page.tsx');
        await fs.writeFile(invoicePage, '// custom invoice page');

        const ok = await addPresetsToFeature({
            feature: 'billing',
            targetDir: 'src/features',
            query: true,
            zod: true,
        });

        expect(ok).toBe(true);
        expect(await fs.readFile(invoicePage, 'utf-8')).toBe('// custom invoice page');
        expect(
            await fs.pathExists(path.join(tempDir, 'src/features/billing/api/queries/useBillingQuery.ts'))
        ).toBe(true);
        expect(
            await fs.pathExists(path.join(tempDir, 'src/features/billing/schemas/index.ts'))
        ).toBe(true);

        const barrel = await fs.readFile(path.join(tempDir, 'src/features/billing/index.ts'), 'utf-8');
        expect(barrel).toContain("export * from './api/queries';");
        expect(barrel).toContain("export * from './schemas';");

        const features = await listFeatures({ targetDir: 'src/features' });
        expect(features[0].presets).toEqual(expect.arrayContaining(['TanStack Query', 'Zod']));
    });
});
