import { capitalize } from '../utils';

export const getReactSliceTemplate = (sliceName: string) => `import React from 'react';

function ${capitalize(sliceName)}Page() {
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">${capitalize(sliceName)}</h1>
        </div>
    );
}

export default ${capitalize(sliceName)}Page;\n`;

export const getReactLayoutTemplate = () => `import React from 'react';

interface LayoutProps {
    children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen">
            {children}
        </div>
    );
}

export default Layout;\n`;

export const getReactCommonTemplates = (dirName: string, featureName: string) => {
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