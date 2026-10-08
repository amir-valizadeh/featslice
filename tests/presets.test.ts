import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
    getQueryTemplate,
    getActionsTemplate,
    getZustandTemplate,
    getSliceTestTemplate,
    getServiceTestTemplate,
    getActionTestTemplate,
    resolveQueryTemplate,
    resolveActionsTemplate,
    resolveZustandTemplate,
    resolveSliceTestTemplate,
    resolveServiceTestTemplate,
    resolveActionTestTemplate,
} from '../src/index';

describe('preset templates', () => {
    describe('query template', () => {
        it('generates TanStack Query keys factory and hooks', () => {
            const template = getQueryTemplate('users');
            expect(template).toContain("import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';");
            expect(template).toContain('USERS_KEYS');
            expect(template).toContain("all: ['users'] as const");
            expect(template).toContain("list: () => [...USERS_KEYS.all, 'list'] as const");
            expect(template).toContain("detail: (id: string | number) => [...USERS_KEYS.all, 'detail', id] as const");
            expect(template).toContain('export const useUsersQuery =');
            expect(template).toContain('export const useCreateUsersMutation =');
            expect(template).toContain('queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });');
        });
    });

    describe('actions template', () => {
        it('generates Next.js Server Actions with use server directive', () => {
            const template = getActionsTemplate('billing');
            expect(template).toContain("'use server';");
            expect(template).toContain('export async function getBillingAction(id?: string): Promise<TBillingResponse>');
            expect(template).toContain('export async function createBillingAction(data: IBillingProps): Promise<TBillingResponse>');
            expect(template).toContain('export async function updateBillingAction(');
            expect(template).toContain('export async function deleteBillingAction(id: string): Promise<{ success: boolean }>');
        });
    });

    describe('zustand template', () => {
        it('generates typed Zustand store boilerplate', () => {
            const template = getZustandTemplate('cart');
            expect(template).toContain("import { create } from 'zustand';");
            expect(template).toContain('export interface CartState');
            expect(template).toContain('data: ICartProps | null;');
            expect(template).toContain('isLoading: boolean;');
            expect(template).toContain('error: string | null;');
            expect(template).toContain('export const useCartStore = create<CartState>');
            expect(template).toContain('setData: (data) => set({ data })');
            expect(template).toContain('reset: () => set(initialState)');
        });
    });

    describe('test templates', () => {
        it('generates slice component test template for Next.js', () => {
            const template = getSliceTestTemplate('login', 'auth', true);
            expect(template).toContain("import { render, screen } from '@testing-library/react';");
            expect(template).toContain("import LoginPage from './page';");
            expect(template).toContain("describe('Login Component', () => {");
            expect(template).toContain("expect(screen.getByText('Login')).toBeInTheDocument();");
        });

        it('generates slice component test template for React', () => {
            const template = getSliceTestTemplate('register', 'auth', false);
            expect(template).toContain("import RegisterPage from './index';");
            expect(template).toContain("describe('Register Component', () => {");
        });

        it('generates service test template', () => {
            const template = getServiceTestTemplate('auth');
            expect(template).toContain("import { authService } from './Auth.service';");
            expect(template).toContain("describe('AuthService', () => {");
            expect(template).toContain('fetchAuth returns data or throws');
            expect(template).toContain('createAuth creates data or throws');
            expect(template).toContain('updateAuth updates data or throws');
            expect(template).toContain('deleteAuth deletes data or throws');
        });

        it('generates action test template', () => {
            const template = getActionTestTemplate('users');
            expect(template).toContain('getUsersAction,');
            expect(template).toContain('createUsersAction,');
            expect(template).toContain('updateUsersAction,');
            expect(template).toContain('deleteUsersAction,');
            expect(template).toContain("describe('Users Server Actions', () => {");
        });
    });

    describe('engine resolvers for presets', () => {
        let tempDir: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-presets-test-'));
        });

        afterEach(async () => {
            await fs.remove(tempDir);
        });

        it('resolves query template with custom override in templateDir', async () => {
            await fs.writeFile(
                path.join(tempDir, 'query.ts'),
                '// Custom Query for {{PascalFeature}} - {{upperFeature}}'
            );

            const result = await resolveQueryTemplate({
                templateDir: tempDir,
                featureName: 'products',
            });

            expect(result).toBe('// Custom Query for Products - PRODUCTS');
        });

        it('resolves actions template with custom override in templateDir', async () => {
            await fs.writeFile(
                path.join(tempDir, 'actions.ts'),
                '// Custom Actions for {{PascalFeature}}'
            );

            const result = await resolveActionsTemplate({
                templateDir: tempDir,
                featureName: 'orders',
            });

            expect(result).toBe('// Custom Actions for Orders');
        });

        it('resolves zustand template with custom store.ts override in templateDir', async () => {
            await fs.writeFile(
                path.join(tempDir, 'store.ts'),
                '// Custom Store for {{PascalFeature}}'
            );

            const result = await resolveZustandTemplate({
                templateDir: tempDir,
                featureName: 'notifications',
            });

            expect(result).toBe('// Custom Store for Notifications');
        });

        it('resolves slice test template with custom slice-test.tsx override in templateDir', async () => {
            await fs.writeFile(
                path.join(tempDir, 'slice-test.tsx'),
                '// Custom Slice Test for {{PascalSlice}} in {{featureName}}'
            );

            const result = await resolveSliceTestTemplate({
                templateDir: tempDir,
                isNextjs: true,
                featureName: 'auth',
                sliceName: 'login',
            });

            expect(result).toBe('// Custom Slice Test for Login in auth');
        });

        it('resolves service test template with custom service-test.ts override in templateDir', async () => {
            await fs.writeFile(
                path.join(tempDir, 'service-test.ts'),
                '// Custom Service Test for {{PascalFeature}}'
            );

            const result = await resolveServiceTestTemplate({
                templateDir: tempDir,
                featureName: 'users',
            });

            expect(result).toBe('// Custom Service Test for Users');
        });

        it('resolves action test template with custom actions-test.ts override in templateDir', async () => {
            await fs.writeFile(
                path.join(tempDir, 'actions-test.ts'),
                '// Custom Action Test for {{PascalFeature}}'
            );

            const result = await resolveActionTestTemplate({
                templateDir: tempDir,
                featureName: 'billing',
            });

            expect(result).toBe('// Custom Action Test for Billing');
        });
    });
});
