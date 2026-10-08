import fs from 'fs-extra';
import path from 'path';

export const capitalize = (str: string): string => {
    // Remove special characters like '(', ')', and '-'
    const cleanedStr = str.replace(/[()\-]/g, ' ');

    // Split into words, capitalize each word, and join them back
    return cleanedStr
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
};

/**
 * Automatically detects the best directory for placing features.
 * Looks for common folders like src/features, src/modules, features, modules.
 * Returns '.' if already in a features directory or if no candidate is found.
 */
export const detectFeatureDir = async (startPath: string = process.cwd()): Promise<string> => {
    const base = path.basename(startPath);
    if (base === 'features' || base === 'modules') {
        return '.';
    }

    const candidateDirs = [
        path.join('src', 'features'),
        path.join('src', 'modules'),
        'features',
        'modules'
    ];

    for (const candidate of candidateDirs) {
        if (await fs.pathExists(path.join(startPath, candidate))) {
            return candidate;
        }
    }

    return '.';
};

/**
 * Searches upwards from startPath for the project root containing package.json.
 */
export const findRootDir = async (startPath: string = process.cwd()): Promise<string | null> => {
    let currentPath = path.resolve(startPath);

    while (currentPath !== path.parse(currentPath).root) {
        if (await fs.pathExists(path.join(currentPath, 'package.json'))) {
            return currentPath;
        }
        currentPath = path.dirname(currentPath);
    }

    return (await fs.pathExists(path.join(currentPath, 'package.json')))
        ? currentPath
        : null;
};
