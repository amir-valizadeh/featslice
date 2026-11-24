import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig, FeatsliceConfig } from '../config';
import { detectFeatureDir, findRootDir, capitalize } from '../utils';
import {
    loadTsConfigAliases,
    resolveImportTarget,
    rewriteImportsInContent,
    scanCodeFiles,
    TsAliasConfig,
} from '../analyzer/imports';

export interface RenameOptions {
    /** Either '<feature>' or '<feature>/<slice>' */
    source: string;
    /** New feature name or new slice name */
    newName: string;
    targetDir?: string;
    dryRun?: boolean;
    config?: FeatsliceConfig;
}

export interface RenameResult {
    success: boolean;
    kind: 'feature' | 'slice';
    oldPath: string;
    newPath: string;
    renamedFiles: Array<{ from: string; to: string }>;
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

function computeRewrittenSpecifier(
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

    // Preserve alias prefix if the original import used a tsconfig path alias
    if (!specifier.startsWith('.')) {
        for (const entry of aliases.paths) {
            if (
                specifier.startsWith(entry.prefix) &&
                specifier.endsWith(entry.suffix)
            ) {
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
 * Safely renames a feature or slice, updating named files, symbols, and all imports across the project.
 */
export async function renameFeatureOrSlice(
    options: RenameOptions
): Promise<RenameResult> {
    const { source, newName, dryRun = false } = options;
    const config = options.config || (await loadConfig());
    const projectRoot = (await findRootDir(process.cwd())) || process.cwd();
    const aliases = await loadTsConfigAliases(projectRoot);

    let baseDir: string;
    if (options.targetDir) {
        baseDir = path.resolve(process.cwd(), options.targetDir);
    } else if (config.outputDir) {
        baseDir = path.resolve(process.cwd(), config.outputDir);
    } else {
        const detected = await detectFeatureDir();
        baseDir = detected !== '.' ? path.resolve(process.cwd(), detected) : process.cwd();
    }

    const parts = source.split('/').filter(Boolean);
    const isSlice = parts.length === 2;
    const kind: 'feature' | 'slice' = isSlice ? 'slice' : 'feature';

    const oldName = isSlice ? parts[1] : parts[0];
    const cleanNewName = newName.trim();

    if (!oldName || !cleanNewName) {
        console.error(chalk.red('Both source and new name are required.'));
        return {
            success: false,
            kind,
            oldPath: '',
            newPath: '',
            renamedFiles: [],
            updatedImportFiles: [],
        };
    }

    const oldPath = isSlice
        ? path.join(baseDir, parts[0], parts[1])
        : path.join(baseDir, parts[0]);
    const newPath = isSlice
        ? path.join(baseDir, parts[0], cleanNewName)
        : path.join(baseDir, cleanNewName);

    if (!(await fs.pathExists(oldPath))) {
        console.error(chalk.red(`Target not found: ${oldPath}`));
        return {
            success: false,
            kind,
            oldPath,
            newPath,
            renamedFiles: [],
            updatedImportFiles: [],
        };
    }

    if (await fs.pathExists(newPath)) {
        console.error(chalk.red(`Destination already exists: ${newPath}`));
        return {
            success: false,
            kind,
            oldPath,
            newPath,
            renamedFiles: [],
            updatedImportFiles: [],
        };
    }

    const oldPascal = capitalize(oldName);
    const newPascal = capitalize(cleanNewName);
    const oldUpper = oldName.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const newUpper = cleanNewName.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

    const renamedFiles: Array<{ from: string; to: string }> = [];
    const updatedImportFiles: string[] = [];

    // 1. Plan & execute internal file renames + symbol replacements
    const internalFiles = await scanCodeFiles(oldPath);

    for (const file of internalFiles) {
        const dir = path.dirname(file);
        const fileName = path.basename(file);
        let nextFileName = fileName;

        if (kind === 'feature') {
            if (fileName.includes(oldPascal)) {
                nextFileName = fileName.replace(oldPascal, newPascal);
            } else if (fileName.startsWith(`${oldName}.`)) {
                nextFileName = fileName.replace(`${oldName}.`, `${cleanNewName}.`);
            }
        } else {
            if (fileName.startsWith(`${oldName}.test.`)) {
                nextFileName = fileName.replace(`${oldName}.test.`, `${cleanNewName}.test.`);
            }
        }

        if (nextFileName !== fileName) {
            const targetFile = path.join(dir, nextFileName);
            renamedFiles.push({
                from: path.relative(process.cwd(), file),
                to: path.relative(process.cwd(), targetFile),
            });
            if (!dryRun) {
                await fs.move(file, targetFile);
            }
        }
    }

    // Move directory itself
    if (dryRun) {
        console.log(
            chalk.yellow(
                `[DRY RUN] Would rename ${kind} directory: ${path.relative(
                    process.cwd(),
                    oldPath
                )} -> ${path.relative(process.cwd(), newPath)}`
            )
        );
        for (const r of renamedFiles) {
            console.log(chalk.yellow(`[DRY RUN] Would rename file: ${r.from} -> ${r.to}`));
        }
    } else {
        await fs.move(oldPath, newPath);

        // Update internal symbols & internal references to renamed files
        const movedFiles = await scanCodeFiles(newPath);
        for (const file of movedFiles) {
            let content = await fs.readFile(file, 'utf-8');
            const original = content;

            if (kind === 'feature') {
                content = content
                    .replace(new RegExp(`\\b${oldPascal}\\b`, 'g'), newPascal)
                    .replace(new RegExp(`\\bI${oldPascal}(Props|State)?\\b`, 'g'), `I${newPascal}$1`)
                    .replace(new RegExp(`\\bT${oldPascal}Response\\b`, 'g'), `T${newPascal}Response`)
                    .replace(new RegExp(`\\buse${oldPascal}(Query|Store)?\\b`, 'g'), `use${newPascal}$1`)
                    .replace(new RegExp(`\\b${oldName}Service\\b`, 'g'), `${cleanNewName}Service`)
                    .replace(new RegExp(`\\b${oldName}Utils\\b`, 'g'), `${cleanNewName}Utils`)
                    .replace(new RegExp(`\\b${oldUpper}_(KEYS|ROUTES|CONFIG)\\b`, 'g'), `${newUpper}_$1`)
                    .replace(new RegExp(`(fetch|create|update|delete)${oldPascal}\\b`, 'g'), `$1${newPascal}`)
                    .replace(new RegExp(`(get|create|update|delete)${oldPascal}Action\\b`, 'g'), `$1${newPascal}Action`)
                    .replace(new RegExp(`\\./${oldPascal}\\.service\\b`, 'g'), `./${newPascal}.service`)
                    .replace(new RegExp(`use${oldPascal}(Query|Store)\\b`, 'g'), `use${newPascal}$1`);
            } else {
                content = content.replace(
                    new RegExp(`\\b${oldPascal}Page\\b`, 'g'),
                    `${newPascal}Page`
                );
            }

            if (content !== original) {
                await fs.writeFile(file, content);
            }
        }
    }

    // 2. Rewrite imports across all files in projectRoot
    const allProjectFiles = await scanCodeFiles(projectRoot);
    for (const file of allProjectFiles) {
        // Skip files inside the moved directory itself (already handled)
        const normFile = normalizePosix(path.resolve(file));
        const normOld = normalizePosix(path.resolve(oldPath));
        const normNew = normalizePosix(path.resolve(newPath));
        if (normFile.startsWith(normOld + '/') || normFile.startsWith(normNew + '/')) {
            continue;
        }

        const content = await fs.readFile(file, 'utf-8');
        const { content: updated, changedCount } = rewriteImportsInContent(
            content,
            (spec) => computeRewrittenSpecifier(file, spec, oldPath, newPath, aliases)
        );

        if (changedCount > 0) {
            const rel = path.relative(process.cwd(), file) || file;
            updatedImportFiles.push(rel);
            if (dryRun) {
                console.log(
                    chalk.yellow(
                        `[DRY RUN] Would update ${changedCount} import(s) in ${rel}`
                    )
                );
            } else {
                await fs.writeFile(file, updated);
            }
        }
    }

    if (!dryRun) {
        console.log(
            chalk.green(
                `✔ Renamed ${kind} '${source}' to '${cleanNewName}' (${renamedFiles.length} file(s) renamed, ${updatedImportFiles.length} file(s) updated).`
            )
        );
    }

    return {
        success: true,
        kind,
        oldPath,
        newPath,
        renamedFiles,
        updatedImportFiles,
    };
}
