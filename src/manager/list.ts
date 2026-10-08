import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { detectFeatureDir } from '../utils';

export interface FeatureInfo {
    name: string;
    path: string;
    slices: string[];
    sharedFolders: string[];
    presets: string[];
}

export interface ListFeaturesOptions {
    targetDir?: string;
    json?: boolean;
}

const NON_SLICE_DIRS = new Set([
    'components',
    'hooks',
    'types',
    'utils',
    'constants',
    'api',
    'services',
    'actions',
    'queries',
    'store',
    '__tests__',
    'test',
    'tests',
    'node_modules',
]);

const NON_FEATURE_NAMES = new Set([
    'components',
    'hooks',
    'types',
    'utils',
    'constants',
    'api',
    'services',
    'actions',
    'queries',
    'store',
    '__tests__',
    'test',
    'tests',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.git',
]);

const STANDARD_SHARED_FOLDERS = [
    'components',
    'hooks',
    'types',
    'utils',
    'services',
    'actions',
    'store',
    'constants',
];

/**
 * Finds all slice subfolders in a feature folder.
 * Slices are subfolders containing page.tsx, index.tsx, or a components directory.
 */
async function findSlices(featurePath: string): Promise<string[]> {
    const slices: string[] = [];

    try {
        const entries = await fs.readdir(featurePath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
            if (NON_SLICE_DIRS.has(entry.name)) continue;

            const subDirPath = path.join(featurePath, entry.name);
            const subEntries = await fs.readdir(subDirPath).catch(() => []);
            const isSlice = subEntries.some((file) => {
                const lower = file.toLowerCase();
                return (
                    lower === 'page.tsx' ||
                    lower === 'page.jsx' ||
                    lower === 'page.ts' ||
                    lower === 'page.js' ||
                    lower === 'index.tsx' ||
                    lower === 'index.jsx' ||
                    lower === 'index.ts' ||
                    lower === 'index.js' ||
                    lower === 'components'
                );
            });

            if (isSlice) {
                slices.push(entry.name);
            }
        }
    } catch {
        // Directory read error handled gracefully
    }

    return slices.sort();
}

/**
 * Detects standard shared folders present in the feature.
 */
async function findSharedFolders(featurePath: string): Promise<string[]> {
    const sharedFolders: string[] = [];

    for (const folder of STANDARD_SHARED_FOLDERS) {
        if (folder === 'services') {
            const hasServices =
                (await fs.pathExists(path.join(featurePath, 'services'))) ||
                (await fs.pathExists(path.join(featurePath, 'api', 'services')));
            if (hasServices) sharedFolders.push('services');
        } else if (folder === 'actions') {
            const hasActions =
                (await fs.pathExists(path.join(featurePath, 'actions'))) ||
                (await fs.pathExists(path.join(featurePath, 'api', 'actions')));
            if (hasActions) sharedFolders.push('actions');
        } else {
            if (await fs.pathExists(path.join(featurePath, folder))) {
                sharedFolders.push(folder);
            }
        }
    }

    return sharedFolders;
}

/**
 * Recursively checks if test files exist in the feature directory.
 */
async function hasTestFiles(dir: string, depth = 0): Promise<boolean> {
    if (depth > 3) return false;
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
            if (item.isDirectory()) {
                if (item.name === '__tests__' || item.name === 'tests' || item.name === 'test') {
                    return true;
                }
                const nested = await hasTestFiles(path.join(dir, item.name), depth + 1);
                if (nested) return true;
            } else if (item.isFile()) {
                if (/\.(test|spec)\.[jt]sx?$/.test(item.name)) {
                    return true;
                }
            }
        }
    } catch {
        // Ignore read errors
    }
    return false;
}

/**
 * Detects presets used in the feature (TanStack Query, Server Actions, Zustand, Tests).
 */
async function detectFeaturePresets(featurePath: string): Promise<string[]> {
    const presets: string[] = [];

    // TanStack Query: api/queries or queries folder, or query hooks
    const hasQueriesDir =
        (await fs.pathExists(path.join(featurePath, 'api', 'queries'))) ||
        (await fs.pathExists(path.join(featurePath, 'queries')));
    let hasQueryHooks = false;

    if (await fs.pathExists(path.join(featurePath, 'hooks'))) {
        try {
            const hookFiles = await fs.readdir(path.join(featurePath, 'hooks'));
            hasQueryHooks = hookFiles.some((f) => /query/i.test(f));
        } catch {
            // Ignore
        }
    }

    if (hasQueriesDir || hasQueryHooks) {
        presets.push('TanStack Query');
    }

    // Server Actions: api/actions or actions folder
    const hasActionsDir =
        (await fs.pathExists(path.join(featurePath, 'api', 'actions'))) ||
        (await fs.pathExists(path.join(featurePath, 'actions')));
    if (hasActionsDir) {
        presets.push('Server Actions');
    }

    // Zustand: store folder
    const hasStoreDir = await fs.pathExists(path.join(featurePath, 'store'));
    if (hasStoreDir) {
        presets.push('Zustand');
    }

    // Tests: test files present
    if (await hasTestFiles(featurePath)) {
        presets.push('Tests');
    }

    return presets;
}

/**
 * Determines whether a directory is a feature directory.
 */
async function isFeatureDirectory(
    dirPath: string,
    slices: string[],
    sharedFolders: string[]
): Promise<boolean> {
    if (slices.length > 0 || sharedFolders.length > 0) {
        return true;
    }
    const hasLayout =
        (await fs.pathExists(path.join(dirPath, 'layout.tsx'))) ||
        (await fs.pathExists(path.join(dirPath, 'layout.jsx'))) ||
        (await fs.pathExists(path.join(dirPath, 'layout.js'))) ||
        (await fs.pathExists(path.join(dirPath, 'layout.ts')));
    return hasLayout;
}

/**
 * Scans target directory for features and their slices, shared folders, and presets.
 */
export async function listFeatures(options?: ListFeaturesOptions): Promise<FeatureInfo[]> {
    const config = await loadConfig();
    let baseDir: string;

    if (options?.targetDir) {
        baseDir = path.resolve(process.cwd(), options.targetDir);
    } else if (config.outputDir) {
        baseDir = path.resolve(process.cwd(), config.outputDir);
    } else {
        const detected = await detectFeatureDir();
        baseDir = detected !== '.' ? path.resolve(process.cwd(), detected) : process.cwd();
    }

    if (!(await fs.pathExists(baseDir))) {
        if (options?.json) {
            console.log(JSON.stringify([], null, 2));
        }
        return [];
    }

    const stat = await fs.stat(baseDir);
    if (!stat.isDirectory()) {
        if (options?.json) {
            console.log(JSON.stringify([], null, 2));
        }
        return [];
    }

    // Check if baseDir itself is directly a single feature
    const hasLayoutFile =
        (await fs.pathExists(path.join(baseDir, 'layout.tsx'))) ||
        (await fs.pathExists(path.join(baseDir, 'layout.jsx'))) ||
        (await fs.pathExists(path.join(baseDir, 'layout.js'))) ||
        (await fs.pathExists(path.join(baseDir, 'layout.ts')));
    const selfSharedFolders = await findSharedFolders(baseDir);
    const selfSlices = await findSlices(baseDir);

    const isDirectFeature =
        hasLayoutFile ||
        (selfSharedFolders.length > 0 && selfSlices.length > 0) ||
        selfSharedFolders.length >= 2;

    if (isDirectFeature) {
        const presets = await detectFeaturePresets(baseDir);
        const result: FeatureInfo[] = [
            {
                name: path.basename(baseDir),
                path: baseDir,
                slices: selfSlices,
                sharedFolders: selfSharedFolders,
                presets,
            },
        ];
        if (options?.json) {
            console.log(JSON.stringify(result, null, 2));
        }
        return result;
    }

    const features: FeatureInfo[] = [];

    // Scan subdirectories in baseDir
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        if (NON_FEATURE_NAMES.has(entry.name)) continue;

        const candidatePath = path.join(baseDir, entry.name);
        const slices = await findSlices(candidatePath);
        const sharedFolders = await findSharedFolders(candidatePath);
        const isFeat = await isFeatureDirectory(candidatePath, slices, sharedFolders);

        if (isFeat) {
            const presets = await detectFeaturePresets(candidatePath);
            features.push({
                name: entry.name,
                path: candidatePath,
                slices,
                sharedFolders,
                presets,
            });
        }
    }

    // Fallback: If no child features found, check if baseDir itself is a single feature
    if (features.length === 0) {
        const isFeat = await isFeatureDirectory(baseDir, selfSlices, selfSharedFolders);
        if (isFeat) {
            const presets = await detectFeaturePresets(baseDir);
            features.push({
                name: path.basename(baseDir),
                path: baseDir,
                slices: selfSlices,
                sharedFolders: selfSharedFolders,
                presets,
            });
        }
    }

    features.sort((a, b) => a.name.localeCompare(b.name));

    if (options?.json) {
        console.log(JSON.stringify(features, null, 2));
    }

    return features;
}

/**
 * Prints a readable terminal tree of discovered features.
 */
export function printFeatureTree(features: FeatureInfo[], targetDir?: string): void {
    if (features.length === 0) {
        console.log(
            chalk.yellow(`No features found${targetDir ? ` in ${targetDir}` : ''}.`)
        );
        return;
    }

    console.log(chalk.bold.cyan(`\nFeatures (${features.length} found):`));

    features.forEach((feat, index) => {
        const isLastFeature = index === features.length - 1;
        const featurePrefix = isLastFeature ? '└── ' : '├── ';
        const childIndent = isLastFeature ? '    ' : '│   ';

        const displayPath = path.relative(process.cwd(), feat.path) || feat.path;
        console.log(
            `${chalk.gray(featurePrefix)}📦 ${chalk.bold.green(feat.name)} ${chalk.gray(
                `(${displayPath})`
            )}`
        );

        // Slices section
        if (feat.slices.length > 0) {
            console.log(`${chalk.gray(childIndent)}├── 🍰 ${chalk.bold('Slices:')}`);
            feat.slices.forEach((slice, sIndex) => {
                const isLastSlice = sIndex === feat.slices.length - 1;
                const slicePrefix = isLastSlice ? '└── ' : '├── ';
                console.log(
                    `${chalk.gray(childIndent)}│   ${chalk.gray(slicePrefix)}${chalk.cyan(
                        slice
                    )}`
                );
            });
        } else {
            console.log(`${chalk.gray(childIndent)}├── 🍰 ${chalk.gray('(no slices)')}`);
        }

        // Shared folders section
        if (feat.sharedFolders.length > 0) {
            const hasPresets = feat.presets.length > 0;
            const sharedPrefix = hasPresets ? '├── ' : '└── ';
            console.log(
                `${chalk.gray(childIndent)}${chalk.gray(sharedPrefix)}📁 ${chalk.bold(
                    'Shared:'
                )} ${chalk.blue(feat.sharedFolders.join(', '))}`
            );
        }

        // Presets section
        if (feat.presets.length > 0) {
            console.log(
                `${chalk.gray(childIndent)}└── ⚡ ${chalk.bold('Presets:')} ${feat.presets
                    .map((p) => chalk.magenta(`[${p}]`))
                    .join(' ')}`
            );
        }

        if (!isLastFeature) {
            console.log(chalk.gray(childIndent));
        }
    });

    console.log();
}
