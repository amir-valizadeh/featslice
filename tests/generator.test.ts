import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { generateFeature } from '../src/generator';

describe('generateFeature', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-test-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  it('performs dry run without creating files or directories', async () => {
    await generateFeature({
      name: 'auth',
      isNextjs: true,
      slices: ['login', 'register'],
      dryRun: true,
    });

    const exists = await fs.pathExists(path.join(tempDir, 'auth'));
    expect(exists).toBe(false);
  });

  it('generates Next.js feature structure with slices', async () => {
    await generateFeature({
      name: 'auth',
      isNextjs: true,
      slices: ['login', 'register'],
    });

    const basePath = path.join(tempDir, 'auth');
    expect(await fs.pathExists(basePath)).toBe(true);

    // Common directories
    for (const dir of ['components', 'hooks', 'types', 'utils', 'constants']) {
      expect(await fs.pathExists(path.join(basePath, dir, 'index.ts'))).toBe(true);
    }

    // Service file
    expect(await fs.pathExists(path.join(basePath, 'api/services', 'Auth.service.ts'))).toBe(true);

    // Layout
    expect(await fs.pathExists(path.join(basePath, 'layout.tsx'))).toBe(true);

    // Slices
    for (const slice of ['login', 'register']) {
      expect(await fs.pathExists(path.join(basePath, slice, 'page.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(basePath, slice, 'components', 'index.ts'))).toBe(true);
    }
  });

  it('generates React feature structure with index.tsx slices', async () => {
    await generateFeature({
      name: 'dashboard',
      isNextjs: false,
      slices: ['analytics'],
    });

    const basePath = path.join(tempDir, 'dashboard');
    expect(await fs.pathExists(basePath)).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'analytics', 'index.tsx'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'layout.tsx'))).toBe(true);
  });

  it('adds slices to an existing feature without overwriting existing files', async () => {
    // Initial generation
    await generateFeature({
      name: 'auth',
      isNextjs: true,
      slices: ['login'],
    });

    const loginPage = path.join(tempDir, 'auth', 'login', 'page.tsx');
    await fs.writeFile(loginPage, '// custom login implementation');

    // Add another slice
    await generateFeature({
      name: 'auth',
      isNextjs: true,
      slices: ['register'],
    });

    // Existing login page should not be overwritten
    const content = await fs.readFile(loginPage, 'utf-8');
    expect(content).toBe('// custom login implementation');

    // New register slice exists
    expect(await fs.pathExists(path.join(tempDir, 'auth', 'register', 'page.tsx'))).toBe(true);
  });

  it('generates feature into a custom outputDir', async () => {
    await generateFeature({
      name: 'users',
      isNextjs: true,
      slices: ['profile'],
      outputDir: 'src/features',
    });

    const basePath = path.join(tempDir, 'src', 'features', 'users');
    expect(await fs.pathExists(basePath)).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'profile', 'page.tsx'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'components', 'index.ts'))).toBe(true);
  });

  it('performs dry run with custom outputDir without creating directories', async () => {
    await generateFeature({
      name: 'users',
      isNextjs: true,
      slices: ['profile'],
      outputDir: 'src/features',
      dryRun: true,
    });

    const basePath = path.join(tempDir, 'src', 'features', 'users');
    expect(await fs.pathExists(basePath)).toBe(false);
  });

  it('uses outputDir from .featslicerc.json when outputDir is omitted in options', async () => {
    await fs.writeJson(path.join(tempDir, '.featslicerc.json'), {
      outputDir: 'src/modules',
    });

    await generateFeature({
      name: 'billing',
      isNextjs: false,
      slices: ['invoices'],
    });

    const basePath = path.join(tempDir, 'src', 'modules', 'billing');
    expect(await fs.pathExists(basePath)).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'invoices', 'index.tsx'))).toBe(true);
  });

  it('uses custom templates from templateDir specified in configuration', async () => {
    const customTemplateDir = path.join(tempDir, '.featslice', 'templates');
    await fs.ensureDir(customTemplateDir);
    await fs.writeFile(
      path.join(customTemplateDir, 'slice.tsx'),
      '// Custom Slice for {{PascalSlice}} in {{featureName}}\nexport default function {{PascalSlice}}() {}'
    );
    await fs.writeFile(
      path.join(customTemplateDir, 'service.ts'),
      '// Custom Service for {{PascalFeature}}'
    );

    await fs.writeJson(path.join(tempDir, '.featslicerc.json'), {
      templateDir: '.featslice/templates',
    });

    await generateFeature({
      name: 'products',
      isNextjs: true,
      slices: ['catalog'],
    });

    const sliceFile = path.join(tempDir, 'products', 'catalog', 'page.tsx');
    const sliceContent = await fs.readFile(sliceFile, 'utf-8');
    expect(sliceContent).toContain('// Custom Slice for Catalog in products');
    expect(sliceContent).toContain('export default function Catalog() {}');

    const serviceFile = path.join(tempDir, 'products', 'api', 'services', 'Products.service.ts');
    const serviceContent = await fs.readFile(serviceFile, 'utf-8');
    expect(serviceContent).toContain('// Custom Service for Products');
  });

  it('respects custom structure and extensions from config', async () => {
    await fs.writeJson(path.join(tempDir, '.featslicerc.json'), {
      structure: ['components', 'state'],
      extension: 'js',
      jsxExtension: 'jsx',
    });

    await generateFeature({
      name: 'settings',
      isNextjs: false,
      slices: ['profile'],
    });

    const basePath = path.join(tempDir, 'settings');
    expect(await fs.pathExists(path.join(basePath, 'components', 'index.js'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'state', 'index.js'))).toBe(true);
    // api/services should not exist since not in structure
    expect(await fs.pathExists(path.join(basePath, 'api'))).toBe(false);
    // Slice should use .jsx
    expect(await fs.pathExists(path.join(basePath, 'profile', 'index.jsx'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'layout.jsx'))).toBe(true);
  });

  it('generates minimal scaffolding when minimal option is true', async () => {
    await generateFeature({
      name: 'quick',
      isNextjs: true,
      slices: ['feed'],
      minimal: true,
    });

    const basePath = path.join(tempDir, 'quick');
    expect(await fs.pathExists(basePath)).toBe(true);
    // Only components and types should exist
    expect(await fs.pathExists(path.join(basePath, 'components', 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'types', 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'feed', 'page.tsx'))).toBe(true);

    // api/services, constants, hooks, utils, and layout should be skipped
    expect(await fs.pathExists(path.join(basePath, 'api'))).toBe(false);
    expect(await fs.pathExists(path.join(basePath, 'constants'))).toBe(false);
    expect(await fs.pathExists(path.join(basePath, 'hooks'))).toBe(false);
    expect(await fs.pathExists(path.join(basePath, 'utils'))).toBe(false);
    expect(await fs.pathExists(path.join(basePath, 'layout.tsx'))).toBe(false);
  });

  it('skips layout.tsx when noLayout is true', async () => {
    await generateFeature({
      name: 'modal-flow',
      isNextjs: true,
      slices: ['step1'],
      noLayout: true,
    });

    const basePath = path.join(tempDir, 'modal-flow');
    expect(await fs.pathExists(basePath)).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'layout.tsx'))).toBe(false);
    expect(await fs.pathExists(path.join(basePath, 'components', 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'step1', 'page.tsx'))).toBe(true);
  });

  it('skips api/services when noServices is true', async () => {
    await generateFeature({
      name: 'static-content',
      isNextjs: true,
      slices: ['faq'],
      noServices: true,
    });

    const basePath = path.join(tempDir, 'static-content');
    expect(await fs.pathExists(basePath)).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'api', 'services'))).toBe(false);
    expect(await fs.pathExists(path.join(basePath, 'components', 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'layout.tsx'))).toBe(true);
  });

  it('overwrites existing files when force is true', async () => {
    // Generate initial feature
    await generateFeature({
      name: 'auth',
      isNextjs: true,
      slices: ['login'],
    });

    const loginPage = path.join(tempDir, 'auth', 'login', 'page.tsx');
    await fs.writeFile(loginPage, '// custom user implementation');

    // Run without force: existing file remains unchanged
    await generateFeature({
      name: 'auth',
      isNextjs: true,
      slices: ['login'],
      force: false,
    });
    expect(await fs.readFile(loginPage, 'utf-8')).toBe('// custom user implementation');

    // Run with force: file should be overwritten
    await generateFeature({
      name: 'auth',
      isNextjs: true,
      slices: ['login'],
      force: true,
    });
    const overwrittenContent = await fs.readFile(loginPage, 'utf-8');
    expect(overwrittenContent).not.toBe('// custom user implementation');
    expect(overwrittenContent).toContain('export default function LoginPage()');
  });

  it('generates TanStack Query preset scaffolding with --query', async () => {
    await generateFeature({
      name: 'orders',
      isNextjs: true,
      slices: ['list'],
      query: true,
    });

    const basePath = path.join(tempDir, 'orders');
    expect(await fs.pathExists(path.join(basePath, 'api', 'queries', 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'api', 'queries', 'useOrdersQuery.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'hooks', 'useOrdersQuery.ts'))).toBe(true);

    const queryContent = await fs.readFile(path.join(basePath, 'api', 'queries', 'index.ts'), 'utf-8');
    expect(queryContent).toContain('ORDERS_KEYS');
    expect(queryContent).toContain("all: ['orders'] as const");
    expect(queryContent).toContain('useOrdersQuery');
    expect(queryContent).toContain('useCreateOrdersMutation');
  });

  it('generates Next.js Server Actions with --server-actions', async () => {
    await generateFeature({
      name: 'posts',
      isNextjs: true,
      slices: ['editor'],
      serverActions: true,
    });

    const basePath = path.join(tempDir, 'posts');
    const actionFile = path.join(basePath, 'api', 'actions', 'index.ts');
    expect(await fs.pathExists(actionFile)).toBe(true);

    const actionContent = await fs.readFile(actionFile, 'utf-8');
    expect(actionContent).toContain("'use server';");
    expect(actionContent).toContain('export async function getPostsAction');
    expect(actionContent).toContain('export async function createPostsAction');
  });

  it('generates Zustand store boilerplate with --zustand', async () => {
    await generateFeature({
      name: 'cart',
      isNextjs: false,
      slices: ['items'],
      zustand: true,
    });

    const basePath = path.join(tempDir, 'cart');
    expect(await fs.pathExists(path.join(basePath, 'store', 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'store', 'useCartStore.ts'))).toBe(true);

    const storeContent = await fs.readFile(path.join(basePath, 'store', 'index.ts'), 'utf-8');
    expect(storeContent).toContain("import { create } from 'zustand';");
    expect(storeContent).toContain('export interface CartState');
    expect(storeContent).toContain('export const useCartStore = create<CartState>');
  });

  it('generates unit and component tests with --with-tests', async () => {
    await generateFeature({
      name: 'billing',
      isNextjs: true,
      slices: ['invoices', 'receipts'],
      withTests: true,
      serverActions: true,
    });

    const basePath = path.join(tempDir, 'billing');
    // Slice tests
    expect(await fs.pathExists(path.join(basePath, 'invoices', 'invoices.test.tsx'))).toBe(true);
    expect(await fs.pathExists(path.join(basePath, 'receipts', 'receipts.test.tsx'))).toBe(true);

    const sliceTestContent = await fs.readFile(path.join(basePath, 'invoices', 'invoices.test.tsx'), 'utf-8');
    expect(sliceTestContent).toContain("import InvoicesPage from './page';");
    expect(sliceTestContent).toContain("describe('Invoices Component'");

    // Service test
    const serviceTestFile = path.join(basePath, 'api', 'services', 'Billing.service.test.ts');
    expect(await fs.pathExists(serviceTestFile)).toBe(true);
    const serviceTestContent = await fs.readFile(serviceTestFile, 'utf-8');
    expect(serviceTestContent).toContain("describe('BillingService'");

    // Server action test
    const actionTestFile = path.join(basePath, 'api', 'actions', 'index.test.ts');
    expect(await fs.pathExists(actionTestFile)).toBe(true);
    const actionTestContent = await fs.readFile(actionTestFile, 'utf-8');
    expect(actionTestContent).toContain("describe('Billing Server Actions'");
  });
});

