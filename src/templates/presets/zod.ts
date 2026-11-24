import { capitalize } from '../../utils';
import { EntitySchema } from '../../schema/parser';

/**
 * Generates Zod validation schemas for a feature, optionally populated from an EntitySchema.
 */
export function getZodTemplate(featureName: string, schema?: EntitySchema): string {
    const PascalFeature = capitalize(featureName);
    const camelFeature = PascalFeature.charAt(0).toLowerCase() + PascalFeature.slice(1);

    const fieldLines =
        schema && schema.fields.length > 0
            ? schema.fields.map((f) => `    ${f.name}: ${f.zodType},`).join('\n')
            : `    id: z.string(),\n    name: z.string().min(1),`;

    const createFieldLines =
        schema && schema.fields.length > 0
            ? schema.fields
                  .filter((f) => f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt')
                  .map((f) => `    ${f.name}: ${f.zodType},`)
                  .join('\n') || fieldLines
            : `    name: z.string().min(1),`;

    return `import { z } from 'zod';

export const ${camelFeature}Schema = z.object({
${fieldLines}
});

export const create${PascalFeature}Schema = z.object({
${createFieldLines}
});

export const update${PascalFeature}Schema = create${PascalFeature}Schema.partial();

export type ${PascalFeature}DTO = z.infer<typeof ${camelFeature}Schema>;
export type Create${PascalFeature}Input = z.infer<typeof create${PascalFeature}Schema>;
export type Update${PascalFeature}Input = z.infer<typeof update${PascalFeature}Schema>;
`;
}

/**
 * Generates typed types/index.ts populated from an EntitySchema.
 */
export function getSchemaTypesTemplate(featureName: string, schema: EntitySchema): string {
    const PascalFeature = capitalize(featureName);

    const fieldLines = schema.fields
        .map((f) => `    ${f.name}${f.optional ? '?' : ''}: ${f.tsType};`)
        .join('\n');

    return `export interface I${PascalFeature} {
${fieldLines}
}

export type I${PascalFeature}Props = Omit<I${PascalFeature}, 'id'>;

export interface I${PascalFeature}State {
    items: I${PascalFeature}[];
    selected: I${PascalFeature} | null;
    isLoading: boolean;
    error: string | null;
}

export type T${PascalFeature}Response = {
    data: I${PascalFeature}[];
    total?: number;
};
`;
}
