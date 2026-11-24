import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { analyzeArchitecture, ArchitectureAnalysis } from './check';
import { FeatsliceConfig } from '../config';

export type GraphFormat = 'ascii' | 'mermaid' | 'json';

export interface GraphOptions {
    targetDir?: string;
    format?: GraphFormat;
    outFile?: string;
    config?: FeatsliceConfig;
}

function getCycleEdgeSet(cycles: string[][]): Set<string> {
    const edgeSet = new Set<string>();
    for (const cycle of cycles) {
        for (let i = 0; i < cycle.length - 1; i++) {
            edgeSet.add(`${cycle[i]}->${cycle[i + 1]}`);
        }
    }
    return edgeSet;
}

export function formatAsciiGraph(analysis: ArchitectureAnalysis): string {
    const names = Object.keys(analysis.graph).sort();
    if (names.length === 0) {
        return 'No features found.';
    }

    const cycleEdges = getCycleEdgeSet(analysis.cycles);
    const lines: string[] = [`Feature Dependency Graph (${names.length} features):`, ''];

    for (const name of names) {
        const deps = analysis.graph[name] || [];
        if (deps.length === 0) {
            lines.push(`📦 ${name} (isolated)`);
        } else {
            lines.push(`📦 ${name}`);
            deps.forEach((dep, idx) => {
                const branch = idx === deps.length - 1 ? '└──' : '├──';
                const isCycle = cycleEdges.has(`${name}->${dep}`);
                const marker = isCycle ? ' [CYCLE]' : '';
                lines.push(`  ${branch}▶ ${dep}${marker}`);
            });
        }
    }

    if (analysis.cycles.length > 0) {
        lines.push('');
        lines.push(`Cycles detected (${analysis.cycles.length}):`);
        for (const c of analysis.cycles) {
            lines.push(`  ! ${c.join(' -> ')}`);
        }
    }

    return lines.join('\n');
}

export function formatMermaidGraph(analysis: ArchitectureAnalysis): string {
    const names = Object.keys(analysis.graph).sort();
    const cycleEdges = getCycleEdgeSet(analysis.cycles);
    const lines: string[] = ['flowchart LR'];

    const sanitizeId = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, '_');

    for (const name of names) {
        lines.push(`    ${sanitizeId(name)}["${name}"]`);
    }

    let edgeIndex = 0;
    const cycleEdgeIndices: number[] = [];

    for (const name of names) {
        for (const dep of analysis.graph[name] || []) {
            lines.push(`    ${sanitizeId(name)} --> ${sanitizeId(dep)}`);
            if (cycleEdges.has(`${name}->${dep}`)) {
                cycleEdgeIndices.push(edgeIndex);
            }
            edgeIndex++;
        }
    }

    for (const idx of cycleEdgeIndices) {
        lines.push(`    linkStyle ${idx} stroke:#e11d48,stroke-width:2px`);
    }

    return lines.join('\n');
}

export function formatJsonGraph(analysis: ArchitectureAnalysis): string {
    return JSON.stringify(
        {
            features: analysis.features.map((f) => f.name),
            edges: analysis.graph,
            cycles: analysis.cycles,
        },
        null,
        2
    );
}

/**
 * Generates a feature dependency graph in ASCII, Mermaid, or JSON format,
 * and optionally writes it to a file.
 */
export async function generateDependencyGraph(
    options: GraphOptions = {}
): Promise<{ output: string; analysis: ArchitectureAnalysis }> {
    const format = options.format || 'ascii';
    const analysis = await analyzeArchitecture({
        targetDir: options.targetDir,
        config: options.config,
    });

    let output: string;
    if (format === 'mermaid') {
        output = formatMermaidGraph(analysis);
    } else if (format === 'json') {
        output = formatJsonGraph(analysis);
    } else {
        output = formatAsciiGraph(analysis);
    }

    if (options.outFile) {
        const outPath = path.resolve(process.cwd(), options.outFile);
        await fs.ensureDir(path.dirname(outPath));
        const fileContent =
            format === 'mermaid' && outPath.endsWith('.md')
                ? `# Feature Dependency Graph\n\n\`\`\`mermaid\n${output}\n\`\`\`\n`
                : output + '\n';
        await fs.writeFile(outPath, fileContent);
        console.log(
            chalk.green(`✔ Wrote dependency graph to ${path.relative(process.cwd(), outPath)}`)
        );
    }

    return { output, analysis };
}
