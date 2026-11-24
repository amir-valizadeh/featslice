import fs from 'fs-extra';
import path from 'path';

export interface ImportReference {
    specifier: string;
    line: number;
    /** Start index of the specifier string (inside quotes) in the original file */
    start: number;
    /** End index of the specifier string (inside quotes) in the original file */
    end: number;
}

export interface TsAliasConfig {
    baseDir: string;
    paths: Array<{ prefix: string; suffix: string; targets: string[] }>;
}

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo']);

/**
 * Masks line and block comments with spaces while keeping newlines and offsets identical.
 */
function maskComments(code: string): string {
    let out = '';
    let i = 0;
    const len = code.length;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;

    while (i < len) {
        const ch = code[i];
        const next = code[i + 1];

        if (!inSingle && !inDouble && !inTemplate) {
            if (ch === '/' && next === '/') {
                out += '  ';
                i += 2;
                while (i < len && code[i] !== '\n') {
                    out += ' ';
                    i++;
                }
                continue;
            }
            if (ch === '/' && next === '*') {
                out += '  ';
                i += 2;
                while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
                    out += code[i] === '\n' ? '\n' : ' ';
                    i++;
                }
                if (i < len) {
                    out += '  ';
                    i += 2;
                }
                continue;
            }
            if (ch === "'") inSingle = true;
            else if (ch === '"') inDouble = true;
            else if (ch === '`') inTemplate = true;
        } else if (inSingle) {
            if (ch === '\\' && i + 1 < len) {
                out += ch + next;
                i += 2;
                continue;
            }
            if (ch === "'") inSingle = false;
        } else if (inDouble) {
            if (ch === '\\' && i + 1 < len) {
                out += ch + next;
                i += 2;
                continue;
            }
            if (ch === '"') inDouble = false;
        } else if (inTemplate) {
            if (ch === '\\' && i + 1 < len) {
                out += ch + next;
                i += 2;
                continue;
            }
            if (ch === '`') inTemplate = false;
        }

        out += ch;
        i++;
    }

    return out;
}

function getLineNumber(content: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) {
        if (content.charCodeAt(i) === 10) line++;
    }
    return line;
}

/**
 * Extracts all static and dynamic import/export/require specifiers with exact offsets.
 */
export function extractImportSpecifiers(content: string): ImportReference[] {
    const masked = maskComments(content);
    const refs: ImportReference[] = [];
    const seenStarts = new Set<number>();

    const patterns = [
        // import ... from 'spec' | export ... from 'spec'
        /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?(['"])([^'"\n]+)\1/g,
        // dynamic import('spec') or require('spec')
        /\b(?:import|require)\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
    ];

    for (const regex of patterns) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(masked)) !== null) {
            const fullMatch = match[0];
            const quote = match[1];
            const specifier = match[2];

            // For side-effect or standard import/export, ensure non-from statements are actually `import 'x'`
            if (
                !fullMatch.includes('from') &&
                !fullMatch.includes('(') &&
                !/^\s*import\s+['"]/.test(fullMatch)
            ) {
                continue;
            }

            const quoteIdx = fullMatch.lastIndexOf(`${quote}${specifier}${quote}`);
            if (quoteIdx === -1) continue;

            const start = match.index + quoteIdx + 1;
            const end = start + specifier.length;

            if (seenStarts.has(start)) continue;
            seenStarts.add(start);

            refs.push({
                specifier,
                line: getLineNumber(content, start),
                start,
                end,
            });
        }
    }

    refs.sort((a, b) => a.start - b.start);
    return refs;
}

/**
 * Loads tsconfig.json / jsconfig.json compilerOptions.paths and baseUrl if present.
 */
export async function loadTsConfigAliases(projectRoot: string): Promise<TsAliasConfig> {
    const empty: TsAliasConfig = { baseDir: projectRoot, paths: [] };

    for (const fileName of ['tsconfig.json', 'jsconfig.json']) {
        const configPath = path.join(projectRoot, fileName);
        if (!(await fs.pathExists(configPath))) continue;

        try {
            const raw = await fs.readFile(configPath, 'utf-8');
            const stripped = maskComments(raw).replace(/,\s*([}\]])/g, '$1');
            const parsed = JSON.parse(stripped);
            const compilerOptions = parsed?.compilerOptions || {};
            const baseDir = compilerOptions.baseUrl
                ? path.resolve(projectRoot, compilerOptions.baseUrl)
                : projectRoot;

            const rawPaths: Record<string, string[]> = compilerOptions.paths || {};
            const paths: TsAliasConfig['paths'] = [];

            for (const [pattern, targets] of Object.entries(rawPaths)) {
                if (!Array.isArray(targets) || targets.length === 0) continue;
                const starIdx = pattern.indexOf('*');
                if (starIdx === -1) {
                    paths.push({ prefix: pattern, suffix: '', targets });
                } else {
                    paths.push({
                        prefix: pattern.slice(0, starIdx),
                        suffix: pattern.slice(starIdx + 1),
                        targets,
                    });
                }
            }

            // Sort longer prefixes first for deterministic matching
            paths.sort((a, b) => b.prefix.length - a.prefix.length);
            return { baseDir, paths };
        } catch {
            return empty;
        }
    }

    return empty;
}

/**
 * Resolves a module specifier to an absolute filesystem path (without forcing extension).
 * Returns null for external npm packages.
 */
export function resolveImportTarget(
    fromFile: string,
    specifier: string,
    aliases?: TsAliasConfig
): string | null {
    if (specifier.startsWith('.')) {
        return path.resolve(path.dirname(fromFile), specifier);
    }

    if (aliases && aliases.paths.length > 0) {
        for (const entry of aliases.paths) {
            if (
                specifier.startsWith(entry.prefix) &&
                specifier.endsWith(entry.suffix) &&
                specifier.length >= entry.prefix.length + entry.suffix.length
            ) {
                const matched = specifier.slice(
                    entry.prefix.length,
                    entry.suffix ? specifier.length - entry.suffix.length : undefined
                );
                const targetPattern = entry.targets[0];
                const replaced = targetPattern.includes('*')
                    ? targetPattern.replace('*', matched)
                    : targetPattern;
                return path.resolve(aliases.baseDir, replaced);
            }
        }
    }

    return null;
}

/**
 * Recursively collects all JS/TS source files under rootDir.
 */
export async function scanCodeFiles(rootDir: string): Promise<string[]> {
    const files: string[] = [];
    if (!(await fs.pathExists(rootDir))) return files;

    async function walk(dir: string): Promise<void> {
        let entries: fs.Dirent[];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            if (entry.name.startsWith('.') && entry.isDirectory()) continue;

            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (CODE_EXTENSIONS.has(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }

    await walk(rootDir);
    files.sort();
    return files;
}

/**
 * Rewrites import specifiers in a file using a transform callback.
 * Returns { content, changedCount }.
 */
export function rewriteImportsInContent(
    content: string,
    transform: (specifier: string) => string | null
): { content: string; changedCount: number } {
    const refs = extractImportSpecifiers(content);
    if (refs.length === 0) return { content, changedCount: 0 };

    let result = content;
    let changedCount = 0;

    // Apply from end to start so character offsets stay valid
    for (let i = refs.length - 1; i >= 0; i--) {
        const ref = refs[i];
        const nextSpec = transform(ref.specifier);
        if (nextSpec !== null && nextSpec !== ref.specifier) {
            result = result.slice(0, ref.start) + nextSpec + result.slice(ref.end);
            changedCount++;
        }
    }

    return { content: result, changedCount };
}
