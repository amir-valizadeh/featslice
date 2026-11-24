import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig, FeatsliceConfig } from '../config';
import { detectFeatureDir } from '../utils';
import { generateFeature, buildPublicApiBarrelContent } from '../generator';
import { EntitySchema } from '../schema/parser';

export interface AddPresetOptions {
    feature: string;
    isNextjs?: boolean;
    targetDir?: string;
    dryRun?: boolean;
    force?: boolean;
    query?: boolean;
    serverActions?: boolean;
    zustand?: boolean;
    zod?: boolean;
    withTests?: boolean;
    schema?: EntitySchema;
    config?: FeatsliceConfig;
}

/**
 * Adds one or more presets to an existing feature without modifying existing slices,
 * and updates its Public API barrel if present.
 */
export async function addPresetsToFeature(options: AddPresetOptions): Promise<boolean> {
    const { feature, dryRun = false, force = false } = options;
    const config = options.config || (await loadConfig());

    const hasAnyPreset = Boolean(
        options.query || options.serverActions || options.zustand || options.zod || options.withTests
    );
    if (!hasAnyPreset) {
        console.error(
            chalk.red(
                'Please specify at least one preset (--query, --server-actions, --zustand, --zod, --with-tests).'
            )
        );
        return false;
    }

    let effectiveOutputDir = options.targetDir || config.outputDir;
    if (!effectiveOutputDir) {
        const detected = await detectFeatureDir();
        effectiveOutputDir = detected !== '.' ? detected : undefined;
    }

    const baseDir = effectiveOutputDir
        ? path.resolve(process.cwd(), effectiveOutputDir)
        : process.cwd();
    const featurePath = path.join(baseDir, feature);

    if (!(await fs.pathExists(featurePath))) {
        console.error(chalk.red(`Feature '${feature}' not found at ${featurePath}`));
        return false;
    }

    await generateFeature({
        name: feature,
        isNextjs: options.isNextjs ?? true,
        slices: [],
        outputDir: effectiveOutputDir,
        dryRun,
        config,
        query: options.query,
        serverActions: options.serverActions,
        zustand: options.zustand,
        zod: options.zod,
        withTests: options.withTests,
        schema: options.schema,
        noLayout: true,
        force,
    });

    // Refresh Public API barrel if it exists so new preset exports are included
    const extension = config.extension || 'ts';
    const barrelPath = path.join(featurePath, `index.${extension}`);
    if (!dryRun && (await fs.pathExists(barrelPath))) {
        const updatedBarrel = await buildPublicApiBarrelContent(
            featurePath,
            feature,
            extension
        );
        await fs.writeFile(barrelPath, updatedBarrel);
    }

    return true;
}
