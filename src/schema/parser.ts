import fs from 'fs-extra';
import path from 'path';
import { toPascalCase } from '../templates/engine';

export interface SchemaField {
    name: string;
    tsType: string;
    zodType: string;
    optional: boolean;
    isArray: boolean;
}

export interface EntitySchema {
    name: string;
    sourceFormat: 'prisma' | 'drizzle' | 'typescript' | 'openapi';
    fields: SchemaField[];
}

function mapBaseType(rawType: string): { ts: string; zod: string } {
    const clean = rawType.trim().toLowerCase();
    switch (clean) {
        case 'string':
        case 'text':
        case 'varchar':
        case 'char':
        case 'uuid':
        case 'cuid':
        case 'email':
            return { ts: 'string', zod: clean === 'email' ? 'z.string().email()' : 'z.string()' };
        case 'int':
        case 'integer':
        case 'bigint':
        case 'serial':
        case 'smallint':
        case 'float':
        case 'double':
        case 'decimal':
        case 'real':
        case 'numeric':
        case 'number':
            return { ts: 'number', zod: 'z.number()' };
        case 'boolean':
        case 'bool':
            return { ts: 'boolean', zod: 'z.boolean()' };
        case 'datetime':
        case 'date':
        case 'timestamp':
            return { ts: 'string', zod: 'z.string()' };
        case 'json':
        case 'jsonb':
        case 'object':
            return { ts: 'Record<string, unknown>', zod: 'z.record(z.string(), z.unknown())' };
        default:
            return { ts: 'unknown', zod: 'z.unknown()' };
    }
}

function buildField(
    name: string,
    rawBaseType: string,
    optional: boolean,
    isArray: boolean
): SchemaField {
    const mapped = mapBaseType(rawBaseType);
    const tsType = isArray ? `${mapped.ts}[]` : mapped.ts;
    let zodType = isArray ? `z.array(${mapped.zod})` : mapped.zod;
    if (optional) {
        zodType = `${zodType}.optional()`;
    }
    return { name, tsType, zodType, optional, isArray };
}

/**
 * Parses Prisma schema models: `model User { id String @id ... }`
 */
export function parsePrismaModels(content: string): EntitySchema[] {
    const models: EntitySchema[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
    let match: RegExpExecArray | null;

    while ((match = modelRegex.exec(content)) !== null) {
        const modelName = toPascalCase(match[1]);
        const body = match[2];
        const fields: SchemaField[] = [];

        for (const rawLine of body.split('\n')) {
            const line = rawLine.replace(/\/\/.*$/, '').trim();
            if (!line || line.startsWith('@@')) continue;

            const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/);
            if (!fieldMatch) continue;

            const [, fieldName, fieldType, arrayMarker, optMarker, rest] = fieldMatch;
            // Skip Prisma relation fields that have @relation
            if (rest && /@relation\b/.test(rest)) continue;

            // Skip non-primitive relation references (PascalCase except DateTime, Decimal, Json, Bytes, BigInt)
            const prismaBuiltins = new Set([
                'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes',
            ]);
            if (/^[A-Z]/.test(fieldType) && !prismaBuiltins.has(fieldType)) {
                continue;
            }

            const isArray = Boolean(arrayMarker);
            const optional = Boolean(optMarker);
            fields.push(buildField(fieldName, fieldType, optional, isArray));
        }

        if (fields.length > 0) {
            models.push({ name: modelName, sourceFormat: 'prisma', fields });
        }
    }

    return models;
}

/**
 * Parses Drizzle ORM table definitions: `export const users = pgTable('users', { ... })`
 */
export function parseDrizzleModels(content: string): EntitySchema[] {
    const models: EntitySchema[] = [];
    const tableRegex =
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\{([\s\S]*?)\}\s*(?:,|\))/g;
    let match: RegExpExecArray | null;

    while ((match = tableRegex.exec(content)) !== null) {
        const tableVar = toPascalCase(match[1]);
        const body = match[2];
        const fields: SchemaField[] = [];

        for (const rawLine of body.split('\n')) {
            const line = rawLine.replace(/\/\/.*$/, '').trim();
            if (!line) continue;

            const colMatch = line.match(/^(\w+)\s*:\s*(\w+)\s*\(/);
            if (!colMatch) continue;

            const [, colName, drizzleFn] = colMatch;
            const isRequired = /\.notNull\s*\(/.test(line) || /\.primaryKey\s*\(/.test(line);
            const isArray = /\.array\s*\(/.test(line);

            fields.push(buildField(colName, drizzleFn, !isRequired, isArray));
        }

        if (fields.length > 0) {
            models.push({ name: tableVar, sourceFormat: 'drizzle', fields });
        }
    }

    return models;
}

/**
 * Parses TypeScript interfaces and object type aliases.
 */
export function parseTypeScriptModels(content: string): EntitySchema[] {
    const models: EntitySchema[] = [];
    const blockRegex =
        /(?:export\s+)?(?:interface\s+(\w+)(?:\s+extends\s+[^{]+)?|type\s+(\w+)\s*=)\s*\{([\s\S]*?)\}/g;
    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(content)) !== null) {
        const rawName = match[1] || match[2];
        const body = match[3];
        const fields: SchemaField[] = [];

        for (const rawLine of body.split('\n')) {
            const line = rawLine.replace(/\/\/.*$/, '').trim();
            if (!line) continue;

            const propMatch = line.match(/^(?:readonly\s+)?(\w+)(\?)?\s*:\s*([^;]+);?$/);
            if (!propMatch) continue;

            const [, propName, optMarker, rawTypeExpr] = propMatch;
            let typeExpr = rawTypeExpr.trim();
            let optional = Boolean(optMarker);

            // Handle `T | null` or `T | undefined`
            if (/\|\s*(?:null|undefined)\b/.test(typeExpr)) {
                optional = true;
                typeExpr = typeExpr.replace(/\|\s*(?:null|undefined)\b/g, '').trim();
            }

            let isArray = false;
            if (typeExpr.endsWith('[]')) {
                isArray = true;
                typeExpr = typeExpr.slice(0, -2).trim();
            } else {
                const arrGeneric = typeExpr.match(/^Array<(.+)>$/);
                if (arrGeneric) {
                    isArray = true;
                    typeExpr = arrGeneric[1].trim();
                }
            }

            fields.push(buildField(propName, typeExpr, optional, isArray));
        }

        if (fields.length > 0) {
            models.push({
                name: toPascalCase(rawName),
                sourceFormat: 'typescript',
                fields,
            });
        }
    }

    return models;
}

/**
 * Parses OpenAPI 3 (`components.schemas`) or Swagger 2 (`definitions`) JSON schemas.
 */
export function parseOpenApiModels(content: string): EntitySchema[] {
    const parsed = JSON.parse(content);
    const schemasObj = parsed?.components?.schemas || parsed?.definitions || {};
    const models: EntitySchema[] = [];

    for (const [schemaName, schemaDef] of Object.entries<any>(schemasObj)) {
        if (!schemaDef || typeof schemaDef !== 'object' || !schemaDef.properties) continue;

        const requiredSet = new Set<string>(
            Array.isArray(schemaDef.required) ? schemaDef.required : []
        );
        const fields: SchemaField[] = [];

        for (const [propName, propDef] of Object.entries<any>(schemaDef.properties)) {
            if (!propDef || typeof propDef !== 'object') continue;
            const isArray = propDef.type === 'array';
            const baseType = isArray
                ? propDef.items?.format || propDef.items?.type || 'unknown'
                : propDef.format || propDef.type || 'unknown';
            const optional = !requiredSet.has(propName);

            fields.push(buildField(propName, baseType, optional, isArray));
        }

        if (fields.length > 0) {
            models.push({
                name: toPascalCase(schemaName),
                sourceFormat: 'openapi',
                fields,
            });
        }
    }

    return models;
}

/**
 * Loads and parses entity schemas from a Prisma, Drizzle, TypeScript, or OpenAPI JSON file.
 */
export async function loadEntitySchemas(filePath: string): Promise<EntitySchema[]> {
    const resolved = path.resolve(process.cwd(), filePath);
    if (!(await fs.pathExists(resolved))) {
        throw new Error(`Schema file not found: ${filePath}`);
    }

    const content = await fs.readFile(resolved, 'utf-8');
    const ext = path.extname(resolved).toLowerCase();

    if (ext === '.prisma') {
        return parsePrismaModels(content);
    }

    if (ext === '.json') {
        return parseOpenApiModels(content);
    }

    // TS/JS: prefer Drizzle if table definitions exist, otherwise TypeScript interfaces/types
    const drizzleModels = parseDrizzleModels(content);
    if (drizzleModels.length > 0) {
        return drizzleModels;
    }

    return parseTypeScriptModels(content);
}

/**
 * Selects a specific model by name (case-insensitive) or returns the sole model.
 */
export function selectEntitySchema(
    schemas: EntitySchema[],
    modelName?: string
): EntitySchema {
    if (schemas.length === 0) {
        throw new Error('No models or interfaces could be parsed from the provided schema file.');
    }

    if (modelName) {
        const lower = modelName.toLowerCase();
        const found = schemas.find(
            (s) => s.name.toLowerCase() === lower || s.name.toLowerCase() === toPascalCase(modelName).toLowerCase()
        );
        if (!found) {
            const available = schemas.map((s) => s.name).join(', ');
            throw new Error(
                `Model '${modelName}' not found in schema. Available models: ${available}`
            );
        }
        return found;
    }

    if (schemas.length === 1) {
        return schemas[0];
    }

    const available = schemas.map((s) => s.name).join(', ');
    throw new Error(
        `Multiple models found in schema (${available}). Please specify one with --model <Name>.`
    );
}
