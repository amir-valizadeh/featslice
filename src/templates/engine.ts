import fs from 'fs-extra';
import path from 'path';
import {
    getNextSliceTemplate,
    getNextLayoutTemplate,
    getNextCommonTemplates,
} from './next';
import {
    getReactSliceTemplate,
    getReactLayoutTemplate,
    getReactCommonTemplates,
} from './react';
import { getServiceTemplate } from './service';
import { getQueryTemplate } from './presets/query';
import { getActionsTemplate } from './presets/actions';
import { getZustandTemplate } from './presets/zustand';
import {
    getSliceTestTemplate,
    getServiceTestTemplate,
    getActionTestTemplate,
} from './presets/test';

export interface TemplateVariables {
    featureName?: string;
    sliceName?: string;
    PascalFeature?: string;
    PascalSlice?: string;
    upperFeature?: string;
    kebabFeature?: string;
    kebabSlice?: string;
    [key: string]: string | undefined;
}

/**
 * Converts a string into PascalCase.
 * Handles kebab-case, snake_case, camelCase, and space-separated strings.
 */
export function toPascalCase(str: string): string {
    if (!str) return '';
    const cleaned = str
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim();
    if (!cleaned) return '';
    return cleaned
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

/**
 * Converts a string into kebab-case.
 */
export function toKebabCase(str: string): string {
    if (!str) return '';
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

/**
 * Builds the standard variables context for template interpolation.
 */
export function buildTemplateVariables(
    featureName: string = '',
    sliceName: string = ''
): TemplateVariables {
    return {
        featureName,
        sliceName,
        PascalFeature: toPascalCase(featureName),
        PascalSlice: toPascalCase(sliceName),
        upperFeature: featureName.toUpperCase(),
        kebabFeature: toKebabCase(featureName),
        kebabSlice: toKebabCase(sliceName),
    };
}

/**
 * Renders a template string by interpolating {{variableName}} placeholders.
 * If featureName or sliceName are passed, any missing derived variables
 * (PascalFeature, PascalSlice, upperFeature, kebabFeature, kebabSlice) are auto-populated.
 */
export function renderTemplate(
    template: string,
    variables: TemplateVariables = {}
): string {
    const vars: TemplateVariables = { ...variables };

    if (vars.featureName !== undefined) {
        if (vars.PascalFeature === undefined) {
            vars.PascalFeature = toPascalCase(vars.featureName);
        }
        if (vars.upperFeature === undefined) {
            vars.upperFeature = vars.featureName.toUpperCase();
        }
        if (vars.kebabFeature === undefined) {
            vars.kebabFeature = toKebabCase(vars.featureName);
        }
    }

    if (vars.sliceName !== undefined) {
        if (vars.PascalSlice === undefined) {
            vars.PascalSlice = toPascalCase(vars.sliceName);
        }
        if (vars.kebabSlice === undefined) {
            vars.kebabSlice = toKebabCase(vars.sliceName);
        }
    }

    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        if (key in vars && vars[key] !== undefined) {
            return vars[key]!;
        }
        return match;
    });
}

/**
 * Looks for the first existing custom template file among candidateNames within templateDir.
 */
export async function findCustomTemplate(
    templateDir: string,
    candidateNames: string[]
): Promise<string | null> {
    for (const candidate of candidateNames) {
        const filePath = path.isAbsolute(candidate)
            ? candidate
            : path.resolve(templateDir, candidate);

        if (await fs.pathExists(filePath)) {
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
                return await fs.readFile(filePath, 'utf-8');
            }
        }
    }
    return null;
}

export interface ResolveSliceOptions {
    templateDir?: string;
    isNextjs: boolean;
    featureName: string;
    sliceName: string;
    jsxExtension?: string;
}

/**
 * Resolves a slice template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveSliceTemplate(options: ResolveSliceOptions): Promise<string> {
    const { templateDir, isNextjs, featureName, sliceName, jsxExtension = 'tsx' } = options;

    if (templateDir) {
        const candidates = isNextjs
            ? [
                  `next-slice.${jsxExtension}`,
                  'next-slice.tsx',
                  'next-slice.jsx',
                  `slice.${jsxExtension}`,
                  'slice.tsx',
                  'slice.jsx',
                  'slice.ts',
              ]
            : [
                  `react-slice.${jsxExtension}`,
                  'react-slice.tsx',
                  'react-slice.jsx',
                  `slice.${jsxExtension}`,
                  'slice.tsx',
                  'slice.jsx',
                  'slice.ts',
              ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName, sliceName);
            return renderTemplate(custom, vars);
        }
    }

    return isNextjs
        ? getNextSliceTemplate(sliceName)
        : getReactSliceTemplate(sliceName);
}

export interface ResolveLayoutOptions {
    templateDir?: string;
    isNextjs: boolean;
    featureName: string;
    jsxExtension?: string;
}

/**
 * Resolves a layout template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveLayoutTemplate(options: ResolveLayoutOptions): Promise<string> {
    const { templateDir, isNextjs, featureName, jsxExtension = 'tsx' } = options;

    if (templateDir) {
        const candidates = isNextjs
            ? [
                  `next-layout.${jsxExtension}`,
                  'next-layout.tsx',
                  'next-layout.jsx',
                  `layout.${jsxExtension}`,
                  'layout.tsx',
                  'layout.jsx',
              ]
            : [
                  `react-layout.${jsxExtension}`,
                  'react-layout.tsx',
                  'react-layout.jsx',
                  `layout.${jsxExtension}`,
                  'layout.tsx',
                  'layout.jsx',
              ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return isNextjs ? getNextLayoutTemplate() : getReactLayoutTemplate();
}

export interface ResolveServiceOptions {
    templateDir?: string;
    featureName: string;
    extension?: string;
}

/**
 * Resolves a service template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveServiceTemplate(options: ResolveServiceOptions): Promise<string> {
    const { templateDir, featureName, extension = 'ts' } = options;

    if (templateDir) {
        const candidates = [
            `service.${extension}`,
            'service.ts',
            'service.js',
            `${toPascalCase(featureName)}.service.${extension}`,
            `${toPascalCase(featureName)}.service.ts`,
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return getServiceTemplate(featureName);
}

export interface ResolveCommonOptions {
    templateDir?: string;
    isNextjs: boolean;
    dirName: string;
    featureName: string;
    extension?: string;
    jsxExtension?: string;
}

/**
 * Resolves a common directory index template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveCommonTemplate(options: ResolveCommonOptions): Promise<string> {
    const {
        templateDir,
        isNextjs,
        dirName,
        featureName,
        extension = 'ts',
        jsxExtension = 'tsx',
    } = options;

    if (templateDir) {
        const cleanName = dirName.replace(/[/\\]+/g, '-');
        const baseName = path.basename(dirName);

        const candidates = [
            `${cleanName}.${extension}`,
            `${cleanName}.ts`,
            `${cleanName}.js`,
            `${baseName}.${extension}`,
            `${baseName}.ts`,
            `${baseName}.js`,
            `${cleanName}.${jsxExtension}`,
            `${cleanName}.tsx`,
            `${baseName}.${jsxExtension}`,
            `${baseName}.tsx`,
            `${dirName}.${extension}`,
            `${dirName}.ts`,
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return isNextjs
        ? getNextCommonTemplates(dirName, featureName)
        : getReactCommonTemplates(dirName, featureName);
}

export interface ResolvePresetOptions {
    templateDir?: string;
    featureName: string;
    extension?: string;
}

export interface ResolveSliceTestOptions {
    templateDir?: string;
    isNextjs: boolean;
    featureName: string;
    sliceName: string;
    jsxExtension?: string;
}

/**
 * Resolves a TanStack Query template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveQueryTemplate(options: ResolvePresetOptions): Promise<string> {
    const { templateDir, featureName, extension = 'ts' } = options;

    if (templateDir) {
        const PascalFeature = toPascalCase(featureName);
        const candidates = [
            `query.${extension}`,
            'query.ts',
            'query.js',
            `use${PascalFeature}Query.${extension}`,
            `use${PascalFeature}Query.ts`,
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return getQueryTemplate(featureName);
}

/**
 * Resolves a Server Actions template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveActionsTemplate(options: ResolvePresetOptions): Promise<string> {
    const { templateDir, featureName, extension = 'ts' } = options;

    if (templateDir) {
        const candidates = [
            `actions.${extension}`,
            'actions.ts',
            'actions.js',
            `server-actions.${extension}`,
            'server-actions.ts',
            'server-actions.js',
            `action.${extension}`,
            'action.ts',
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return getActionsTemplate(featureName);
}

/**
 * Resolves a Zustand store template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveZustandTemplate(options: ResolvePresetOptions): Promise<string> {
    const { templateDir, featureName, extension = 'ts' } = options;

    if (templateDir) {
        const PascalFeature = toPascalCase(featureName);
        const candidates = [
            `store.${extension}`,
            'store.ts',
            'store.js',
            `zustand.${extension}`,
            'zustand.ts',
            'zustand.js',
            `use${PascalFeature}Store.${extension}`,
            `use${PascalFeature}Store.ts`,
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return getZustandTemplate(featureName);
}

/**
 * Resolves a slice component test template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveSliceTestTemplate(options: ResolveSliceTestOptions): Promise<string> {
    const { templateDir, isNextjs, featureName, sliceName, jsxExtension = 'tsx' } = options;

    if (templateDir) {
        const candidates = [
            `slice-test.${jsxExtension}`,
            'slice-test.tsx',
            'slice-test.jsx',
            `slice.test.${jsxExtension}`,
            'slice.test.tsx',
            'slice.test.jsx',
            `test.${jsxExtension}`,
            'test.tsx',
            'test.jsx',
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName, sliceName);
            return renderTemplate(custom, vars);
        }
    }

    return getSliceTestTemplate(sliceName, featureName, isNextjs);
}

/**
 * Resolves a service test template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveServiceTestTemplate(options: ResolvePresetOptions): Promise<string> {
    const { templateDir, featureName, extension = 'ts' } = options;

    if (templateDir) {
        const PascalFeature = toPascalCase(featureName);
        const candidates = [
            `service-test.${extension}`,
            'service-test.ts',
            'service-test.js',
            `service.test.${extension}`,
            'service.test.ts',
            'service.test.js',
            `${PascalFeature}.service.test.${extension}`,
            `${PascalFeature}.service.test.ts`,
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return getServiceTestTemplate(featureName);
}

/**
 * Resolves an action test template, either from custom templateDir or falling back to built-ins.
 */
export async function resolveActionTestTemplate(options: ResolvePresetOptions): Promise<string> {
    const { templateDir, featureName, extension = 'ts' } = options;

    if (templateDir) {
        const candidates = [
            `actions-test.${extension}`,
            'actions-test.ts',
            'actions-test.js',
            `action-test.${extension}`,
            'action-test.ts',
            'action-test.js',
            `actions.test.${extension}`,
            'actions.test.ts',
            `action.test.${extension}`,
            'action.test.ts',
        ];

        const custom = await findCustomTemplate(templateDir, candidates);
        if (custom !== null) {
            const vars = buildTemplateVariables(featureName);
            return renderTemplate(custom, vars);
        }
    }

    return getActionTestTemplate(featureName);
}

