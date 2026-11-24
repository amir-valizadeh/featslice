import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadConfig, FeatsliceConfig } from '../config';
import { listFeatures, FeatureInfo } from '../manager/list';
import { findRootDir } from '../utils';
import { buildPublicApiBarrelContent } from '../generator';
import {
    extractImportSpecifiers,
    loadTsConfigAliases,
    resolveImportTarget,
    scanCodeFiles,
} from './imports';

export type ViolationRule =
    | 'deep-import'
    | 'circular-dependency'
    | 'missing-public-api'
    | 'forbidden-boundary';

export type ViolationSeverity = 'error' | 'warning';

export interface ArchitectureViolation {
    rule: ViolationRule;
    severity: ViolationSeverity;
    feature: string;
    targetFeature?: string;
    file?: string;
    line?: number;
    specifier?: string;
    message: string;
    suggestion?: string;
}

export interface FeatureDependency {
    from: string;
    to: string;
    file: string;
    line: number;
    specifier: string;
    isDeep: boolean;
}

export interface ArchitectureAnalysis {
    features: FeatureInfo[];
    dependencies: FeatureDependency[];
    /** Adjacency list: featureName -> sorted unique target feature names */
    graph: Record<string, string[]>;
    cycles: string[][];
    violations: ArchitectureViolation[];
    fixedFiles: string[];
}

export interface CheckOptions {
    targetDir?: string;
    fix?: boolean;
    json?: boolean;
    ci?: boolean;
    silent?: boolean;
    config?: FeatsliceConfig;
}

function normalizeForCompare(p: string): string {
    return path.resolve(p).replace(/\\/g, '/');
}

function isInsideDir(filePath: string, dirPath: string): boolean {
    const normFile = normalizeForCompare(filePath);
    const normDir = normalizeForCompare(dirPath);
    return normFile === normDir || normFile.startsWith(normDir + '/');
}

function isPublicEntryImport(resolvedTarget: string, targetFeaturePath: string): boolean {
    const normTarget = normalizeForCompare(resolvedTarget);
    const normFeature = normalizeForCompare(targetFeaturePath);
    if (normTarget === normFeature) return true;
    const rel = normTarget.slice(normFeature.length + 1);
    return /^index(\.(ts|tsx|js|jsx|mts|mjs))?$/i.test(rel);
}

/**
 * Finds unique elementary cycles in a directed graph using DFS.
 */
export function detectCycles(graph: Record<string, string[]>): string[][] {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];
    const cycleKeys = new Set<string>();
    const cycles: string[][] = [];

    function dfs(node: string): void {
        visited.add(node);
        inStack.add(node);
        stack.push(node);

        for (const neighbor of graph[node] || []) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            } else if (inStack.has(neighbor)) {
                const startIdx = stack.indexOf(neighbor);
                const rawCycle = stack.slice(startIdx);
                // Canonicalize cycle rotation for deduplication
                const minNode = [...rawCycle].sort()[0];
                const minIdx = rawCycle.indexOf(minNode);
                const canonical = [
                    ...rawCycle.slice(minIdx),
                    ...rawCycle.slice(0, minIdx),
                ];
                const key = canonical.join('->');
                if (!cycleKeys.has(key)) {
                    cycleKeys.add(key);
                    cycles.push([...canonical, canonical[0]]);
                }
            }
        }

        stack.pop();
        inStack.delete(node);
    }

    for (const node of Object.keys(graph).sort()) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }

    return cycles;
}

/**
 * Analyzes feature boundaries, imports, public APIs, and dependency cycles.
 */
export async function analyzeArchitecture(
    options: CheckOptions = {}
): Promise<ArchitectureAnalysis> {
    const config = options.config || (await loadConfig());
    const features = await listFeatures({ targetDir: options.targetDir });
    const projectRoot = (await findRootDir(process.cwd())) || process.cwd();
    const aliases = await loadTsConfigAliases(projectRoot);

    const dependencies: FeatureDependency[] = [];
    const graphSets: Record<string, Set<string>> = {};
    const violations: ArchitectureViolation[] = [];
    const fixedFiles: string[] = [];

    for (const feat of features) {
        graphSets[feat.name] = new Set<string>();
    }

    const extension = config.extension || 'ts';

    // 1. Check Public API barrels (index.ts / index.js)
    for (const feat of features) {
        const hasPublicApi =
            (await fs.pathExists(path.join(feat.path, 'index.ts'))) ||
            (await fs.pathExists(path.join(feat.path, 'index.tsx'))) ||
            (await fs.pathExists(path.join(feat.path, 'index.js'))) ||
            (await fs.pathExists(path.join(feat.path, 'index.jsx')));

        if (!hasPublicApi && config.publicApi !== false) {
            if (options.fix) {
                const barrelPath = path.join(feat.path, `index.${extension}`);
                const content = await buildPublicApiBarrelContent(
                    feat.path,
                    feat.name,
                    extension
                );
                await fs.writeFile(barrelPath, content);
                fixedFiles.push(barrelPath);
            } else {
                violations.push({
                    rule: 'missing-public-api',
                    severity: 'warning',
                    feature: feat.name,
                    file: path.relative(process.cwd(), feat.path) || feat.path,
                    message: `Feature '${feat.name}' is missing a Public API barrel (index.${extension}).`,
                    suggestion: `Run 'featslice check --fix' to generate ${path.join(
                        path.relative(process.cwd(), feat.path) || feat.name,
                        `index.${extension}`
                    )}.`,
                });
            }
        }
    }

    // 2. Scan imports across every feature
    const boundaries = config.boundaries || {};
    const sharedSet = new Set(boundaries.sharedFeatures || []);

    for (const feat of features) {
        const files = await scanCodeFiles(feat.path);

        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const refs = extractImportSpecifiers(content);

            for (const ref of refs) {
                const resolved = resolveImportTarget(file, ref.specifier, aliases);
                if (!resolved) continue;

                // Determine if resolved target belongs to ANOTHER feature
                const targetFeat = features.find(
                    (other) => other.name !== feat.name && isInsideDir(resolved, other.path)
                );
                if (!targetFeat) continue;

                const isDeep = !isPublicEntryImport(resolved, targetFeat.path);
                graphSets[feat.name].add(targetFeat.name);

                const relFile = path.relative(process.cwd(), file) || file;
                dependencies.push({
                    from: feat.name,
                    to: targetFeat.name,
                    file: relFile,
                    line: ref.line,
                    specifier: ref.specifier,
                    isDeep,
                });

                // Rule: deep-import
                if (isDeep) {
                    violations.push({
                        rule: 'deep-import',
                        severity: 'error',
                        feature: feat.name,
                        targetFeature: targetFeat.name,
                        file: relFile,
                        line: ref.line,
                        specifier: ref.specifier,
                        message: `Deep cross-feature import from '${feat.name}' into '${targetFeat.name}' (${ref.specifier}).`,
                        suggestion: `Import from '${targetFeat.name}' Public API barrel (index.${extension}) instead.`,
                    });
                }

                // Rule: custom boundaries (deny / allow)
                const deniedTargets = boundaries.deny?.[feat.name] || [];
                const allowedTargets = boundaries.allow?.[feat.name];
                const isDenied = deniedTargets.includes(targetFeat.name);
                const isNotAllowed =
                    allowedTargets !== undefined &&
                    !allowedTargets.includes(targetFeat.name) &&
                    !sharedSet.has(targetFeat.name);

                if (isDenied || isNotAllowed) {
                    violations.push({
                        rule: 'forbidden-boundary',
                        severity: 'error',
                        feature: feat.name,
                        targetFeature: targetFeat.name,
                        file: relFile,
                        line: ref.line,
                        specifier: ref.specifier,
                        message: `Boundary violation: '${feat.name}' is not allowed to import from '${targetFeat.name}'.`,
                        suggestion: `Update .featslicerc.json boundaries or remove this cross-feature dependency.`,
                    });
                }
            }
        }
    }

    // 3. Build sorted adjacency map & detect circular dependencies
    const graph: Record<string, string[]> = {};
    for (const [featName, targets] of Object.entries(graphSets)) {
        graph[featName] = Array.from(targets).sort();
    }

    const cycles = detectCycles(graph);
    for (const cycle of cycles) {
        violations.push({
            rule: 'circular-dependency',
            severity: 'error',
            feature: cycle[0],
            message: `Circular dependency detected: ${cycle.join(' -> ')}`,
            suggestion: `Extract shared types or logic into a shared feature or invert the dependency.`,
        });
    }

    return {
        features,
        dependencies,
        graph,
        cycles,
        violations,
        fixedFiles,
    };
}

/**
 * Prints a human-readable architecture check report.
 */
export function printCheckReport(analysis: ArchitectureAnalysis): void {
    if (analysis.fixedFiles.length > 0) {
        console.log(chalk.green(`\n✔ Auto-fixed ${analysis.fixedFiles.length} file(s):`));
        for (const f of analysis.fixedFiles) {
            console.log(chalk.gray(`  + ${path.relative(process.cwd(), f) || f}`));
        }
    }

    const errors = analysis.violations.filter((v) => v.severity === 'error');
    const warnings = analysis.violations.filter((v) => v.severity === 'warning');

    if (analysis.violations.length === 0) {
        console.log(
            chalk.green(
                `\n✔ Architecture check passed across ${analysis.features.length} feature(s) with 0 violations.`
            )
        );
        return;
    }

    console.log(
        chalk.bold.cyan(
            `\nArchitecture Check (${analysis.features.length} feature(s) scanned):`
        )
    );

    for (const v of analysis.violations) {
        const badge =
            v.severity === 'error'
                ? chalk.bgRed.white.bold(' ERROR ')
                : chalk.bgYellow.black.bold(' WARN  ');
        const loc = v.file ? chalk.gray(`${v.file}${v.line ? `:${v.line}` : ''}`) : '';
        console.log(`\n${badge} ${chalk.bold(v.rule)} ${loc}`);
        console.log(`  ${v.message}`);
        if (v.suggestion) {
            console.log(chalk.cyan(`  ↳ ${v.suggestion}`));
        }
    }

    console.log(
        `\nSummary: ${chalk.red(`${errors.length} error(s)`)}, ${chalk.yellow(
            `${warnings.length} warning(s)`
        )}\n`
    );
}
