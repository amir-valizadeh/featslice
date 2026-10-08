import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
    loadConfig,
    findConfigFile,
    DEFAULT_CONFIG,
} from '../src/config';
import { initProject } from '../src/init';

describe('config loader & schema', () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-config-test-'));
        process.chdir(tempDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await fs.remove(tempDir);
    });

    describe('loadConfig', () => {
        it('returns default configuration when no config file is found', async () => {
            const config = await loadConfig(tempDir);
            expect(config.templateDir).toBe('.featslice/templates');
            expect(config.extension).toBe('ts');
            expect(config.jsxExtension).toBe('tsx');
            expect(config.outputDir).toBeUndefined();
            expect(config.structure).toBeUndefined();
        });

        it('loads configuration from .featslicerc.json', async () => {
            const configData = {
                outputDir: 'src/features',
                templateDir: 'custom/templates',
                structure: ['components', 'hooks', 'types', 'services'],
                extension: 'ts',
                jsxExtension: 'tsx',
            };
            await fs.writeJson(path.join(tempDir, '.featslicerc.json'), configData);

            const config = await loadConfig(tempDir);
            expect(config.outputDir).toBe('src/features');
            expect(config.templateDir).toBe('custom/templates');
            expect(config.structure).toEqual(['components', 'hooks', 'types', 'services']);
            expect(config.extension).toBe('ts');
            expect(config.jsxExtension).toBe('tsx');
            expect(config.configPath).toBe(path.join(tempDir, '.featslicerc.json'));
        });

        it('loads configuration from .featslicerc.js (CommonJS)', async () => {
            const jsContent = `
module.exports = {
    outputDir: 'src/modules',
    extension: 'js',
    jsxExtension: 'jsx',
    structure: ['components', 'utils']
};
`;
            await fs.writeFile(path.join(tempDir, '.featslicerc.js'), jsContent);

            const config = await loadConfig(tempDir);
            expect(config.outputDir).toBe('src/modules');
            expect(config.extension).toBe('js');
            expect(config.jsxExtension).toBe('jsx');
            expect(config.templateDir).toBe('.featslice/templates'); // Default preserved
            expect(config.structure).toEqual(['components', 'utils']);
        });

        it('loads configuration from .featslicerc.js (ES default export simulation)', async () => {
            const jsContent = `
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    outputDir: 'src/es-features',
    templateDir: 'templates/dir'
};
`;
            await fs.writeFile(path.join(tempDir, '.featslicerc.js'), jsContent);

            const config = await loadConfig(tempDir);
            expect(config.outputDir).toBe('src/es-features');
            expect(config.templateDir).toBe('templates/dir');
        });

        it('loads configuration from featslice.config.json', async () => {
            const configData = {
                outputDir: 'frontend/features',
                structure: ['store', 'views'],
            };
            await fs.writeJson(path.join(tempDir, 'featslice.config.json'), configData);

            const config = await loadConfig(tempDir);
            expect(config.outputDir).toBe('frontend/features');
            expect(config.structure).toEqual(['store', 'views']);
        });

        it('prioritizes .featslicerc.json over featslice.config.json', async () => {
            await fs.writeJson(path.join(tempDir, '.featslicerc.json'), { outputDir: 'from-rc' });
            await fs.writeJson(path.join(tempDir, 'featslice.config.json'), { outputDir: 'from-config' });

            const config = await loadConfig(tempDir);
            expect(config.outputDir).toBe('from-rc');
        });

        it('searches upwards to find config in an ancestor directory', async () => {
            await fs.writeJson(path.join(tempDir, '.featslicerc.json'), {
                outputDir: 'root/features',
            });

            const deepNestedDir = path.join(tempDir, 'nested', 'sub', 'folder');
            await fs.ensureDir(deepNestedDir);

            const config = await loadConfig(deepNestedDir);
            expect(config.outputDir).toBe('root/features');
            expect(config.configPath).toBe(path.join(tempDir, '.featslicerc.json'));
        });

        it('stops searching upwards at project root when package.json is reached', async () => {
            // Root has a config and package.json
            await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'parent-project' });
            await fs.writeJson(path.join(tempDir, '.featslicerc.json'), { outputDir: 'parent/dir' });

            // Sub project with its own package.json but no config file
            const subProjectDir = path.join(tempDir, 'sub-app');
            await fs.ensureDir(subProjectDir);
            await fs.writeJson(path.join(subProjectDir, 'package.json'), { name: 'sub-app' });

            const config = await loadConfig(subProjectDir);
            // It should stop at sub-app's package.json and not find parent's .featslicerc.json
            expect(config.outputDir).toBeUndefined();
        });
    });

    describe('findConfigFile', () => {
        it('returns null if no config file exists', async () => {
            const filePath = await findConfigFile(tempDir);
            expect(filePath).toBeNull();
        });

        it('returns exact path to found config', async () => {
            const targetPath = path.join(tempDir, '.featslicerc.json');
            await fs.writeJson(targetPath, {});
            const found = await findConfigFile(tempDir);
            expect(found).toBe(targetPath);
        });
    });

    describe('initProject', () => {
        it('generates .featslicerc.json with sensible defaults in yes mode', async () => {
            // Create a fake package.json so tempDir is identified as project root
            await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'my-app' });

            const result = await initProject({ cwd: tempDir, yes: true });

            expect(result.configPath).toBe(path.join(tempDir, '.featslicerc.json'));
            expect(await fs.pathExists(result.configPath)).toBe(true);

            const writtenConfig = await fs.readJson(result.configPath);
            expect(writtenConfig.outputDir).toBe('src/features');
            expect(writtenConfig.templateDir).toBe('.featslice/templates');
            expect(writtenConfig.extension).toBe('ts');
            expect(writtenConfig.jsxExtension).toBe('tsx');

            // Sample templates should have been created
            const templateDir = path.join(tempDir, '.featslice/templates');
            expect(await fs.pathExists(templateDir)).toBe(true);
            expect(await fs.pathExists(path.join(templateDir, 'slice.tsx'))).toBe(true);
            expect(await fs.pathExists(path.join(templateDir, 'service.ts'))).toBe(true);
            expect(await fs.pathExists(path.join(templateDir, 'types.ts'))).toBe(true);

            const sliceContent = await fs.readFile(path.join(templateDir, 'slice.tsx'), 'utf-8');
            expect(sliceContent).toContain('{{PascalSlice}}Page');
        });

        it('creates custom configuration and javascript templates when requested', async () => {
            await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'my-app' });

            await initProject({
                cwd: tempDir,
                yes: true,
                outputDir: 'src/modules',
                templateDir: 'custom/tpl',
                extension: 'js',
                jsxExtension: 'jsx',
            });

            const writtenConfig = await fs.readJson(path.join(tempDir, '.featslicerc.json'));
            expect(writtenConfig.outputDir).toBe('src/modules');
            expect(writtenConfig.templateDir).toBe('custom/tpl');
            expect(writtenConfig.extension).toBe('js');
            expect(writtenConfig.jsxExtension).toBe('jsx');

            const templateDir = path.join(tempDir, 'custom/tpl');
            expect(await fs.pathExists(path.join(templateDir, 'slice.jsx'))).toBe(true);
            expect(await fs.pathExists(path.join(templateDir, 'service.js'))).toBe(true);
            expect(await fs.pathExists(path.join(templateDir, 'types.js'))).toBe(true);
        });

        it('does not create sample templates when createTemplates is false', async () => {
            await fs.writeJson(path.join(tempDir, 'package.json'), { name: 'my-app' });

            await initProject({
                cwd: tempDir,
                yes: true,
                createTemplates: false,
            });

            expect(await fs.pathExists(path.join(tempDir, '.featslicerc.json'))).toBe(true);
            expect(await fs.pathExists(path.join(tempDir, '.featslice/templates'))).toBe(false);
        });
    });
});
