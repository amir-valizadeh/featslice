import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { detectFeatureDir } from '../utils';

export interface RemoveOptions {
    feature: string;
    slice?: string;
    targetDir?: string;
    dryRun?: boolean;
    force?: boolean;
}

/**
 * Removes a feature or a specific slice within a feature.
 * Returns true if the target existed and was removed (or would be removed in dry-run mode).
 * Returns false if the target did not exist or arguments were invalid.
 */
export async function removeFeatureOrSlice(options: RemoveOptions): Promise<boolean> {
    const { feature, slice, dryRun = false } = options;

    if (!feature || feature.trim() === '') {
        console.error(chalk.red('Feature name is required.'));
        return false;
    }

    const config = await loadConfig();
    let baseDir: string;

    if (options.targetDir) {
        baseDir = path.resolve(process.cwd(), options.targetDir);
    } else if (config.outputDir) {
        baseDir = path.resolve(process.cwd(), config.outputDir);
    } else {
        const detected = await detectFeatureDir();
        baseDir = detected !== '.' ? path.resolve(process.cwd(), detected) : process.cwd();
    }

    const featurePath = path.join(baseDir, feature);

    if (slice) {
        const slicePath = path.join(featurePath, slice);
        const sliceExists = await fs.pathExists(slicePath);

        if (!sliceExists) {
            console.warn(
                chalk.yellow(`Slice '${slice}' not found in feature '${feature}' at ${slicePath}`)
            );
            return false;
        }

        const displayPath = path.relative(process.cwd(), slicePath) || slicePath;

        if (dryRun) {
            console.log(
                chalk.yellow(
                    `[DRY RUN] Would remove slice '${slice}' from feature '${feature}': ${displayPath}`
                )
            );
            return true;
        }

        await fs.remove(slicePath);
        console.log(
            chalk.green(
                `✔ Removed slice '${slice}' from feature '${feature}' (${displayPath})`
            )
        );
        return true;
    } else {
        const featureExists = await fs.pathExists(featurePath);

        if (!featureExists) {
            console.warn(
                chalk.yellow(`Feature '${feature}' not found at ${featurePath}`)
            );
            return false;
        }

        const displayPath = path.relative(process.cwd(), featurePath) || featurePath;

        if (dryRun) {
            console.log(
                chalk.yellow(
                    `[DRY RUN] Would remove feature '${feature}': ${displayPath}`
                )
            );
            return true;
        }

        await fs.remove(featurePath);
        console.log(
            chalk.green(`✔ Removed feature '${feature}' (${displayPath})`)
        );
        return true;
    }
}
