import { capitalize } from '../../utils';

/**
 * Generates unit test template for a slice page component using React Testing Library.
 */
export const getSliceTestTemplate = (
    sliceName: string,
    featureName: string = '',
    isNextjs: boolean = true
): string => {
    const PascalSlice = capitalize(sliceName);
    const componentImport = isNextjs ? `${PascalSlice}Page` : `${PascalSlice}Page`;
    const fromPath = isNextjs ? './page' : './index';

    return `import React from 'react';
import { render, screen } from '@testing-library/react';
import ${componentImport} from '${fromPath}';

describe('${PascalSlice} Component', () => {
    it('renders without crashing', () => {
        render(<${componentImport} />);
        expect(screen.getByText('${PascalSlice}')).toBeInTheDocument();
    });
});\n`;
};

/**
 * Generates unit test template for feature service methods.
 */
export const getServiceTestTemplate = (featureName: string): string => {
    const PascalFeature = capitalize(featureName);

    return `import { ${featureName}Service } from './${PascalFeature}.service';

describe('${PascalFeature}Service', () => {
    it('fetch${PascalFeature} returns data or throws', async () => {
        await expect(${featureName}Service.fetch${PascalFeature}()).rejects.toThrow('Not implemented');
    });

    it('create${PascalFeature} creates data or throws', async () => {
        await expect(${featureName}Service.create${PascalFeature}({} as any)).rejects.toThrow('Not implemented');
    });

    it('update${PascalFeature} updates data or throws', async () => {
        await expect(${featureName}Service.update${PascalFeature}('1', {})).rejects.toThrow('Not implemented');
    });

    it('delete${PascalFeature} deletes data or throws', async () => {
        await expect(${featureName}Service.delete${PascalFeature}('1')).rejects.toThrow('Not implemented');
    });
});\n`;
};

/**
 * Generates unit test template for server action methods.
 */
export const getActionTestTemplate = (featureName: string): string => {
    const PascalFeature = capitalize(featureName);

    return `import {
    get${PascalFeature}Action,
    create${PascalFeature}Action,
    update${PascalFeature}Action,
    delete${PascalFeature}Action,
} from './index';

describe('${PascalFeature} Server Actions', () => {
    it('get${PascalFeature}Action executes successfully', async () => {
        const result = await get${PascalFeature}Action('1');
        expect(result).toBeDefined();
    });

    it('create${PascalFeature}Action executes successfully', async () => {
        const result = await create${PascalFeature}Action({} as any);
        expect(result).toBeDefined();
    });

    it('update${PascalFeature}Action executes successfully', async () => {
        const result = await update${PascalFeature}Action('1', {});
        expect(result).toBeDefined();
    });

    it('delete${PascalFeature}Action executes successfully', async () => {
        const result = await delete${PascalFeature}Action('1');
        expect(result).toEqual({ success: true });
    });
});\n`;
};
