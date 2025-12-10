# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **EkaScribe TypeScript SDK** (`@eka-care/ekascribe-ts-sdk`) - a browser SDK for capturing and processing audio to generate structured medical documentation using Eka Care's voice transcription API.

## Build Commands

```bash
yarn build        # Clean and build (rm -rf dist && vite build)
yarn clean        # Remove dist directory
yarn lint         # Run ESLint on TypeScript files
```

## Architecture

### Entry Point & Singleton Pattern
- **Main entry**: `eka-sdk/ekascribe-v2rx/index.ts`
- `EkaScribe` class uses singleton pattern via `getEkaScribeInstance({ access_token, env, clientId })`
- The singleton manages three core components: `VadWebClient`, `AudioFileManager`, and `AudioBufferManager`

### Directory Structure
```
eka-sdk/ekascribe-v2rx/
├── index.ts                 # Main EkaScribe class, all public SDK methods
├── store/store.ts           # EkaScribeStore singleton for shared state
├── constants/
│   ├── types.ts             # TypeScript type definitions
│   ├── enums.ts             # Error codes, callback types
│   └── constant.ts          # Audio config constants (sampling rate, buffer size)
├── api/                     # API call implementations
│   ├── config/              # Configuration endpoints
│   ├── transaction/         # Transaction lifecycle (init, commit, stop, status)
│   ├── templates/           # Template CRUD operations
│   └── template-sections/   # Template section CRUD operations
├── main/                    # Recording lifecycle methods
│   ├── init-transaction.ts
│   ├── start-recording.ts
│   ├── pause-recording.ts
│   ├── resume-recording.ts
│   ├── end-recording.ts
│   └── retry-upload-recording.ts
├── audio-chunker/           # Audio processing
│   ├── vad-web.ts           # Voice Activity Detection client
│   ├── audio-buffer-manager.ts
│   └── audio-file-manager.ts
├── aws-services/            # S3 upload with retry logic
├── fetch-client/            # HTTP client with auth handling
└── shared-worker/           # SharedWorker for background uploads
```

### Key Patterns
- **State management**: `EkaScribeStore` (singleton) holds transaction ID, session status, callbacks, and references to audio managers
- **Callbacks**: Register via `onEventCallback`, `onUserSpeechCallback`, `onVadFramesCallback` for SDK events
- **Transaction flow**: `initTransaction` → `startRecording` → `pauseRecording`/`resumeRecording` → `endRecording` → `getTemplateOutput`

### Build Configuration
- **Vite** library mode targeting ES modules
- Entry: `eka-sdk/ekascribe-v2rx/index.ts` → `dist/index.mjs`
- Worker bundled separately as IIFE: `dist/worker.bundle.js`
- TypeScript declarations via `vite-plugin-dts`

## Development Notes

- Source files are in `eka-sdk/` (not `src/`)
- Uses `@ricky0123/vad-web` for Voice Activity Detection
- Uses AWS SDK for S3 uploads with retry wrapper
- SharedWorker handles background audio uploads to reduce main thread load
