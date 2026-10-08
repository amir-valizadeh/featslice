import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
    renderTemplate,
    toPascalCase,
    toKebabCase,
    buildTemplateVariables,
    resolveSliceTemplate,
    resolveLayoutTemplate,
    resolveServiceTemplate,
    resolveCommonTemplate,
} from '../src/templates/engine';

describe('Template Engine', () => {
    describe('case conversion helpers', () => {
        it('converts various formats to PascalCase correctly', () => {
            expect(toPascalCase('auth')).toBe('Auth');
            expect(toPascalCase('user-profile')).toBe('UserProfile');
            expect(toPascalCase('user_profile')).toBe('UserProfile');
            expect(toPascalCase('userProfile')).toBe('UserProfile');
            expect(toPascalCase('UserProfile')).toBe('UserProfile');
            expect(toPascalCase('order-details-card')).toBe('OrderDetailsCard');
            expect(toPascalCase('')).toBe('');
        });

        it('converts various formats to kebab-case correctly', () => {
            expect(toKebabCase('auth')).toBe('auth');
            expect(toKebabCase('UserProfile')).toBe('user-profile');
            expect(toKebabCase('userProfile')).toBe('user-profile');
            expect(toKebabCase('user-profile')).toBe('user-profile');
            expect(toKebabCase('user_profile')).toBe('user-profile');
            expect(toKebabCase('')).toBe('');
        });
    });

    describe('renderTemplate', () => {
        it('interpolates all 7 standard template variables', () => {
            const template = [
                'feature: {{featureName}}',
                'slice: {{sliceName}}',
                'PascalFeature: {{PascalFeature}}',
                'PascalSlice: {{PascalSlice}}',
                'upperFeature: {{upperFeature}}',
                'kebabFeature: {{kebabFeature}}',
                'kebabSlice: {{kebabSlice}}',
            ].join('\n');

            const result = renderTemplate(template, {
                featureName: 'userProfile',
                sliceName: 'editDetails',
            });

            expect(result).toBe([
                'feature: userProfile',
                'slice: editDetails',
                'PascalFeature: UserProfile',
                'PascalSlice: EditDetails',
                'upperFeature: USERPROFILE',
                'kebabFeature: user-profile',
                'kebabSlice: edit-details',
            ].join('\n'));
        });

        it('handles spaces inside variable delimiters {{  variable  }}', () => {
            const template = '<div>{{  featureName  }} - {{ PascalSlice }}</div>';
            const result = renderTemplate(template, {
                featureName: 'billing',
                sliceName: 'invoice',
            });

            expect(result).toBe('<div>billing - Invoice</div>');
        });

        it('leaves untouched any unknown placeholders', () => {
            const template = 'Hello {{featureName}}, your {{unknownVar}} is ready.';
            const result = renderTemplate(template, { featureName: 'dashboard' });
            expect(result).toBe('Hello dashboard, your {{unknownVar}} is ready.');
        });

        it('allows explicit overrides for variables', () => {
            const template = '{{featureName}} {{PascalFeature}}';
            const result = renderTemplate(template, {
                featureName: 'auth',
                PascalFeature: 'CustomAuth',
            });
            expect(result).toBe('auth CustomAuth');
        });
    });

    describe('buildTemplateVariables', () => {
        it('constructs a full dictionary of variables', () => {
            const vars = buildTemplateVariables('shopping-cart', 'checkout-step');
            expect(vars).toEqual({
                featureName: 'shopping-cart',
                sliceName: 'checkout-step',
                PascalFeature: 'ShoppingCart',
                PascalSlice: 'CheckoutStep',
                upperFeature: 'SHOPPING-CART',
                kebabFeature: 'shopping-cart',
                kebabSlice: 'checkout-step',
            });
        });
    });

    describe('custom template resolution & fallback', () => {
        let tempDir: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-engine-test-'));
        });

        afterEach(async () => {
            await fs.remove(tempDir);
        });

        describe('resolveSliceTemplate', () => {
            it('falls back to built-in Next.js slice template when no custom template exists', async () => {
                const content = await resolveSliceTemplate({
                    templateDir: tempDir,
                    isNextjs: true,
                    featureName: 'auth',
                    sliceName: 'login',
                });
                expect(content).toContain('export default function LoginPage()');
            });

            it('falls back to built-in React slice template when no custom template exists', async () => {
                const content = await resolveSliceTemplate({
                    templateDir: tempDir,
                    isNextjs: false,
                    featureName: 'auth',
                    sliceName: 'login',
                });
                expect(content).toContain('function LoginPage()');
                expect(content).toContain('export default LoginPage;');
            });

            it('uses custom slice.tsx from templateDir when present', async () => {
                const customTemplate = `
// Custom Slice: {{featureName}} / {{sliceName}}
export const {{PascalSlice}}Component = () => <div>{{PascalFeature}}</div>;
`;
                await fs.writeFile(path.join(tempDir, 'slice.tsx'), customTemplate);

                const content = await resolveSliceTemplate({
                    templateDir: tempDir,
                    isNextjs: true,
                    featureName: 'orders',
                    sliceName: 'history',
                });

                expect(content).toContain('// Custom Slice: orders / history');
                expect(content).toContain('export const HistoryComponent = () => <div>Orders</div>;');
            });

            it('prioritizes next-slice.tsx over generic slice.tsx for Next.js', async () => {
                await fs.writeFile(path.join(tempDir, 'slice.tsx'), '// Generic slice');
                await fs.writeFile(path.join(tempDir, 'next-slice.tsx'), '// Next-specific: {{PascalSlice}}');

                const content = await resolveSliceTemplate({
                    templateDir: tempDir,
                    isNextjs: true,
                    featureName: 'orders',
                    sliceName: 'tracking',
                });

                expect(content).toContain('// Next-specific: Tracking');
            });

            it('prioritizes react-slice.tsx over generic slice.tsx for React', async () => {
                await fs.writeFile(path.join(tempDir, 'slice.tsx'), '// Generic slice');
                await fs.writeFile(path.join(tempDir, 'react-slice.tsx'), '// React-specific: {{PascalSlice}}');

                const content = await resolveSliceTemplate({
                    templateDir: tempDir,
                    isNextjs: false,
                    featureName: 'orders',
                    sliceName: 'tracking',
                });

                expect(content).toContain('// React-specific: Tracking');
            });
        });

        describe('resolveLayoutTemplate', () => {
            it('falls back to built-in Next layout template when no custom template exists', async () => {
                const content = await resolveLayoutTemplate({
                    templateDir: tempDir,
                    isNextjs: true,
                    featureName: 'auth',
                });
                expect(content).toContain('export default function Layout');
            });

            it('uses custom layout.tsx from templateDir when present', async () => {
                await fs.writeFile(
                    path.join(tempDir, 'layout.tsx'),
                    '// Custom layout for {{PascalFeature}}\nexport default function Layout() {}'
                );

                const content = await resolveLayoutTemplate({
                    templateDir: tempDir,
                    isNextjs: false,
                    featureName: 'billing',
                });

                expect(content).toContain('// Custom layout for Billing');
            });
        });

        describe('resolveServiceTemplate', () => {
            it('falls back to built-in service template when no custom template exists', async () => {
                const content = await resolveServiceTemplate({
                    templateDir: tempDir,
                    featureName: 'users',
                });
                expect(content).toContain('export const usersService = {');
                expect(content).toContain('fetchUsers: async ()');
            });

            it('uses custom service.ts from templateDir when present', async () => {
                const customService = `
// Service for {{upperFeature}} ({{kebabFeature}})
export class {{PascalFeature}}ApiClient {}
`;
                await fs.writeFile(path.join(tempDir, 'service.ts'), customService);

                const content = await resolveServiceTemplate({
                    templateDir: tempDir,
                    featureName: 'user-profile',
                });

                expect(content).toContain('// Service for USER-PROFILE (user-profile)');
                expect(content).toContain('export class UserProfileApiClient {}');
            });
        });

        describe('resolveCommonTemplate', () => {
            it('falls back to built-in Next common templates when custom file does not exist', async () => {
                const content = await resolveCommonTemplate({
                    templateDir: tempDir,
                    isNextjs: true,
                    dirName: 'types',
                    featureName: 'auth',
                });
                expect(content).toContain('export interface IAuthProps');
            });

            it('uses custom types.ts from templateDir when present', async () => {
                const customTypes = `
// Custom types for {{PascalFeature}}
export type {{PascalFeature}}Model = { id: string; name: string };
`;
                await fs.writeFile(path.join(tempDir, 'types.ts'), customTypes);

                const content = await resolveCommonTemplate({
                    templateDir: tempDir,
                    isNextjs: true,
                    dirName: 'types',
                    featureName: 'auth',
                });

                expect(content).toContain('// Custom types for Auth');
                expect(content).toContain('export type AuthModel = { id: string; name: string };');
            });

            it('uses custom hooks.ts from templateDir when present', async () => {
                await fs.writeFile(
                    path.join(tempDir, 'hooks.ts'),
                    'export const use{{PascalFeature}}Custom = () => null;'
                );

                const content = await resolveCommonTemplate({
                    templateDir: tempDir,
                    isNextjs: true,
                    dirName: 'hooks',
                    featureName: 'auth',
                });

                expect(content).toContain('export const useAuthCustom = () => null;');
            });
        });
    });
});
