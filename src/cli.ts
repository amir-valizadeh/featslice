#!/usr/bin/env node
import { Command } from 'commander';
import { generateFeature } from './generator';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

interface FeatureAnswers {
    featureName: string;
    slices: string[];
}

const program = new Command();

async function findRootDir(startPath: string): Promise<string | null> {
    let currentPath = startPath;

    while (currentPath !== path.parse(currentPath).root) {
        // Check for package.json
        if (await fs.pathExists(path.join(currentPath, 'package.json'))) {
            return currentPath;
        }
        // Move up one directory
        currentPath = path.dirname(currentPath);
    }

    // Check root directory as last resort
    return await fs.pathExists(path.join(currentPath, 'package.json'))
        ? currentPath
        : null;
}

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
async function promptFeature(): Promise<FeatureAnswers> {
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

    // Step 2: First slice name
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

    // Step 3: Additional slices
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

    return {
        featureName: featureNameAnswer.featureName,
        slices
    };
}

program
    .version('1.0.0')
    .description('Generate feature folder structure for React/Next.js projects')
    .arguments('[featureName] [slices]')
    .action(async (featureName?: string, slices?: string) => {
        try {
            console.log(chalk.blue('Checking project type...'));
            const isNextjs = await isNextJsProject();
            console.log(chalk.green(`Detected ${isNextjs ? 'Next.js' : 'React'} project`));

            let answers: FeatureAnswers;

            if (featureName && slices) {
                // Command-line argument mode
                answers = {
                    featureName,
                    slices: slices.split(',').map(s => s.trim())
                };
                console.log(chalk.blue(`Creating feature "${featureName}" with slices: ${answers.slices.join(', ')}`));
            } else {
                // Interactive mode
                answers = await promptFeature();
            }

            await generateFeature({
                name: answers.featureName,
                isNextjs,
                slices: answers.slices
            });

            console.log(chalk.green('✔ Feature structure generated successfully!'));
        } catch (error) {
            console.error(chalk.red('Error generating feature structure:'), error);
            process.exit(1);
        }
    });

program.parse(process.argv);