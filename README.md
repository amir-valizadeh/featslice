# FeatSlice

A CLI tool for generating feature-based folder structures in React and Next.js projects.

## Installation & Usage

You can use FeatSlice in two ways:

### 1. Using npx (Recommended - No Installation)
```bash
npx featslice auth login,register
```

### 2. Global Installation
```bash
npm install -g featslice
featslice auth login,register
```

## Usage Details

### Quick Start

```bash
featslice auth login,register,reset-password
```

### Interactive Mode

Just run:
```bash
featslice
```

The CLI will guide you through:
1. Feature name input
2. First slice name
3. Option to add more slices

### Project Type Detection

FeatSlice automatically detects whether you're in a Next.js or React project by checking your package.json. You don't need to specify this manually.

## Generated Structure

Here's what gets generated for a feature named "auth" with slices "login" and "register":

### Next.js Project Output

```
auth/
├── components/          # Shared components
│   └── index.ts
├── hooks/              # Custom hooks
│   └── index.ts        # Contains useAuth hook
├── types/              # TypeScript types
│   └── index.ts        # Contains IAuthProps, IAuthState, TAuthResponse
├── utils/              # Utility functions
│   └── index.ts        # Contains authUtils
├── api/
│   └── services/       # API services
│       ├── index.ts
│       └── auth.service.ts  # CRUD operations
├── constants/          # Constants and configs
│   └── index.ts        # Contains AUTH_ROUTES, AUTH_CONFIG
├── login/             # Login slice
│   ├── components/     # Login-specific components
│   │   └── index.ts
│   └── page.tsx       # Main login page
├── register/          # Register slice
│   ├── components/     # Register-specific components
│   │   └── index.ts
│   └── page.tsx       # Main register page
└── layout.tsx         # Feature layout
```

### React Project Output
Same structure but with `index.tsx` instead of `page.tsx` in slice folders.

## Generated Files Examples

### Service File (auth.service.ts)
```typescript
import type { 
    TAuthResponse, 
    IAuthProps 
} from '../../types';

export const authService = {
    fetchAuth: async (): Promise<TAuthResponse> => {
        try {
            // Implement your service method
            throw new Error('Not implemented');
        } catch (error) {
            console.error('Error in fetchAuth:', error);
            throw error;
        }
    },

    createAuth: async (data: IAuthProps): Promise<TAuthResponse> => {
        // ... CRUD operations
    },
    // ... more methods
};
```

### Types File (types/index.ts)
```typescript
export interface IAuthProps {
    // Add your props here
}

export interface IAuthState {
    // Add your state here
}

export type TAuthResponse = {
    // Add your response type here
};
```

### Next.js Slice Page (login/page.tsx)
```typescript
export default function LoginPage() {
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Login</h1>
        </div>
    );
}
```

### React Slice Page (login/index.tsx)
```typescript
import React from 'react';

function LoginPage() {
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Login</h1>
        </div>
    );
}

export default LoginPage;
```

## Best Practices

1. **Feature Naming**
    - Use lowercase
    - Use kebab-case for multi-word features
    - Examples: `auth`, `user-profile`, `order-management`

2. **Slice Naming**
    - Use descriptive names
    - Use kebab-case for multi-word slices
    - Examples: `login`, `reset-password`, `user-settings`

3. **File Organization**
    - Keep slice-specific components in slice folders
    - Share common components in root components folder
    - Use the types directory for all interfaces and types
    - Keep API calls in services

## Examples

### Authentication Feature
```bash
featslice auth login,register,reset-password,verify-email
```

### User Profile Feature
```bash
featslice user-profile personal-info,security,preferences,billing
```

### Order Management Feature
```bash
featslice order-management order-list,order-details,create-order
```

## Common Questions

### Q: Where should I run this command?
A: Run it in your project's `src` directory, typically in `src/features` or `src/modules`.

### Q: How do I add a new slice later?
A: Currently, you need to manually create the new slice following the same structure. Future versions will support adding slices to existing features.

### Q: Can I customize the templates?
A: The templates are currently fixed, but future versions will support custom templates.

## Contributing

Feel free to submit issues and PRs for:
- New features
- Bug fixes
- Documentation improvements
- Template enhancements

## License

MIT