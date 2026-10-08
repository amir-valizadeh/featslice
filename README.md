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

### Custom Output Directory & Auto-Detection

By default, FeatSlice will automatically detect common feature directories if they exist in your project (`src/features`, `src/modules`, `features`, or `modules`).

You can also explicitly specify a target directory using the `--output` or `-o` flag:
```bash
featslice auth login,register -o src/features
```
In interactive mode, FeatSlice will prompt for the target directory, pre-filled with the auto-detected location.

### Dry Run Mode

To preview the files and directories that will be created without actually modifying your filesystem, use the `--dry-run` or `-d` flag:
```bash
featslice auth login,register --dry-run
```

## How It Works

```
Command: featslice auth login,register --query
                     │
                     ▼
  1. Detect project type (Next.js / React) and feature directory (src/features)
  2. Load .featslicerc.json and custom templates (.featslice/templates)
  3. Apply stack presets (TanStack Query, Server Actions, Zustand, Tests)
                     │
                     ▼
  Scaffolded Feature:
  src/features/auth/
  ├── components/          # Shared components
  ├── hooks/               # Custom hooks & queries
  ├── types/               # TypeScript interfaces
  ├── utils/               # Utility functions
  ├── api/                 # API services / queries / actions
  ├── login/               # Slice: page and components
  ├── register/            # Slice: page and components
  └── layout.tsx           # Feature layout
```

## Feature Lifecycle & Management

FeatSlice includes dedicated subcommands to inspect, add, and clean up features and slices in your project:

### 1. Listing Features (`list`, `ls`)

Inspect existing features, their slices, shared folders, and active presets:

```bash
featslice list
# or using alias
featslice ls
```

**Options:**
- `-o, --output <dir>`: Specify a features directory to scan (defaults to configured/auto-detected directory).
- `--json`: Output features data as formatted JSON.

```bash
featslice list --json
```

**Terminal Output:**
```
Features (2 found):
├── auth (src/features/auth)
│   ├── Slices:
│   │   ├── login
│   │   └── register
│   ├── Shared: components, hooks, types, utils, services
│   └── Presets: [TanStack Query] [Server Actions]
│   
└── billing (src/features/billing)
    ├── Slices:
    │   └── invoices
    ├── Shared: components, types, store
    └── Presets: [Zustand]
```

### 2. Adding Slices (`add`)

Add one or more slices to an existing feature (or create the feature if it doesn't exist yet):

```bash
featslice add auth logout
featslice add users profile settings
featslice add posts editor,view --server-actions
```

Supports all generation flags including presets (`--query`, `--server-actions`, `--zustand`, `--with-tests`), output directory (`-o`), and `--dry-run`.

### 3. Removing Features & Slices (`remove`, `rm`)

Safely delete a single slice or an entire feature:

```bash
# Remove a specific slice only
featslice remove auth logout
featslice rm auth logout

# Remove an entire feature
featslice remove billing
featslice rm billing
```

**Options:**
- `-d, --dry-run`: Preview what would be removed without actually deleting files.
- `-y, --yes`: Skip interactive confirmation prompt.
- `-f, --force`: Force removal without prompt.
- `-o, --output <dir>`: Specify the features directory.

```bash
featslice remove auth old-slice --dry-run
featslice rm temporary-feature --yes
```

### Stack Presets & Advanced Flags

FeatSlice offers modern stack presets and flexible generation options:

- **TanStack Query (`--query`, `-q`)**: Generates type-safe React Query hooks and query keys factory (`api/queries/index.ts` and `use<Feature>Query.ts`).
  ```bash
  featslice users list,detail --query
  ```
- **Next.js Server Actions (`--server-actions`, `-a`)**: Generates `'use server'` type-safe server actions in `api/actions/index.ts`.
  ```bash
  featslice posts editor,view --server-actions
  ```
- **Zustand (`--zustand`, `-z`)**: Generates typed Zustand state management store boilerplate in `store/index.ts` and `store/use<Feature>Store.ts`.
  ```bash
  featslice cart checkout --zustand
  ```
- **Testing Scaffolding (`--with-tests`, `-t`)**: Generates unit and component tests using React Testing Library (`<slice>/<slice>.test.tsx`) as well as service/action method tests.
  ```bash
  featslice auth login,register --with-tests
  ```
- **Minimal Scaffolding (`--minimal`)**: Generates only `components/`, `types/`, and slice pages (skips `api/services/`, `constants/`, and `layout.tsx`).
  ```bash
  featslice quick-feature view --minimal
  ```
- **Skip Layout (`--no-layout`)**: Explicitly skip generating `layout.tsx`.
- **Skip Services (`--no-services`)**: Explicitly skip generating `api/services/`.
- **Force Overwrite (`--force`, `-f`)**: Overwrite existing files rather than skipping them.

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
A: You can run it from anywhere in your project! FeatSlice automatically detects if your project has a `src/features`, `src/modules`, or `features` folder. You can also pass `-o <path>` to place features anywhere you like.

### Q: How do I add a new slice later?
A: Simply run the command again with the same feature name and the new slice name. FeatSlice will add the new slice to your existing feature structure without overwriting existing files!

### Q: Can I customize the templates?
A: Yes! Run `featslice init` to create a `.featslicerc.json` config and a `.featslice/templates` directory with starter templates. Any file in `.featslice/templates` (e.g. `slice.tsx`, `service.ts`, `query.ts`, `types.ts`, `layout.tsx`) will automatically override the default templates. You can use placeholders like `{{featureName}}`, `{{PascalFeature}}`, `{{sliceName}}`, and `{{PascalSlice}}`.

## Contributing

Feel free to submit issues and PRs for:
- New features
- Bug fixes
- Documentation improvements
- Template enhancements

## License

MIT