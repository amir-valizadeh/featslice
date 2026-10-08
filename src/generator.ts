import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import {
    resolveSliceTemplate,
    resolveLayoutTemplate,
    resolveServiceTemplate,
    resolveCommonTemplate,
    resolveQueryTemplate,
    resolveActionsTemplate,
    resolveZustandTemplate,
    resolveSliceTestTemplate,
    resolveServiceTestTemplate,
    resolveActionTestTemplate,
} from './templates/engine';
import { capitalize } from './utils';
import { loadConfig, FeatsliceConfig } from './config';

export interface FeatureOptions {
    name: string;
    isNextjs: boolean;
    slices: string[];
    outputDir?: string;
    dryRun?: boolean;
    config?: FeatsliceConfig;
    query?: boolean;
    serverActions?: boolean;
    zustand?: boolean;
    minimal?: boolean;
    withTests?: boolean;
    noLayout?: boolean;
    layout?: boolean;
    noServices?: boolean;
    services?: boolean;
    force?: boolean;
}

const FEATURE_STRUCTURE = [
    'components',
    'hooks',
    'types',
    'utils',
    'api/services',
    'constants',
] as const;

export async function generateFeature(options: FeatureOptions): Promise<void> {
    const { name, isNextjs, slices, dryRun = false } = options;
    const config = options.config || (await loadConfig());

    const effectiveOutputDir = options.outputDir ?? config.outputDir;
    const targetDir = effectiveOutputDir
        ? path.resolve(process.cwd(), effectiveOutputDir)
        : process.cwd();
    const basePath = path.join(targetDir, name);
    const displayFeaturePath = path.relative(process.cwd(), basePath) || name;

    const minimal = options.minimal ?? false;
    const skipLayout = minimal || options.noLayout === true || options.layout === false;
    const skipServices = minimal || options.noServices === true || options.services === false;
    const force = options.force ?? false;
    const withTests = options.withTests ?? false;
    const query = options.query ?? false;
    const serverActions = options.serverActions ?? false;
    const zustand = options.zustand ?? false;

    let structure: readonly string[];
    if (minimal) {
        structure = ['components', 'types'];
    } else {
        const baseStructure =
            config.structure && config.structure.length > 0
                ? config.structure
                : FEATURE_STRUCTURE;
        structure = skipServices
            ? baseStructure.filter((dir) => dir !== 'api/services')
            : baseStructure;
    }

    const extension = config.extension || 'ts';
    const jsxExtension = config.jsxExtension || 'tsx';
    const templateDir = config.templateDir
        ? path.resolve(process.cwd(), config.templateDir)
        : undefined;

    try {
        const featureExists = await fs.pathExists(basePath);

        if (!featureExists) {
            if (dryRun) {
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create feature directory: ${displayFeaturePath}`
                    )
                );
            } else {
                console.log(chalk.blue('Creating base directories...'));
                await fs.ensureDir(basePath);
            }
        } else {
            console.log(
                chalk.blue(
                    `Feature '${name}' already exists. Adding new slices...`
                )
            );
        }

        // Create directory structure
        for (const dir of structure) {
            const dirPath = path.join(basePath, dir);
            const dirExists = await fs.pathExists(dirPath);

            if (!dirExists) {
                if (dryRun) {
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create directory: ${path.join(
                                displayFeaturePath,
                                dir
                            )}`
                        )
                    );
                } else {
                    await fs.ensureDir(dirPath);
                }
            }

            const indexFileName = `index.${extension}`;
            const indexPath = path.join(dirPath, indexFileName);
            const indexExists = await fs.pathExists(indexPath);

            if (!indexExists || force) {
                if (dryRun) {
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create file: ${path.join(
                                displayFeaturePath,
                                dir,
                                indexFileName
                            )}`
                        )
                    );
                } else {
                    const content = await resolveCommonTemplate({
                        templateDir,
                        isNextjs,
                        dirName: dir,
                        featureName: name,
                        extension,
                        jsxExtension,
                    });
                    await fs.writeFile(indexPath, content);
                }
            }
        }

        // Create service file if api/services directory is included
        const hasServices = !skipServices && structure.some((dir) => dir === 'api/services');
        if (hasServices) {
            const serviceFileName = `${capitalize(name)}.service.${extension}`;
            const servicePath = path.join(
                basePath,
                'api/services',
                serviceFileName
            );
            const serviceExists = await fs.pathExists(servicePath);

            if (!serviceExists || force) {
                if (dryRun) {
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create file: ${path.join(
                                displayFeaturePath,
                                'api/services',
                                serviceFileName
                            )}`
                        )
                    );
                } else {
                    const content = await resolveServiceTemplate({
                        templateDir,
                        featureName: name,
                        extension,
                    });
                    await fs.writeFile(servicePath, content);
                }
            }

            // Test scaffolding for service
            if (withTests) {
                const serviceTestFileName = `${capitalize(name)}.service.test.${extension}`;
                const serviceTestPath = path.join(
                    basePath,
                    'api/services',
                    serviceTestFileName
                );
                const serviceTestExists = await fs.pathExists(serviceTestPath);

                if (!serviceTestExists || force) {
                    if (dryRun) {
                        console.log(
                            chalk.yellow(
                                `[DRY RUN] Would create file: ${path.join(
                                    displayFeaturePath,
                                    'api/services',
                                    serviceTestFileName
                                )}`
                            )
                        );
                    } else {
                        const testContent = await resolveServiceTestTemplate({
                            templateDir,
                            featureName: name,
                            extension,
                        });
                        await fs.writeFile(serviceTestPath, testContent);
                    }
                }
            }
        }

        // Create Server Actions if requested
        if (serverActions) {
            const actionsDir = path.join(basePath, 'api', 'actions');
            const actionsFileName = `index.${extension}`;
            const actionsPath = path.join(actionsDir, actionsFileName);
            const actionsExists = await fs.pathExists(actionsPath);

            if (dryRun) {
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create directory: ${path.join(
                            displayFeaturePath,
                            'api/actions'
                        )}`
                    )
                );
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create file: ${path.join(
                            displayFeaturePath,
                            'api/actions',
                            actionsFileName
                        )}`
                    )
                );
            } else {
                await fs.ensureDir(actionsDir);
                if (!actionsExists || force) {
                    const content = await resolveActionsTemplate({
                        templateDir,
                        featureName: name,
                        extension,
                    });
                    await fs.writeFile(actionsPath, content);
                }
            }

            if (withTests) {
                const actionTestFileName = `index.test.${extension}`;
                const actionTestPath = path.join(actionsDir, actionTestFileName);
                const actionTestExists = await fs.pathExists(actionTestPath);

                if (dryRun) {
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create file: ${path.join(
                                displayFeaturePath,
                                'api/actions',
                                actionTestFileName
                            )}`
                        )
                    );
                } else {
                    if (!actionTestExists || force) {
                        const testContent = await resolveActionTestTemplate({
                            templateDir,
                            featureName: name,
                            extension,
                        });
                        await fs.writeFile(actionTestPath, testContent);
                    }
                }
            }
        }

        // Create Zustand store if requested
        if (zustand) {
            const storeDir = path.join(basePath, 'store');
            const storeIndexName = `index.${extension}`;
            const storeHookName = `use${capitalize(name)}Store.${extension}`;
            const storeIndexPath = path.join(storeDir, storeIndexName);
            const storeHookPath = path.join(storeDir, storeHookName);

            if (dryRun) {
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create directory: ${path.join(
                            displayFeaturePath,
                            'store'
                        )}`
                    )
                );
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create file: ${path.join(
                            displayFeaturePath,
                            'store',
                            storeIndexName
                        )}`
                    )
                );
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create file: ${path.join(
                            displayFeaturePath,
                            'store',
                            storeHookName
                        )}`
                    )
                );
            } else {
                await fs.ensureDir(storeDir);
                const content = await resolveZustandTemplate({
                    templateDir,
                    featureName: name,
                    extension,
                });
                const storeIndexExists = await fs.pathExists(storeIndexPath);
                if (!storeIndexExists || force) {
                    await fs.writeFile(storeIndexPath, content);
                }
                const storeHookExists = await fs.pathExists(storeHookPath);
                if (!storeHookExists || force) {
                    await fs.writeFile(storeHookPath, content);
                }
            }
        }

        // Create TanStack Query hooks and keys if requested
        if (query) {
            const queriesDir = path.join(basePath, 'api', 'queries');
            const queryIndexName = `index.${extension}`;
            const queryHookName = `use${capitalize(name)}Query.${extension}`;
            const queryIndexPath = path.join(queriesDir, queryIndexName);
            const queryHookPath = path.join(queriesDir, queryHookName);

            if (dryRun) {
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create directory: ${path.join(
                            displayFeaturePath,
                            'api/queries'
                        )}`
                    )
                );
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create file: ${path.join(
                            displayFeaturePath,
                            'api/queries',
                            queryIndexName
                        )}`
                    )
                );
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would create file: ${path.join(
                            displayFeaturePath,
                            'api/queries',
                            queryHookName
                        )}`
                    )
                );
            } else {
                await fs.ensureDir(queriesDir);
                const content = await resolveQueryTemplate({
                    templateDir,
                    featureName: name,
                    extension,
                });
                const queryIndexExists = await fs.pathExists(queryIndexPath);
                if (!queryIndexExists || force) {
                    await fs.writeFile(queryIndexPath, content);
                }
                const queryHookExists = await fs.pathExists(queryHookPath);
                if (!queryHookExists || force) {
                    await fs.writeFile(queryHookPath, content);
                }

                // If hooks directory exists, also provide hook in hooks/
                const hooksDir = path.join(basePath, 'hooks');
                if (await fs.pathExists(hooksDir)) {
                    const inHooksPath = path.join(hooksDir, queryHookName);
                    const inHooksExists = await fs.pathExists(inHooksPath);
                    if (!inHooksExists || force) {
                        await fs.writeFile(inHooksPath, content);
                    }
                }
            }
        }

        // Create slices
        if (slices.length > 0) {
            console.log(
                chalk.blue(
                    `Creating ${isNextjs ? 'Next.js' : 'React'} slices...`
                )
            );
            for (const slice of slices) {
                const slicePath = path.join(basePath, slice);
                const sliceExists = await fs.pathExists(slicePath);

                if (sliceExists && !force) {
                    console.log(
                        chalk.yellow(
                            `Slice '${slice}' already exists in feature '${name}'. Skipping...`
                        )
                    );
                    continue;
                }

                const pageFileName = isNextjs
                    ? `page.${jsxExtension}`
                    : `index.${jsxExtension}`;

                if (dryRun) {
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create slice directory: ${path.join(
                                displayFeaturePath,
                                slice
                            )}`
                        )
                    );
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create file: ${path.join(
                                displayFeaturePath,
                                slice,
                                pageFileName
                            )}`
                        )
                    );
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create directory: ${path.join(
                                displayFeaturePath,
                                slice,
                                'components'
                            )}`
                        )
                    );
                    if (withTests) {
                        console.log(
                            chalk.yellow(
                                `[DRY RUN] Would create file: ${path.join(
                                    displayFeaturePath,
                                    slice,
                                    `${slice}.test.${jsxExtension}`
                                )}`
                            )
                        );
                    }
                } else {
                    await fs.ensureDir(path.join(slicePath, 'components'));

                    const content = await resolveSliceTemplate({
                        templateDir,
                        isNextjs,
                        featureName: name,
                        sliceName: slice,
                        jsxExtension,
                    });
                    await fs.writeFile(
                        path.join(slicePath, pageFileName),
                        content
                    );

                    // Create components index for the slice
                    await fs.writeFile(
                        path.join(
                            slicePath,
                            'components',
                            `index.${extension}`
                        ),
                        `// ${slice} components exports\n`
                    );

                    // Unit test for slice
                    if (withTests) {
                        const sliceTestFileName = `${slice}.test.${jsxExtension}`;
                        const sliceTestPath = path.join(slicePath, sliceTestFileName);
                        const sliceTestExists = await fs.pathExists(sliceTestPath);
                        if (!sliceTestExists || force) {
                            const testContent = await resolveSliceTestTemplate({
                                templateDir,
                                isNextjs,
                                featureName: name,
                                sliceName: slice,
                                jsxExtension,
                            });
                            await fs.writeFile(sliceTestPath, testContent);
                        }
                    }
                }
            }
        }

        // Create layout file
        if (!skipLayout) {
            const layoutFileName = `layout.${jsxExtension}`;
            const layoutPath = path.join(basePath, layoutFileName);
            const layoutExists = await fs.pathExists(layoutPath);

            if (!layoutExists || force) {
                if (dryRun) {
                    console.log(
                        chalk.yellow(
                            `[DRY RUN] Would create file: ${path.join(
                                displayFeaturePath,
                                layoutFileName
                            )}`
                        )
                    );
                } else {
                    const content = await resolveLayoutTemplate({
                        templateDir,
                        isNextjs,
                        featureName: name,
                        jsxExtension,
                    });
                    await fs.writeFile(layoutPath, content);
                }
            }
        }

        if (dryRun) {
            console.log(
                chalk.green('\n✔ Dry run completed. No files were modified.')
            );
        } else {
            console.log(
                chalk.green(
                    `✔ Created ${isNextjs ? 'Next.js' : 'React'} feature '${name}' with slices: ${slices.join(
                        ', '
                    )}`
                )
            );
        }
    } catch (error) {
        console.error(chalk.red('Error generating feature structure:'), error);
        throw error;
    }
}