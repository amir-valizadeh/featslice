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
    dryRun?: boolean;
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
    const { name, isNextjs, slices, dryRun = false } = options;
    const basePath = path.join(process.cwd(), name);

    try {
        const featureExists = await fs.pathExists(basePath);

        if (!featureExists) {
            if (dryRun) {
                console.log(chalk.yellow(`[DRY RUN] Would create feature directory: ${name}`));
            } else {
                console.log(chalk.blue('Creating base directories...'));
                await fs.ensureDir(basePath);
            }
        } else {
            console.log(chalk.blue(`Feature '${name}' already exists. Adding new slices...`));
        }

        // Create directory structure
        for (const dir of FEATURE_STRUCTURE) {
            const dirPath = path.join(basePath, dir);
            const dirExists = await fs.pathExists(dirPath);

            if (!dirExists) {
                if (dryRun) {
                    console.log(chalk.yellow(`[DRY RUN] Would create directory: ${path.join(name, dir)}`));
                } else {
                    await fs.ensureDir(dirPath);
                }
            }

            const indexPath = path.join(dirPath, 'index.ts');
            const indexExists = await fs.pathExists(indexPath);

            if (!indexExists) {
                if (dryRun) {
                    console.log(chalk.yellow(`[DRY RUN] Would create file: ${path.join(name, dir, 'index.ts')}`));
                } else {
                    await fs.writeFile(
                        indexPath,
                        isNextjs
                            ? getNextCommonTemplates(dir, name)
                            : getReactCommonTemplates(dir, name)
                    );
                }
            }
        }

        // Create service file
        const serviceFileName = `${capitalize(name)}.service.ts`;
        const servicePath = path.join(basePath, 'api/services', serviceFileName);
        const serviceExists = await fs.pathExists(servicePath);

        if (!serviceExists) {
            if (dryRun) {
                console.log(chalk.yellow(`[DRY RUN] Would create file: ${path.join(name, 'api/services', serviceFileName)}`));
            } else {
                await fs.writeFile(servicePath, getServiceTemplate(name));
            }
        }

        // Create slices
        if (slices.length > 0) {
            console.log(chalk.blue(`Creating ${isNextjs ? 'Next.js' : 'React'} slices...`));
            for (const slice of slices) {
                const slicePath = path.join(basePath, slice);
                const sliceExists = await fs.pathExists(slicePath);

                if (sliceExists) {
                    console.log(chalk.yellow(`Slice '${slice}' already exists in feature '${name}'. Skipping...`));
                    continue;
                }

                if (dryRun) {
                    console.log(chalk.yellow(`[DRY RUN] Would create slice directory: ${path.join(name, slice)}`));
                    console.log(chalk.yellow(`[DRY RUN] Would create file: ${path.join(name, slice, isNextjs ? 'page.tsx' : 'index.tsx')}`));
                    console.log(chalk.yellow(`[DRY RUN] Would create directory: ${path.join(name, slice, 'components')}`));
                } else {
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
            }
        }

        // Create layout file
        const layoutPath = path.join(basePath, 'layout.tsx');
        const layoutExists = await fs.pathExists(layoutPath);

        if (!layoutExists) {
            if (dryRun) {
                console.log(chalk.yellow(`[DRY RUN] Would create file: ${path.join(name, 'layout.tsx')}`));
            } else {
                await fs.writeFile(
                    layoutPath,
                    isNextjs
                        ? getNextLayoutTemplate()
                        : getReactLayoutTemplate()
                );
            }
        }

        if (dryRun) {
            console.log(chalk.green('\n✔ Dry run completed. No files were modified.'));
        } else {
            console.log(chalk.green(`✔ Created ${isNextjs ? 'Next.js' : 'React'} feature '${name}' with slices: ${slices.join(', ')}`));
        }
    } catch (error) {
        console.error(chalk.red('Error generating feature structure:'), error);
        throw error;
    }
}