import { capitalize } from '../../utils';

export const getActionsTemplate = (featureName: string): string => {
    const PascalFeature = capitalize(featureName);

    return `'use server';

import type {
    I${PascalFeature}Props,
    T${PascalFeature}Response,
} from '../../types';

/**
 * Fetch ${featureName} server action
 */
export async function get${PascalFeature}Action(id?: string): Promise<T${PascalFeature}Response> {
    try {
        // Implement your server action
        return {} as T${PascalFeature}Response;
    } catch (error) {
        console.error('Error in get${PascalFeature}Action:', error);
        throw error;
    }
}

/**
 * Create ${featureName} server action
 */
export async function create${PascalFeature}Action(data: I${PascalFeature}Props): Promise<T${PascalFeature}Response> {
    try {
        // Implement your server action
        return {} as T${PascalFeature}Response;
    } catch (error) {
        console.error('Error in create${PascalFeature}Action:', error);
        throw error;
    }
}

/**
 * Update ${featureName} server action
 */
export async function update${PascalFeature}Action(
    id: string,
    data: Partial<I${PascalFeature}Props>
): Promise<T${PascalFeature}Response> {
    try {
        // Implement your server action
        return {} as T${PascalFeature}Response;
    } catch (error) {
        console.error('Error in update${PascalFeature}Action:', error);
        throw error;
    }
}

/**
 * Delete ${featureName} server action
 */
export async function delete${PascalFeature}Action(id: string): Promise<{ success: boolean }> {
    try {
        // Implement your server action
        return { success: true };
    } catch (error) {
        console.error('Error in delete${PascalFeature}Action:', error);
        throw error;
    }
}\n`;
};
