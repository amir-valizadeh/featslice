import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig, FeatsliceConfig } from '../config';
import { detectFeatureDir, findRootDir } from '../utils';
import {
    loadTsConfigAliases,
    resolveImportTarget,
    rewriteImportsInContent,
    scanCodeFiles,
    TsAliasConfig,
} from '../analyzer/imports';

export interface MoveSliceOptions {
    /** Source slice in '<feature>/<slice>' format */
    source: string;
    /** Destination feature name */
    targetFeature: string;
    targetDir?: string;
    dryRun?: boolean;
    config?: FeatsliceConfig;
}

export interface MoveSliceResult {
    success: boolean;
    oldPath: string;
    newPath: string;
    updatedImportFiles: string[];
}

function normalizePosix(p: string): string {
    return p.replace(/\\/g, '/');
}

function toRelativeSpecifier(fromFile: string, toAbsPath: string): string {
    let rel = normalizePosix(path.relative(path.dirname(fromFile), toAbsPath));
    if (!rel.startsWith('.')) {
        rel = './' + rel;
    }
    return rel;
}

function rewriteExternalSpec(
    fromFile: string,
    specifier: string,
    oldAbsDir: string,
    newAbsDir: string,
    aliases: TsAliasConfig
): string | null {
    const resolved = resolveImportTarget(fromFile, specifier, aliases);
    if (!resolved) return null;

    const normResolved = normalizePosix(path.resolve(resolved));
    const normOld = normalizePosix(path.resolve(oldAbsDir));
    const normNew = normalizePosix(path.resolve(newAbsDir));

    if (normResolved !== normOld && !normResolved.startsWith(normOld + '/')) {
        return null;
    }

    const suffix = normResolved.slice(normOld.length);
    const updatedAbs = normNew + suffix;

    if (!specifier.startsWith('.')) {
        for (const entry of aliases.paths) {
            if (specifier.startsWith(entry.prefix) && specifier.endsWith(entry.suffix)) {
                const targetPattern = entry.targets[0];
                const starIdx = targetPattern.indexOf('*');
                if (starIdx !== -1) {
                    const targetBase = normalizePosix(
                        path.resolve(aliases.baseDir, targetPattern.slice(0, starIdx))
                    );
                    if (updatedAbs.startsWith(targetBase + '/')) {
                        const rest = updatedAbs.slice(targetBase.length + 1);
                        return `${entry.prefix}${rest}${entry.suffix}`;
                    }
                }
            }
        }
    }

    return toRelativeSpecifier(fromFile, updatedAbs);
}

/**
 * Safely moves a slice from one feature to another and rewrites imports across the project.
 */
export async function moveSlice(options: MoveSliceOptions): Promise<MoveSliceResult> {
    const { source, targetFeature, dryRun = false } = options;
    const config = options.config || (await loadConfig());
    const projectRoot = (await findRootDir(process.cwd())) || process.cwd();
    const aliases = await loadTsConfigAliases(projectRoot);

    const parts = source.split('/').filter(Boolean);
    if (parts.length !== 2) {
        console.error(
            chalk.red("Source must be in '<feature>/<slice>' format (e.g., auth/profile).")
        );
        return { success: false, oldPath: '', newPath: '', updatedImportFiles: [] };
    }

    const [srcFeature, sliceName] = parts;
    const cleanTarget = targetFeature.trim();
    if (!cleanTarget) {
        console.error(chalk.red('Target feature name is required.'));
        return { success: false, oldPath: '', newPath: '', updatedImportFiles: [] };
    }

    let baseDir: string;
    if (options.targetDir) {
        baseDir = path.resolve(process.cwd(), options.targetDir);
    } else if (config.outputDir) {
        baseDir = path.resolve(process.cwd(), config.outputDir);
    } else {
        const detected = await detectFeatureDir();
        baseDir = detected !== '.' ? path.resolve(process.cwd(), detected) : process.cwd();
    }

    const oldPath = path.join(baseDir, srcFeature, sliceName);
    const targetFeaturePath = path.join(baseDir, cleanTarget);
    const newPath = path.join(targetFeaturePath, sliceName);

    if (!(await fs.pathExists(oldPath))) {
        console.error(chalk.red(`Slice not found: ${oldPath}`));
        return { success: false, oldPath, newPath, updatedImportFiles: [] };
    }

    if (!(await fs.pathExists(targetFeaturePath))) {
        console.error(chalk.red(`Target feature not found: ${targetFeaturePath}`));
        return { success: false, oldPath, newPath, updatedImportFiles: [] };
    }

    if (await fs.pathExists(newPath)) {
        console.error(
            chalk.red(`Slice '${sliceName}' already exists in feature '${cleanTarget}'.`)
        );
        return { success: false, oldPath, newPath, updatedImportFiles: [] };
    }

    const updatedImportFiles: string[] = [];

    if (dryRun) {
        console.log(
            chalk.yellow(
                `[DRY RUN] Would move slice: ${path.relative(
                    process.cwd(),
                    oldPath
                )} -> ${path.relative(process.cwd(), newPath)}`
            )
        );
    } else {
        await fs.move(oldPath, newPath);
    }

    // Rewrite external references across the project
    const allProjectFiles = await scanCodeFiles(projectRoot);
    const normOld = normalizePosix(path.resolve(oldPath));
    const normNew = normalizePosix(path.resolve(newPath));

    for (const file of allProjectFiles) {
        const normFile = normalizePosix(path.resolve(file));
        if (normFile.startsWith(normOld + '/') || normFile.startsWith(normNew + '/')) {
            continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const { content: updated, changedCount } = rewriteImportsInContent(content, (spec) =>
            rewriteExternalSpec(file, spec, oldPath, newPath, aliases)
        );

        if (changedCount > 0) {
            const rel = path.relative(process.cwd(), file) || file;
            updatedImportFiles.push(rel);
            if (dryRun) {
                console.log(
                    chalk.yellow(`[DRY RUN] Would update ${changedCount} import(s) in ${rel}`)
                );
            } else {
                await fs.writeFile(file, updated);
            }
        }
    }

    if (!dryRun) {
        console.log(
            chalk.green(
                `✔ Moved slice '${sliceName}' from '${srcFeature}' to '${cleanTarget}' (${updatedImportFiles.length} file(s) updated).`
            )
        );
    }

    return { success: true, oldPath, newPath, updatedImportFiles };
}
