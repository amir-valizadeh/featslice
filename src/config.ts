import fs from 'fs-extra';
import path from 'path';

export interface FeatsliceConfig {
    outputDir?: string;
    templateDir?: string;
    structure?: string[];
    extension?: 'ts' | 'js';
    jsxExtension?: 'tsx' | 'jsx';
    configPath?: string;
}

export const DEFAULT_CONFIG: FeatsliceConfig = {
    templateDir: '.featslice/templates',
    extension: 'ts',
    jsxExtension: 'tsx',
};

export const CONFIG_FILE_NAMES = [
    '.featslicerc.json',
    '.featslicerc.js',
    'featslice.config.json',
];

/**
 * Searches for a featslice config file starting from startDir up to the project root.
 */
export async function findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
    let currentDir = path.resolve(startDir);

    while (true) {
        for (const fileName of CONFIG_FILE_NAMES) {
            const filePath = path.join(currentDir, fileName);
            if (await fs.pathExists(filePath)) {
                return filePath;
            }
        }

        const isProjectRoot =
            (await fs.pathExists(path.join(currentDir, 'package.json'))) ||
            (await fs.pathExists(path.join(currentDir, '.git')));

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }

        if (isProjectRoot) {
            break;
        }

        currentDir = parentDir;
    }

    return null;
}

/**
 * Loads and parses the featslice configuration file.
 * Returns default configuration if no config file is found.
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<FeatsliceConfig> {
    const filePath = await findConfigFile(cwd);

    if (!filePath) {
        return { ...DEFAULT_CONFIG };
    }

    try {
        let loadedConfig: Partial<FeatsliceConfig> = {};

        if (filePath.endsWith('.json')) {
            loadedConfig = await fs.readJson(filePath);
        } else if (filePath.endsWith('.js')) {
            const resolvedPath = path.resolve(filePath);
            delete require.cache[require.resolve(resolvedPath)];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const required = require(resolvedPath);
            loadedConfig =
                required && required.__esModule && required.default
                    ? required.default
                    : (required?.default || required);
        }

        return {
            ...DEFAULT_CONFIG,
            ...loadedConfig,
            configPath: filePath,
        };
    } catch (error) {
        console.warn(`Failed to parse configuration file at ${filePath}:`, error);
        return { ...DEFAULT_CONFIG, configPath: filePath };
    }
}
