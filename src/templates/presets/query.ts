import { capitalize } from '../../utils';

export const getQueryTemplate = (featureName: string): string => {
    const PascalFeature = capitalize(featureName);
    const upperFeature = featureName.toUpperCase();

    return `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { I${PascalFeature}Props, T${PascalFeature}Response } from '../../types';
import { ${featureName}Service } from '../services/${PascalFeature}.service';

/**
 * Query keys factory for ${featureName}
 */
export const ${upperFeature}_KEYS = {
    all: ['${featureName}'] as const,
    list: () => [...${upperFeature}_KEYS.all, 'list'] as const,
    detail: (id: string | number) => [...${upperFeature}_KEYS.all, 'detail', id] as const,
};

/**
 * Hook for fetching ${featureName} data
 */
export const use${PascalFeature}Query = (id?: string | number) => {
    return useQuery({
        queryKey: id !== undefined ? ${upperFeature}_KEYS.detail(id) : ${upperFeature}_KEYS.list(),
        queryFn: async (): Promise<T${PascalFeature}Response> => {
            return ${featureName}Service.fetch${PascalFeature}();
        },
    });
};

/**
 * Hook for creating ${featureName} mutation
 */
export const useCreate${PascalFeature}Mutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: I${PascalFeature}Props): Promise<T${PascalFeature}Response> => {
            return ${featureName}Service.create${PascalFeature}(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ${upperFeature}_KEYS.all });
        },
    });
};\n`;
};
