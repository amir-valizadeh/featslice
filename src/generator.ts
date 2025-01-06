import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import {
    getNextSliceTemplate,
    getNextLayoutTemplate,
    getNextCommonTemplates
} from './templates/next';
import {
    getReactSliceTemplate,
    getReactLayoutTemplate,
    getReactCommonTemplates
} from './templates/react';
import { getServiceTemplate } from './templates/service';
import {capitalize} from "./utils";

interface FeatureOptions {
    name: string;
    isNextjs: boolean;
    slices: string[];
}

const FEATURE_STRUCTURE = [
    'components',
    'hooks',
    'types',
    'utils',
    'api/services',
    'constants'
] as const;

export async function generateFeature(options: FeatureOptions): Promise<void> {
    const { name, isNextjs, slices } = options;
    const basePath = path.join(process.cwd(), name);

    try {
        // Create base directories
        console.log(chalk.blue('Creating base directories...'));
        await fs.ensureDir(basePath);

        // Create directory structure
        for (const dir of FEATURE_STRUCTURE) {
            const dirPath = path.join(basePath, dir);
            await fs.ensureDir(dirPath);

            // Create index.ts with appropriate template
            await fs.writeFile(
                path.join(dirPath, 'index.ts'),
                isNextjs
                    ? getNextCommonTemplates(dir, name)
                    : getReactCommonTemplates(dir, name)
            );
        }

        // Create service file
        await fs.writeFile(
            path.join(basePath, 'api/services', `${capitalize(name)}.service.ts`),
            getServiceTemplate(name)
        );

        // Create slices with proper template based on project type
        console.log(chalk.blue(`Creating ${isNextjs ? 'Next.js' : 'React'} slices...`));
        for (const slice of slices) {
            const slicePath = path.join(basePath, slice);
            await fs.ensureDir(path.join(slicePath, 'components'));

            const pageFileName = isNextjs ? 'page.tsx' : 'index.tsx';
            await fs.writeFile(
                path.join(slicePath, pageFileName),
                isNextjs
                    ? getNextSliceTemplate(slice)
                    : getReactSliceTemplate(slice)
            );

            // Create components index for the slice
            await fs.writeFile(
                path.join(slicePath, 'components', 'index.ts'),
                `// ${slice} components exports\n`
            );
        }

        // Create layout file with proper template
        await fs.writeFile(
            path.join(basePath, 'layout.tsx'),
            isNextjs
                ? getNextLayoutTemplate()
                : getReactLayoutTemplate()
        );

        console.log(chalk.green(`✔ Created ${isNextjs ? 'Next.js' : 'React'} feature '${name}' with slices: ${slices.join(', ')}`));
    } catch (error) {
        console.error(chalk.red('Error generating feature structure:'), error);
        throw error;
    }
}