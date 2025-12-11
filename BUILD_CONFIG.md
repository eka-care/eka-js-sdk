# Build Configuration Documentation

This document explains the build configuration in `package.json` and `tsconfig.json`.

---

## package.json

### Package Identity & Entry Points

```jsonc
{
  "name": "@eka-care/ekascribe-ts-sdk",  // Scoped npm package name
  "version": "1.5.78",

  // Entry points for different module systems:
  "main": "dist/index.mjs",     // Legacy field - Node.js CommonJS entry (but we use ESM)
  "module": "dist/index.mjs",   // Bundlers (Webpack, Rollup) use this for ES modules
  "types": "dist/index.d.ts",   // TypeScript declaration file location
```

### Exports Map (Modern Node.js Resolution)

```jsonc
  "exports": {
    ".": {
      // When someone does: import { getEkaScribeInstance } from '@eka-care/ekascribe-ts-sdk'
      "types": "./dist/index.d.ts",   // TypeScript looks here for types
      "import": "./dist/index.mjs",   // ESM import gets this file
      "default": "./dist/index.mjs"   // Fallback for other resolution
    },
    // Sub-path export for the worker bundle
    // Usage: import '@eka-care/ekascribe-ts-sdk/worker'
    "./worker": "./dist/worker.bundle.js"
  },
```

### Scripts

```jsonc
  "scripts": {
    "clean": "rm -rf dist",           // Remove build artifacts
    "build": "yarn clean && vite build", // Clean then build with Vite
    "prepare": "yarn build",          // Auto-runs before npm publish & after npm install from git
    "lint": "eslint . --ext .ts"      // Lint TypeScript files
  },
```

### Publish Configuration

```jsonc
  "publishConfig": {
    "access": "public"  // Required for scoped packages (@eka-care/*) to be public on npm
  },
```

### Dependencies (all devDependencies)

```jsonc
  "devDependencies": {
    // AWS services - S3 uploads and text translation
    "@aws-sdk/client-translate": "^3.857.0",
    "aws-sdk": "^2.1692.0",

    // Audio processing
    "@breezystack/lamejs": "^1.2.7",     // MP3 encoding
    "@ricky0123/vad-web": "^0.0.22",     // Voice Activity Detection

    // TypeScript & Linting
    "@types/node": "^22.14.1",
    "@typescript-eslint/eslint-plugin": "^8.30.1",
    "@typescript-eslint/parser": "^8.30.1",
    "eslint": "^9.25.0",
    "typescript": "^5.8.3",

    // Build tooling
    "vite": "^7.2.6",
    "vite-plugin-dts": "^4.5.4"  // Generates .d.ts declaration files
  },
```

**Note**: All dependencies are `devDependencies` because Vite bundles everything into the output. Consumers don't need to install these separately.

### Files Included in npm Package

```jsonc
  "files": [
    "dist",       // Built output (index.mjs, index.d.ts, worker.bundle.js)
    "README.md",  // Documentation
    "LICENSE"     // MIT license
  ]
```

---

## tsconfig.json

### Compiler Options

```jsonc
{
  "compilerOptions": {
    // JavaScript version for output - ES2020 has good browser support
    // Includes optional chaining (?.), nullish coalescing (??), BigInt, etc.
    "target": "ES2020",

    // Type definitions to include:
    // - esnext: Latest ECMAScript features
    // - DOM: Browser APIs (window, document, fetch, etc.)
    // - ES2020: ES2020 built-ins (Promise.allSettled, etc.)
    // - DOM.Iterable: forEach, entries(), etc. on DOM collections
    "lib": ["esnext", "DOM", "ES2020", "DOM.Iterable"],

    // Use ES2022 class field semantics (affects how class properties are defined)
    "useDefineForClassFields": true,

    // Output module format - esnext allows dynamic import() and top-level await
    "module": "esnext",

    // Module resolution strategy optimized for bundlers (Vite, Webpack, etc.)
    // Understands package.json "exports" field
    "moduleResolution": "bundler",

    // Generate .d.ts declaration files (also handled by vite-plugin-dts)
    "declaration": true,

    // Strict type checking - catches more errors at compile time
    "strict": true,

    // Error on unused local variables
    "noUnusedLocals": true,

    // Error on unused function parameters
    "noUnusedParameters": true,

    // Error if switch case falls through without break
    "noFallthroughCasesInSwitch": true,

    // Error on imports that are only used for side effects but aren't marked as such
    "noUncheckedSideEffectImports": true,

    // Skip type checking of declaration files in node_modules (faster builds)
    "skipLibCheck": true
  },
```

### File Inclusion

```jsonc
  // Only compile TypeScript files in eka-sdk directory
  "include": [
    "eka-sdk/**/*.ts"
  ],

  // Don't compile node_modules (handled separately by bundler)
  "exclude": [
    "node_modules"
  ]
}
```

---

## Build Output

After running `yarn build`, the `dist/` folder contains:

```
dist/
├── index.mjs          # Main SDK bundle (ES module)
├── index.d.ts         # TypeScript declarations
└── worker.bundle.js   # SharedWorker for background uploads (IIFE)
```


In this SDK directory:
  yarn build      # Build the SDK first
  yarn link       # Create a global symlink

  In the EkaScribe web project:
  yarn link @eka-care/ekascribe-ts-sdk

  This will make the web project use your local SDK instead of the published npm package.

  ---
  To unlink later:
  # In the web project
  yarn unlink @eka-care/ekascribe-ts-sdk
  yarn install --force  # Reinstall from npm

  # In the SDK (optional cleanup)
  yarn unlink

  ---
  Note: After making changes to the SDK, you'll need to run yarn build again for the web project to pick up the changes.

────────────