import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
    parsePrismaModels,
    parseDrizzleModels,
    parseTypeScriptModels,
    parseOpenApiModels,
    loadEntitySchemas,
    selectEntitySchema,
    generateFeature,
} from '../src/index';

describe('Schema-Driven Scaffolding & Zod Preset', () => {
    let tempDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        originalCwd = process.cwd();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'featslice-schema-test-'));
        process.chdir(tempDir);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        await fs.remove(tempDir);
    });

    it('parses Prisma schema models', () => {
        const prisma = `
            model User {
                id        String   @id @default(cuid())
                email     String   @unique
                age       Int?
                tags      String[]
                isActive  Boolean  @default(true)
                posts     Post[]   @relation("UserPosts")
            }
        `;
        const models = parsePrismaModels(prisma);
        expect(models).toHaveLength(1);
        expect(models[0].name).toBe('User');
        expect(models[0].fields.map((f) => f.name)).toEqual([
            'id',
            'email',
            'age',
            'tags',
            'isActive',
        ]);
        expect(models[0].fields.find((f) => f.name === 'age')?.optional).toBe(true);
        expect(models[0].fields.find((f) => f.name === 'tags')?.tsType).toBe('string[]');
    });

    it('parses Drizzle table definitions', () => {
        const drizzle = `
            export const products = pgTable('products', {
                id: serial('id').primaryKey(),
                title: text('title').notNull(),
                price: integer('price').notNull(),
                description: text('description'),
            });
        `;
        const models = parseDrizzleModels(drizzle);
        expect(models).toHaveLength(1);
        expect(models[0].name).toBe('Products');
        expect(models[0].fields.find((f) => f.name === 'title')?.optional).toBe(false);
        expect(models[0].fields.find((f) => f.name === 'description')?.optional).toBe(true);
    });

    it('parses TypeScript interfaces and type aliases', () => {
        const ts = `
            export interface Invoice {
                id: string;
                amount: number;
                paid?: boolean;
                notes: string | null;
                items: string[];
            }
        `;
        const models = parseTypeScriptModels(ts);
        expect(models).toHaveLength(1);
        expect(models[0].name).toBe('Invoice');
        expect(models[0].fields).toHaveLength(5);
        expect(models[0].fields.find((f) => f.name === 'notes')?.optional).toBe(true);
        expect(models[0].fields.find((f) => f.name === 'items')?.zodType).toBe('z.array(z.string())');
    });

    it('parses OpenAPI JSON schemas', () => {
        const openapi = JSON.stringify({
            openapi: '3.0.0',
            components: {
                schemas: {
                    Order: {
                        type: 'object',
                        required: ['id', 'total'],
                        properties: {
                            id: { type: 'string' },
                            total: { type: 'number' },
                            coupon: { type: 'string' },
                        },
                    },
                },
            },
        });
        const models = parseOpenApiModels(openapi);
        expect(models).toHaveLength(1);
        expect(models[0].name).toBe('Order');
        expect(models[0].fields.find((f) => f.name === 'coupon')?.optional).toBe(true);
    });

    it('generates real typed types/index.ts and Zod schemas/index.ts from a schema file', async () => {
        const schemaPath = path.join(tempDir, 'schema.prisma');
        await fs.writeFile(
            schemaPath,
            `
            model User {
                id       String  @id
                email    String
                age      Int?
                isActive Boolean
            }
            `
        );

        const schemas = await loadEntitySchemas(schemaPath);
        const userSchema = selectEntitySchema(schemas, 'User');

        await generateFeature({
            name: 'users',
            isNextjs: true,
            slices: ['list'],
            outputDir: 'src/features',
            schema: userSchema,
        });

        const typesContent = await fs.readFile(
            path.join(tempDir, 'src/features/users/types/index.ts'),
            'utf-8'
        );
        expect(typesContent).toContain('export interface IUsers');
        expect(typesContent).toContain('email: string;');
        expect(typesContent).toContain('age?: number;');
        expect(typesContent).toContain('isActive: boolean;');

        const zodContent = await fs.readFile(
            path.join(tempDir, 'src/features/users/schemas/index.ts'),
            'utf-8'
        );
        expect(zodContent).toContain("import { z } from 'zod';");
        expect(zodContent).toContain('export const usersSchema = z.object({');
        expect(zodContent).toContain('age: z.number().optional(),');
        expect(zodContent).toContain('export const createUsersSchema = z.object({');
        expect(zodContent).toContain('export type UsersDTO = z.infer<typeof usersSchema>;');

        // Public API barrel should re-export schemas
        const barrelContent = await fs.readFile(
            path.join(tempDir, 'src/features/users/index.ts'),
            'utf-8'
        );
        expect(barrelContent).toContain("export * from './schemas';");
    });
});
