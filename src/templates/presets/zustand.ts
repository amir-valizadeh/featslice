import { capitalize } from '../../utils';

export const getZustandTemplate = (featureName: string): string => {
    const PascalFeature = capitalize(featureName);

    return `import { create } from 'zustand';
import type { I${PascalFeature}Props } from '../types';

export interface ${PascalFeature}State {
    data: I${PascalFeature}Props | null;
    isLoading: boolean;
    error: string | null;
    setData: (data: I${PascalFeature}Props | null) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

const initialState = {
    data: null,
    isLoading: false,
    error: null,
};

export const use${PascalFeature}Store = create<${PascalFeature}State>((set) => ({
    ...initialState,
    setData: (data) => set({ data }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    reset: () => set(initialState),
}));\n`;
};
