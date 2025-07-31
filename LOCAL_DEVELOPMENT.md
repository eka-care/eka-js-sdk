# Local Development Guide for EkaScribe SDK

This guide explains how to use the EkaScribe SDK locally in another TypeScript project without publishing to npm.

## Method 1: Using Yarn Link (Recommended for Development)

### Step 1: Build and Link the SDK
```bash
# In the SDK directory
yarn build
yarn link
```

### Step 2: Use in Another Project
```bash
# In your project directory
yarn link ekascribe-ts-sdk
```

### Step 3: Import and Use
```typescript
// In your TypeScript project
import { 
  getEkaScribeInstance, 
} from 'ekascribe-ts-sdk';

// Initialize the SDK
const sdk = getEkaScribeInstance({ access_token: 'your-token' });

```

### Step 4: Unlink When Done
```bash
# In your project directory
yarn unlink ekascribe-ts-sdk
```

## Method 2: Using Local Path (Alternative)

### Step 1: Build the SDK
```bash
# In the SDK directory
yarn build
```

### Step 2: Add to Your Project's package.json
```json
{
  "dependencies": {
    "ekascribe-ts-sdk": "file:../path/to/eka-js-sdk"
  }
}
```

### Step 3: Install
```bash
yarn install
```

## Method 3: Using npm pack (For Testing)

### Step 1: Create a Package
```bash
# In the SDK directory
yarn build
npm pack
```

### Step 2: Install the .tgz File
```bash
# In your project directory
yarn add /path/to/ekascribe-ts-sdk-1.3.33.tgz
```

## Available Exports

### Singleton Instance
```typescript
import { getEkaScribeInstance } from 'ekascribe-ts-sdk';

const sdk = getEkaScribeInstance({ access_token: 'your-token' });
```

## Development Workflow

1. **Make changes** to the SDK code
2. **Build** the SDK: `yarn build`
3. **Test** in your project (changes are automatically reflected if using yarn link)
4. **Repeat** as needed

## Troubleshooting

### TypeScript Issues
- Make sure your project's `tsconfig.json` includes the SDK types
- You might need to restart your TypeScript server in your IDE

### Build Issues
- Ensure all dependencies are installed: `yarn install`
- Check that the build output is in the `dist/` directory

### Import Issues
- Verify the package name in your project's `package.json`
- Try clearing node_modules and reinstalling: `rm -rf node_modules && yarn install` 