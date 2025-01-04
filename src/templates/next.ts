// templates/next.ts
import { capitalize } from '../utils';

export const getNextSliceTemplate = (sliceName: string) => `export default function ${capitalize(sliceName)}Page() {
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">${capitalize(sliceName)}</h1>
        </div>
    );
}\n`;

export const getNextLayoutTemplate = () => `export default function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen">
            {children}
        </div>
    );
}\n`;

export const getNextCommonTemplates = (dirName: string, featureName: string) => {
    switch (dirName) {
        case 'types':
            return `export interface I${capitalize(featureName)}Props {
    // Add your props here
}

export interface I${capitalize(featureName)}State {
    // Add your state here
}

export type T${capitalize(featureName)}Response = {
    // Add your response type here
};\n`;

        case 'hooks':
            return `import { useState } from 'react';
import type { I${capitalize(featureName)}State } from '../types';

export const use${capitalize(featureName)} = () => {
    const [state, setState] = useState<I${capitalize(featureName)}State>();
    return { state, setState };
};\n`;

        case 'utils':
            return `export const ${featureName}Utils = {
    // Add your utility functions here
};\n`;

        case 'constants':
            return `export const ${featureName.toUpperCase()}_ROUTES = {
    // Add your routes here
};

export const ${featureName.toUpperCase()}_CONFIG = {
    // Add your config here
};\n`;

        default:
            return `// ${capitalize(featureName)} ${dirName} exports\n`;
    }
};