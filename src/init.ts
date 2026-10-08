import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { findRootDir, detectFeatureDir } from './utils';
import { FeatsliceConfig, DEFAULT_CONFIG } from './config';

export interface InitProjectOptions {
    cwd?: string;
    yes?: boolean;
    outputDir?: string;
    templateDir?: string;
    extension?: 'ts' | 'js';
    jsxExtension?: 'tsx' | 'jsx';
    createTemplates?: boolean;
}

export const SAMPLE_TEMPLATES: Record<string, string> = {
    'slice.tsx': `import React from 'react';

export default function {{PascalSlice}}Page() {
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">{{PascalSlice}}</h1>
            <p className="text-gray-600">Feature: {{featureName}}</p>
        </div>
    );
}
`,
    'service.ts': `import type { 
    T{{PascalFeature}}Response, 
    I{{PascalFeature}}Props 
} from '../../types';

/**
 * Service for handling {{featureName}} operations
 */
export const {{featureName}}Service = {
    fetch{{PascalFeature}}: async (): Promise<T{{PascalFeature}}Response> => {
        throw new Error('Not implemented');
    },

    create{{PascalFeature}}: async (data: I{{PascalFeature}}Props): Promise<T{{PascalFeature}}Response> => {
        throw new Error('Not implemented');
    },

    update{{PascalFeature}}: async (id: string, data: Partial<I{{PascalFeature}}Props>): Promise<T{{PascalFeature}}Response> => {
        throw new Error('Not implemented');
    },

    delete{{PascalFeature}}: async (id: string): Promise<void> => {
        throw new Error('Not implemented');
    }
};
`,
    'types.ts': `export interface I{{PascalFeature}}Props {
    // Props for {{featureName}}
}

export interface I{{PascalFeature}}State {
    // State for {{featureName}}
}

export type T{{PascalFeature}}Response = {
    // Response type for {{featureName}}
};
`,
};

export async function initProject(options: InitProjectOptions = {}): Promise<{
    configPath: string;
    templateDir?: string;
    config: FeatsliceConfig;
}> {
    const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    const projectRoot = (await findRootDir(cwd)) || cwd;
    const configPath = path.join(projectRoot, '.featslicerc.json');

    let outputDir = options.outputDir;
    let templateDir = options.templateDir || DEFAULT_CONFIG.templateDir || '.featslice/templates';
    let extension = options.extension || DEFAULT_CONFIG.extension || 'ts';
    let jsxExtension = options.jsxExtension || DEFAULT_CONFIG.jsxExtension || 'tsx';
    let createTemplates = options.createTemplates !== false;

    // Interactive prompt if not in non-interactive/yes mode
    if (!options.yes && process.stdin.isTTY) {
        const detectedDir = await detectFeatureDir(projectRoot);
        const defaultOutput = detectedDir !== '.' ? detectedDir : 'src/features';

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'outputDir',
                message: 'Default output directory for features:',
                default: outputDir || defaultOutput,
            },
            {
                type: 'input',
                name: 'templateDir',
                message: 'Directory for custom templates:',
                default: templateDir,
            },
            {
                type: 'list',
                name: 'language',
                message: 'Project language flavor:',
                choices: [
                    { name: 'TypeScript (ts/tsx)', value: 'ts' },
                    { name: 'JavaScript (js/jsx)', value: 'js' },
                ],
                default: extension === 'js' ? 'js' : 'ts',
            },
            {
                type: 'confirm',
                name: 'createTemplates',
                message: 'Create sample custom templates in templates directory?',
                default: createTemplates,
            },
        ]);

        outputDir = answers.outputDir;
        templateDir = answers.templateDir;
        extension = answers.language as 'ts' | 'js';
        jsxExtension = extension === 'ts' ? 'tsx' : 'jsx';
        createTemplates = answers.createTemplates;
    } else {
        if (!outputDir) {
            const detectedDir = await detectFeatureDir(projectRoot);
            outputDir = detectedDir !== '.' ? detectedDir : 'src/features';
        }
    }

    const config: FeatsliceConfig = {
        outputDir,
        templateDir,
        extension,
        jsxExtension,
    };

    await fs.writeJson(configPath, config, { spaces: 2 });
    console.log(chalk.green(`✔ Created .featslicerc.json at ${path.relative(cwd, configPath) || '.featslicerc.json'}`));

    let resolvedTemplateDir: string | undefined;
    if (createTemplates) {
        resolvedTemplateDir = path.resolve(projectRoot, templateDir);
        await fs.ensureDir(resolvedTemplateDir);

        for (const [templateName, content] of Object.entries(SAMPLE_TEMPLATES)) {
            // Adjust extensions if JavaScript
            let targetName = templateName;
            if (extension === 'js') {
                targetName = templateName.replace(/\.tsx$/, '.jsx').replace(/\.ts$/, '.js');
            }
            const filePath = path.join(resolvedTemplateDir, targetName);
            if (!(await fs.pathExists(filePath))) {
                await fs.writeFile(filePath, content);
            }
        }

        console.log(
            chalk.green(
                `✔ Created sample templates in ${
                    path.relative(cwd, resolvedTemplateDir) || templateDir
                }`
            )
        );
    }

    return {
        configPath,
        templateDir: resolvedTemplateDir,
        config,
    };
}
