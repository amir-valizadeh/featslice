#!/usr/bin/env node
import { Command } from 'commander';
import { generateFeature } from './generator';
import { detectFeatureDir, findRootDir } from './utils';
import { loadConfig } from './config';
import { initProject } from './init';
import { listFeatures, printFeatureTree, removeFeatureOrSlice } from './manager';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

interface FeatureAnswers {
    featureName: string;
    slices: string[];
    outputDir?: string;
    presets?: string[];
}

const program = new Command();

async function isNextJsProject(): Promise<boolean> {
    const startDir = process.cwd();
    console.log(chalk.blue('Starting check from:', startDir));

    // Find the root directory containing package.json
    const rootDir = await findRootDir(startDir);
    if (!rootDir) {
        console.warn(chalk.yellow('No package.json found in directory tree. Defaulting to React.'));
        return false;
    }

    console.log(chalk.blue('Found project root at:', rootDir));

    let projectType = {
        hasNextDep: false,
        hasNextConfig: false,
        hasNextStructure: false
    };

    // Check 1: package.json for Next.js dependency
    try {
        const packageJson = await fs.readJson(path.join(rootDir, 'package.json'));
        projectType.hasNextDep = !!(packageJson.dependencies?.next || packageJson.devDependencies?.next);
        console.log(chalk.gray(`- Next.js dependency found: ${projectType.hasNextDep}`));
    } catch (error) {
        console.log(chalk.yellow('- Could not parse package.json'));
    }

    // Check 2: next.config.js/mjs in root
    projectType.hasNextConfig = await fs.pathExists(path.join(rootDir, 'next.config.js')) ||
        await fs.pathExists(path.join(rootDir, 'next.config.mjs'));
    console.log(chalk.gray(`- Next.js config found: ${projectType.hasNextConfig}`));

    // Check 3: Structure (check both root and src)
    const hasPages = await fs.pathExists(path.join(rootDir, 'pages')) ||
        await fs.pathExists(path.join(rootDir, 'src', 'pages'));
    const hasApp = await fs.pathExists(path.join(rootDir, 'app')) ||
        await fs.pathExists(path.join(rootDir, 'src', 'app'));
    projectType.hasNextStructure = hasPages || hasApp;

    // Make decision
    const isNext = projectType.hasNextDep || (projectType.hasNextConfig && projectType.hasNextStructure);

    if (isNext) {
        console.log(chalk.green('\n✔ Detected: Next.js Project'));
        return true;
    } else {
        console.log(chalk.blue('\n✔ Detected: React Project'));
        return false;
    }
}

async function promptFeature(defaultOutputDir: string): Promise<FeatureAnswers> {
    // Step 1: Feature name
    const featureNameAnswer = await inquirer.prompt({
        type: 'input',
        name: 'featureName',
        message: 'What is the name of your feature?',
        validate: (input: string) => {
            if (input.trim() === '') {
                return 'Feature name is required';
            }
            return true;
        }
    });

    // Step 2: Output directory
    const outputDirAnswer = await inquirer.prompt({
        type: 'input',
        name: 'outputDir',
        message: 'Where should the feature be created?',
        default: defaultOutputDir
    });

    // Step 3: First slice name
    const firstSliceAnswer = await inquirer.prompt({
        type: 'input',
        name: 'firstSlice',
        message: 'Enter the name of your first slice:',
        validate: (input: string) => {
            if (input.trim() === '') {
                return 'Slice name is required';
            }
            return true;
        }
    });

    let slices = [firstSliceAnswer.firstSlice];
    let addMore = true;

    // Step 4: Additional slices
    while (addMore) {
        const moreSliceAnswer = await inquirer.prompt({
            type: 'confirm',
            name: 'addAnother',
            message: 'Would you like to add another slice?',
            default: false
        });

        if (moreSliceAnswer.addAnother) {
            const sliceAnswer = await inquirer.prompt({
                type: 'input',
                name: 'sliceName',
                message: 'Enter the name of the next slice:',
                validate: (input: string) => {
                    if (input.trim() === '') {
                        return 'Slice name is required';
                    }
                    return true;
                }
            });
            slices.push(sliceAnswer.sliceName);
        } else {
            addMore = false;
        }
    }

    // Step 5: Presets
    const presetsAnswer = await inquirer.prompt({
        type: 'checkbox',
        name: 'presets',
        message: 'Select additional stack presets and options:',
        choices: [
            { name: 'TanStack Query (React Query hooks & keys)', value: 'query' },
            { name: 'Server Actions (Next.js server actions)', value: 'serverActions' },
            { name: 'Zustand (State store)', value: 'zustand' },
            { name: 'Unit & Component tests', value: 'withTests' },
            { name: 'Minimal scaffolding', value: 'minimal' },
        ],
    });

    return {
        featureName: featureNameAnswer.featureName,
        slices,
        outputDir: outputDirAnswer.outputDir,
        presets: presetsAnswer.presets,
    };
}

program
    .version('1.1.0')
    .description('Generate feature folder structure for React/Next.js projects');

program
    .command('init')
    .description('Initialize featslice configuration and sample templates')
    .option('-y, --yes', 'Skip prompts and generate default configuration and templates')
    .option('-o, --output <dir>', 'Specify default output directory for features')
    .option('-t, --template-dir <dir>', 'Specify directory for custom templates')
    .option('--no-templates', 'Do not generate sample custom templates')
    .action(async (cmdOptions: { yes?: boolean; output?: string; templateDir?: string; templates?: boolean }) => {
        try {
            await initProject({
                yes: cmdOptions.yes,
                outputDir: cmdOptions.output,
                templateDir: cmdOptions.templateDir,
                createTemplates: cmdOptions.templates !== false,
            });
        } catch (error) {
            console.error(chalk.red('Error during initialization:'), error);
            process.exit(1);
        }
    });

program
    .command('list')
    .alias('ls')
    .description('List existing features, slices, shared folders, and presets')
    .option('-o, --output <dir>', 'Specify features directory to scan')
    .option('--json', 'Output features in JSON format')
    .action(async (cmdOptions: { output?: string; json?: boolean }) => {
        try {
            const features = await listFeatures({
                targetDir: cmdOptions.output,
                json: cmdOptions.json,
            });
            if (!cmdOptions.json) {
                printFeatureTree(features, cmdOptions.output);
            }
        } catch (error) {
            console.error(chalk.red('Error listing features:'), error);
            process.exit(1);
        }
    });

program
    .command('add <feature> <slice> [otherSlices...]')
    .description('Add one or more slices to an existing (or new) feature')
    .option('-o, --output <dir>', 'Specify output directory for the feature (e.g., src/features)')
    .option('-d, --dry-run', 'Preview the changes without creating any files')
    .option('-q, --query', 'Generate TanStack Query hooks and query keys factory')
    .option('-a, --server-actions', 'Generate Next.js Server Actions')
    .option('-z, --zustand', 'Generate Zustand state management store')
    .option('--minimal', 'Minimal scaffolding (components, types, and slice pages only)')
    .option('-t, --with-tests', 'Generate unit and component test scaffolding')
    .option('--no-layout', 'Skip generating layout file')
    .option('--no-services', 'Skip generating api/services')
    .option('-f, --force', 'Overwrite existing files if they already exist')
    .action(async (feature: string, slice: string, otherSlices: string[] = [], cmdOptions?: {
        output?: string;
        dryRun?: boolean;
        query?: boolean;
        serverActions?: boolean;
        zustand?: boolean;
        minimal?: boolean;
        withTests?: boolean;
        layout?: boolean;
        noLayout?: boolean;
        services?: boolean;
        noServices?: boolean;
        force?: boolean;
    }) => {
        try {
            if (cmdOptions?.dryRun) {
                console.log(chalk.yellow('\n--- DRY RUN MODE ACTIVE ---'));
                console.log(chalk.yellow('No files or directories will be created.\n'));
            }

            console.log(chalk.blue('Checking project type...'));
            const isNextjs = await isNextJsProject();
            console.log(chalk.green(`Detected ${isNextjs ? 'Next.js' : 'React'} project`));

            const config = await loadConfig();
            const detectedDir = await detectFeatureDir();
            const chosenOutputDir =
                cmdOptions?.output ||
                config.outputDir ||
                (detectedDir !== '.' ? detectedDir : undefined);

            const slices = [slice, ...(otherSlices || [])]
                .flatMap((s) => s.split(','))
                .map((s) => s.trim())
                .filter(Boolean);

            console.log(
                chalk.blue(`Adding slice(s) [${slices.join(', ')}] to feature "${feature}"...`)
            );

            await generateFeature({
                name: feature,
                isNextjs,
                slices,
                outputDir: chosenOutputDir,
                dryRun: cmdOptions?.dryRun,
                config,
                query: cmdOptions?.query ?? false,
                serverActions: cmdOptions?.serverActions ?? false,
                zustand: cmdOptions?.zustand ?? false,
                minimal: cmdOptions?.minimal ?? false,
                withTests: cmdOptions?.withTests ?? false,
                noLayout: cmdOptions?.noLayout ?? (cmdOptions?.layout === false),
                noServices: cmdOptions?.noServices ?? (cmdOptions?.services === false),
                force: cmdOptions?.force ?? false,
            });

            if (!cmdOptions?.dryRun) {
                console.log(chalk.green(`✔ Successfully added slice(s) to feature '${feature}'!`));
            }
        } catch (error) {
            console.error(chalk.red('Error adding slice to feature:'), error);
            process.exit(1);
        }
    });

program
    .command('remove <feature> [slice]')
    .alias('rm')
    .description('Remove an entire feature or a specific slice within a feature')
    .option('-o, --output <dir>', 'Specify output directory for the feature (e.g., src/features)')
    .option('-d, --dry-run', 'Preview the removal without deleting any files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-f, --force', 'Force removal without confirmation')
    .action(async (feature: string, slice?: string, cmdOptions?: {
        output?: string;
        dryRun?: boolean;
        yes?: boolean;
        force?: boolean;
    }) => {
        try {
            const skipConfirm = cmdOptions?.yes || cmdOptions?.force || cmdOptions?.dryRun;

            if (!skipConfirm) {
                const targetDesc = slice
                    ? `slice '${slice}' from feature '${feature}'`
                    : `entire feature '${feature}' (and all its contents)`;
                const answer = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmed',
                    message: `Are you sure you want to remove ${targetDesc}?`,
                    default: false,
                });

                if (!answer.confirmed) {
                    console.log(chalk.yellow('Removal cancelled.'));
                    return;
                }
            }

            const success = await removeFeatureOrSlice({
                feature,
                slice,
                targetDir: cmdOptions?.output,
                dryRun: cmdOptions?.dryRun,
                force: cmdOptions?.force,
            });

            if (!success) {
                process.exitCode = 1;
            }
        } catch (error) {
            console.error(chalk.red('Error removing feature or slice:'), error);
            process.exit(1);
        }
    });

program
    .arguments('[featureName] [slices]')
    .option('-o, --output <dir>', 'Specify output directory for the feature (e.g., src/features)')
    .option('-d, --dry-run', 'Preview the changes without creating any files')
    .option('-q, --query', 'Generate TanStack Query hooks and query keys factory')
    .option('-a, --server-actions', 'Generate Next.js Server Actions')
    .option('-z, --zustand', 'Generate Zustand state management store')
    .option('--minimal', 'Minimal scaffolding (components, types, and slice pages only)')
    .option('-t, --with-tests', 'Generate unit and component test scaffolding')
    .option('--no-layout', 'Skip generating layout file')
    .option('--no-services', 'Skip generating api/services')
    .option('-f, --force', 'Overwrite existing files if they already exist')
    .action(async (featureName?: string, slices?: string, options?: {
        output?: string;
        dryRun?: boolean;
        query?: boolean;
        serverActions?: boolean;
        zustand?: boolean;
        minimal?: boolean;
        withTests?: boolean;
        layout?: boolean;
        noLayout?: boolean;
        services?: boolean;
        noServices?: boolean;
        force?: boolean;
    }) => {
        try {
            if (options?.dryRun) {
                console.log(chalk.yellow('\n--- DRY RUN MODE ACTIVE ---'));
                console.log(chalk.yellow('No files or directories will be created.\n'));
            }

            console.log(chalk.blue('Checking project type...'));
            const isNextjs = await isNextJsProject();
            console.log(chalk.green(`Detected ${isNextjs ? 'Next.js' : 'React'} project`));

            const config = await loadConfig();
            const detectedDir = await detectFeatureDir();
            let answers: FeatureAnswers;

            if (featureName && slices) {
                // Command-line argument mode
                const chosenOutputDir =
                    options?.output ||
                    config.outputDir ||
                    (detectedDir !== '.' ? detectedDir : undefined);

                if (!options?.output && config.outputDir) {
                    console.log(chalk.blue(`Configured features directory: ${config.outputDir}`));
                } else if (!options?.output && detectedDir !== '.') {
                    console.log(chalk.blue(`Auto-detected features directory: ${detectedDir}`));
                } else if (options?.output) {
                    console.log(chalk.blue(`Output directory: ${options.output}`));
                }

                answers = {
                    featureName,
                    slices: slices.split(',').map(s => s.trim()),
                    outputDir: chosenOutputDir
                };
                console.log(chalk.blue(`Creating feature "${featureName}" with slices: ${answers.slices.join(', ')}`));
            } else {
                // Interactive mode
                answers = await promptFeature(options?.output || config.outputDir || detectedDir);
            }

            const selectedPresets = answers.presets || [];
            const query = options?.query ?? selectedPresets.includes('query');
            const serverActions = options?.serverActions ?? selectedPresets.includes('serverActions');
            const zustand = options?.zustand ?? selectedPresets.includes('zustand');
            const withTests = options?.withTests ?? selectedPresets.includes('withTests');
            const minimal = options?.minimal ?? selectedPresets.includes('minimal');
            const noLayout = options?.noLayout ?? (options?.layout === false);
            const noServices = options?.noServices ?? (options?.services === false);
            const force = options?.force ?? false;

            await generateFeature({
                name: answers.featureName,
                isNextjs,
                slices: answers.slices,
                outputDir: answers.outputDir,
                dryRun: options?.dryRun,
                config,
                query,
                serverActions,
                zustand,
                minimal,
                withTests,
                noLayout,
                noServices,
                force,
            });

            console.log(chalk.green('✔ Feature structure generated successfully!'));
        } catch (error) {
            console.error(chalk.red('Error generating feature structure:'), error);
            process.exit(1);
        }
    });

program.parse(process.argv);