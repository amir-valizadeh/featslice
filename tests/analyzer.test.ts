import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
    generateFeature,
    extractImportSpecifiers,
    analyzeArchitecture,
    generateDependencyGraph,
    detectCycles,
} from '../src/index';

describe('Architecture Analyzer & Dependency Graph', () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-analyzer-test-'));
        process.chdir(tempDir);
        await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'test-app' });
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await fs.remove(tempDir);
    });

    describe('extractImportSpecifiers', () => {
        it('extracts static, re-export, dynamic, and require imports while ignoring comments', () => {
            const code = `
                // import { ignored } from './commented';
                /* export * from './block-commented'; */
                import React from 'react';
                import type { User } from '../auth';
                export { helper } from './utils';
                const mod = await import('../billing/internal');
                const cfg = require('./config');
            `;

            const refs = extractImportSpecifiers(code);
            expect(refs.map((r) => r.specifier)).toEqual([
                'react',
                '../auth',
                './utils',
                '../billing/internal',
                './config',
            ]);
        });
    });

    describe('detectCycles', () => {
        it('detects elementary cycles in a directed graph', () => {
            const cycles = detectCycles({
                auth: ['users'],
                users: ['billing'],
                billing: ['auth'],
                isolated: [],
            });
            expect(cycles).toEqual([['auth', 'users', 'billing', 'auth']]);
        });
    });

    describe('analyzeArchitecture (check)', () => {
        it('passes cleanly when cross-feature imports go through Public API barrel', async () => {
            await generateFeature({
                name: 'auth',
                isNextjs: true,
                slices: ['login'],
                outputDir: 'src/features',
            });
            await generateFeature({
                name: 'cart',
                isNextjs: true,
                slices: ['checkout'],
                outputDir: 'src/features',
            });

            await fs.writeFile(
                path.join(tempDir, 'src/features/cart/checkout/page.tsx'),
                `import { useAuth } from '../../auth';\nexport default function Checkout() { return null; }\n`
            );

            const analysis = await analyzeArchitecture({ targetDir: 'src/features' });
            expect(analysis.violations).toHaveLength(0);
            expect(analysis.graph.cart).toEqual(['auth']);
            expect(analysis.cycles).toHaveLength(0);
        });

        it('flags deep cross-feature imports via relative paths and tsconfig aliases', async () => {
            await fs.writeJson(path.join(tempDir, 'tsconfig.json'), {
                compilerOptions: {
                    baseUrl: '.',
                    paths: {
                        '@/*': ['src/*'],
                    },
                },
            });

            await generateFeature({
                name: 'auth',
                isNextjs: true,
                slices: ['login'],
                outputDir: 'src/features',
            });
            await generateFeature({
                name: 'cart',
                isNextjs: true,
                slices: ['checkout'],
                outputDir: 'src/features',
            });

            await fs.writeFile(
                path.join(tempDir, 'src/features/cart/checkout/page.tsx'),
                [
                    `import LoginPage from '../../auth/login/page';`,
                    `import { authService } from '@/features/auth/api/services/Auth.service';`,
                ].join('\n')
            );

            const analysis = await analyzeArchitecture({ targetDir: 'src/features' });
            const deepViolations = analysis.violations.filter((v) => v.rule === 'deep-import');
            expect(deepViolations).toHaveLength(2);
            expect(deepViolations[0].severity).toBe('error');
        });

        it('detects circular dependencies between features', async () => {
            await generateFeature({
                name: 'auth',
                isNextjs: true,
                slices: ['login'],
                outputDir: 'src/features',
            });
            await generateFeature({
                name: 'users',
                isNextjs: true,
                slices: ['profile'],
                outputDir: 'src/features',
            });

            await fs.writeFile(
                path.join(tempDir, 'src/features/auth/hooks/index.ts'),
                `import { useUsers } from '../../users';\nexport const useAuth = () => useUsers;\n`
            );
            await fs.writeFile(
                path.join(tempDir, 'src/features/users/hooks/index.ts'),
                `import { useAuth } from '../../auth';\nexport const useUsers = () => useAuth;\n`
            );

            const analysis = await analyzeArchitecture({ targetDir: 'src/features' });
            expect(analysis.cycles).toEqual([['auth', 'users', 'auth']]);
            expect(analysis.violations.some((v) => v.rule === 'circular-dependency')).toBe(true);
        });

        it('warns on missing Public API barrel and auto-fixes with --fix', async () => {
            await generateFeature({
                name: 'orders',
                isNextjs: true,
                slices: ['list'],
                outputDir: 'src/features',
                noBarrel: true,
            });

            const before = await analyzeArchitecture({ targetDir: 'src/features' });
            expect(before.violations.some((v) => v.rule === 'missing-public-api')).toBe(true);

            const fixed = await analyzeArchitecture({ targetDir: 'src/features', fix: true });
            expect(fixed.fixedFiles).toHaveLength(1);
            expect(await fs.pathExists(path.join(tempDir, 'src/features/orders/index.ts'))).toBe(true);

            const after = await analyzeArchitecture({ targetDir: 'src/features' });
            expect(after.violations).toHaveLength(0);
        });

        it('enforces custom boundary rules from .featslicerc.json', async () => {
            await fs.writeJson(path.join(tempDir, '.featslicerc.json'), {
                outputDir: 'src/features',
                boundaries: {
                    deny: {
                        billing: ['cart'],
                    },
                },
            });

            await generateFeature({ name: 'cart', isNextjs: true, slices: ['view'] });
            await generateFeature({ name: 'billing', isNextjs: true, slices: ['invoices'] });

            await fs.writeFile(
                path.join(tempDir, 'src/features/billing/invoices/page.tsx'),
                `import * as cart from '../../cart';\nexport default function Invoices() { return cart; }\n`
            );

            const analysis = await analyzeArchitecture();
            expect(analysis.violations.some((v) => v.rule === 'forbidden-boundary')).toBe(true);
        });
    });

    describe('generateDependencyGraph', () => {
        it('outputs Mermaid, ASCII, and JSON graphs and writes markdown file', async () => {
            await generateFeature({
                name: 'auth',
                isNextjs: true,
                slices: ['login'],
                outputDir: 'src/features',
            });
            await generateFeature({
                name: 'users',
                isNextjs: true,
                slices: ['list'],
                outputDir: 'src/features',
            });

            await fs.writeFile(
                path.join(tempDir, 'src/features/users/list/page.tsx'),
                `import * as auth from '../../auth';\nexport default function List() { return auth; }\n`
            );

            const { output: mermaid } = await generateDependencyGraph({
                targetDir: 'src/features',
                format: 'mermaid',
                outFile: 'docs/deps.md',
            });
            expect(mermaid).toContain('flowchart LR');
            expect(mermaid).toContain('users --> auth');

            const mdContent = await fs.readFile(path.join(tempDir, 'docs/deps.md'), 'utf-8');
            expect(mdContent).toContain('```mermaid');

            const { output: ascii } = await generateDependencyGraph({
                targetDir: 'src/features',
                format: 'ascii',
            });
            expect(ascii).toContain('users');
            expect(ascii).toContain('auth');

            const { output: json } = await generateDependencyGraph({
                targetDir: 'src/features',
                format: 'json',
            });
            const parsed = JSON.parse(json);
            expect(parsed.edges.users).toEqual(['auth']);
        });
    });
});
