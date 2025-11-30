# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EkaScribe TypeScript SDK (`@eka-care/ekascribe-ts-sdk`) for capturing and processing audio to generate structured medical documentation using Eka Care's voice transcription API. The SDK provides voice activity detection (VAD), audio chunking, S3 uploads, and template management for medical prescriptions.

## Build Commands

```bash
yarn build        # Compile TypeScript and copy shared-worker files to dist/
yarn lint         # Run ESLint on .ts files
yarn start        # Run the main index.ts with ts-node
```

## Architecture

### Entry Point
- `eka-sdk/ekascribe-v2rx/index.ts` - Main `EkaScribe` class (singleton pattern)
- Export: `getEkaScribeInstance({ access_token, env, clientId })`

### Core Modules

**audio-chunker/** - Audio processing
- `vad-web.ts` - Voice Activity Detection using @ricky0123/vad-web
- `audio-buffer-manager.ts` - Manages audio sample buffers
- `audio-file-manager.ts` - Tracks audio chunks and upload status

**main/** - Recording lifecycle
- `init-transaction.ts` - Initialize a transcription session
- `start-recording.ts` - Begin audio capture
- `pause-recording.ts` / `resume-recording.ts` - Pause/resume
- `end-recording.ts` - Stop recording and trigger uploads
- `retry-upload-recording.ts` - Retry failed S3 uploads

**api/** - Backend API calls
- `transaction/` - Init, commit, stop, status, history
- `templates/` - CRUD operations for output templates
- `template-sections/` - CRUD for template sections
- `config/` - Fetch/update SDK configuration

**aws-services/** - S3 operations
- `upload-file-to-s3.ts` - Upload audio files with presigned URLs
- `s3-retry-wrapper.ts` - Retry logic for failed uploads

**store/store.ts** - Singleton state store (`EkaScribeStore`) holding:
- Transaction ID, session status, bucket path
- VAD, AudioFileManager, AudioBufferManager instances
- Callbacks for events, speech detection, VAD frames

**shared-worker/** - Web Worker for S3 uploads (copied to dist/ on build)

### Key Patterns
- Singleton pattern for `EkaScribe` class and `EkaScribeStore`
- Callback-based event system (`onEventCallback`, `onUserSpeechCallback`, `onVadFramesCallback`)
- Audio processing: VAD frames -> AudioBuffer -> MP3 chunks -> S3 upload

## TypeScript Configuration
- Target: ES2020
- Module: ESNext with bundler resolution
- Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`
- Source: `eka-sdk/**/*.ts` -> Output: `dist/`

## Local Development
See `LOCAL_DEVELOPMENT.md` for yarn link workflow to test SDK in other projects.
