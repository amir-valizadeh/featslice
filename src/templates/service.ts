// templates/service.ts
import { capitalize } from '../utils';

export const getServiceTemplate = (featureName: string) => `import type { 
    T${capitalize(featureName)}Response, 
    I${capitalize(featureName)}Props 
} from '../../types';

/**
 * Service for handling ${featureName} related operations
 */
export const ${featureName}Service = {
    /**
     * Fetch ${featureName} data
     */
    fetch${capitalize(featureName)}: async (): Promise<T${capitalize(featureName)}Response> => {
        try {
            // Implement your service method
            throw new Error('Not implemented');
        } catch (error) {
            console.error('Error in fetch${capitalize(featureName)}:', error);
            throw error;
        }
    },

    /**
     * Create new ${featureName}
     */
    create${capitalize(featureName)}: async (data: I${capitalize(featureName)}Props): Promise<T${capitalize(featureName)}Response> => {
        try {
            // Implement your create method
            throw new Error('Not implemented');
        } catch (error) {
            console.error('Error in create${capitalize(featureName)}:', error);
            throw error;
        }
    },

    /**
     * Update existing ${featureName}
     */
    update${capitalize(featureName)}: async (id: string, data: Partial<I${capitalize(featureName)}Props>): Promise<T${capitalize(featureName)}Response> => {
        try {
            // Implement your update method
            throw new Error('Not implemented');
        } catch (error) {
            console.error('Error in update${capitalize(featureName)}:', error);
            throw error;
        }
    },

    /**
     * Delete ${featureName}
     */
    delete${capitalize(featureName)}: async (id: string): Promise<void> => {
        try {
            // Implement your delete method
            throw new Error('Not implemented');
        } catch (error) {
            console.error('Error in delete${capitalize(featureName)}:', error);
            throw error;
        }
    }
};\n`;