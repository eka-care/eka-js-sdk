# EkaScribe SDK v3 - Architecture

## Overview

EkaScribe SDK v3 is a revamped architecture that delegates all recording/audio infrastructure to the **medScribeAlliance-ts-sdk** (Alliance SDK) as an npm dependency, while keeping Eka-specific features (templates, documents, sessions, config, profile) in its own transport layer.

### Key Principles

- **Alliance SDK = recording abstraction only** (session creation, start/pause/resume/stop, audio chunking, VAD, uploads, polling)
- **eka-js-sdk = Eka-specific features** (templates, documents, session utils, config, profile, compatibility)
- **Two independent SDKs** with independent transport layers
- **Single coordination point** for auth token management
- **Factory pattern** — export `getEkaScribeInstance()`, never the class

---

## Directory Structure

```
eka-sdk/ekascribe-v2rx/
├── index.ts                              # getEkaScribeInstance() factory, type/enum re-exports
├── ekascribe.ts                          # EkaScribe class (recording orchestration + entry point)
│
├── managers/
│   ├── document-manager.ts               # Templates, template sections, documents CRUD
│   └── session-utils.ts                  # Session, config, profile, clinical APIs
│
├── transport/
│   ├── transport.interface.ts            # ITransport, TransportRequest, TransportResponse
│   ├── http-transport.ts                 # HTTP implementation with 401 auto-retry
│   └── ipc-transport.ts                  # IPC implementation (Electron/desktop)
│
├── callbacks/
│   └── callback-registry.ts             # Consumer callback registry, bridges Alliance SDK
│
├── tracker/
│   └── tracker.ts                        # Error/event tracking abstraction (Sentry now, swappable)
│
├── compatibility/
│   └── system-compatibility-manager.ts   # 5 system tests (test 5 = ping API only)
│
├── api/                                  # Raw API call functions (all use eka transport)
│   ├── templates/
│   │   ├── get-v1-templates.ts
│   │   ├── post-v1-template.ts
│   │   ├── patch-v1-template.ts
│   │   ├── delete-v1-template.ts
│   │   ├── cook-v1-medai-ai-create-template.ts
│   │   └── post-convert-transcription-to-template.ts
│   ├── template-sections/
│   │   ├── get-v1-template-sections.ts
│   │   ├── post-v1-template-section.ts
│   │   ├── patch-v1-template-section.ts
│   │   └── delete-v1-template-section.ts
│   ├── documents/
│   │   ├── get-v1-document.ts
│   │   ├── post-v1-document.ts
│   │   ├── delete-v1-document.ts
│   │   └── post-v1-sessions-document-publish.ts
│   ├── config/
│   │   ├── get-voice-api-v2-config.ts
│   │   ├── get-voice-api-v2-config-my-templates.ts
│   │   ├── get-voice-api-v2-config-timezone.ts
│   │   └── patch-voice-api-v2-config.ts
│   ├── profile/
│   │   ├── get-doctor-header-footer.ts
│   │   └── get-doctor-clinics.ts
│   └── session/
│       ├── get-transaction-history.ts
│       ├── patch-transaction-status.ts
│       ├── delete-transaction.ts
│       ├── get-v1-session-details.ts
│       ├── get-chunk-transcript.ts
│       ├── get-v1-session-suggested-medications.ts
│       ├── patch-session-context.ts
│       ├── delete-session-context.ts
│       ├── patch-voice-api-v3-status.ts
│       ├── get-voice-api-v3-status.ts
│       ├── get-voice-api-v3-status-transcript.ts
│       ├── post-transaction-stop.ts          # kept for deprecated stopTransactionCall
│       ├── post-transaction-commit.ts        # kept for deprecated commitTransactionCall
│       └── post-transaction-convert-to-template.ts
│
├── constants/
│   ├── types.ts                          # All type definitions (backward compatible)
│   └── enums.ts                          # Error codes, callback types, compatibility enums
│
└── utils/
    └── template-value.ts                 # Base64 decode utility
```

---

## Deleted Files (moved to Alliance SDK)

| File/Directory | Reason |
|---|---|
| `audio-chunker/vad-web.ts` | Alliance SDK owns VAD |
| `audio-chunker/audio-buffer-manager.ts` | Alliance SDK owns audio buffering |
| `audio-chunker/audio-file-manager.ts` | Alliance SDK owns chunk tracking + uploads |
| `aws-services/s3-upload-service.ts` | Alliance SDK owns S3 uploads |
| `aws-services/configure-aws.ts` | Alliance SDK owns AWS credentials |
| `shared-worker/s3-file-upload.ts` | Alliance SDK owns SharedWorker |
| `utils/compress-mp3-audio.ts` | Alliance SDK owns MP3 encoding |
| `utils/search-past-sessions.ts` | Removed (client-side search, not SDK concern) |
| `utils/get-worker-url.ts` | Alliance SDK owns worker URL resolution |
| `fetch-client/index.ts` | Replaced by transport layer |
| `fetch-client/helper.ts` | Replaced by transport config |
| `store/store.ts` | State lives on class instances |
| `main/init-transaction.ts` | Alliance SDK `createSession` |
| `main/start-recording.ts` | Alliance SDK `startRecording` |
| `main/end-recording.ts` | Alliance SDK `endRecording` |
| `main/pause-recording.ts` | Alliance SDK `pauseRecording` |
| `main/resume-recording.ts` | Alliance SDK `resumeRecording` |
| `main/retry-upload-recording.ts` | Alliance SDK `retryFailedUploads` |
| `main/poll-output-summary.ts` | Alliance SDK `pollForCompletion` |
| `main/start-recording-for-existing-session.ts` | Alliance SDK `startRecordingWithSession` |
| `main/upload-full-audio-with-presigned-url.ts` | Alliance SDK single-file upload (`uploadType: 'single'`) |
| `api/transaction/post-transaction-init.ts` | Alliance SDK `createSession` |
| `api/post-cog-init.ts` | S3 credentials not needed |
| `sentry/index.ts` | Replaced by `tracker/tracker.ts` abstraction |

---

## Class Design

### 1. EkaScribe (ekascribe.ts)

Main class. Handles recording orchestration (delegating to Alliance SDK), deprecated methods, output fetching, callbacks, auth, and compatibility testing.

```
EkaScribe
├── private allianceClient: ScribeClient
├── private transport: ITransport
├── private callbackRegistry: CallbackRegistry
├── private tracker: Tracker
├── readonly documents: DocumentManager
├── readonly sessions: SessionUtils
│
├── Recording (Alliance SDK)
│   ├── initTransaction(request)
│   ├── startRecording(microphoneID?)
│   ├── startRecordingForExistingSession(request)
│   ├── pauseRecording()
│   ├── resumeRecording()
│   ├── endRecording()
│   ├── retryUploadRecording()
│   └── discardSession(request)
│
├── Deprecated (eka transport directly)
│   ├── commitTransactionCall()          @deprecated
│   └── stopTransactionCall()            @deprecated
│
├── Output (eka transport)
│   ├── getTemplateOutput({ txn_id })
│   ├── getOutputTranscription({ txn_id })
│   ├── getChunkTranscript(txnId, chunkNumber)
│   └── pollForCompletion(sessionId, options?)    # Alliance SDK
│
├── Callbacks
│   ├── registerCallback(name, handler)
│   └── removeCallback(name, handler)
│
├── Auth
│   └── setAccessToken(token)
│
├── Compatibility
│   └── runSystemCompatibilityTest(callback, sharedWorker?)
│
└── Lifecycle
    └── resetInstance()
```

### 2. DocumentManager (managers/document-manager.ts)

Accessed via `eka.documents.*`. Uses eka's own transport for all API calls.

```
DocumentManager
├── constructor(transport: ITransport)
│
├── Templates
│   ├── getAllTemplates()
│   ├── createTemplate(request)
│   ├── updateTemplate(request)
│   ├── deleteTemplate(templateId)
│   ├── aiGenerateTemplate(formData)
│   ├── convertTranscriptionToTemplate(request)
│   └── convertToTemplate(request)
│
├── Template Sections
│   ├── getAllTemplateSections()
│   ├── createTemplateSection(request)
│   ├── updateTemplateSection(request)
│   └── deleteTemplateSection(sectionId)
│
└── Documents
    ├── getDocument(documentId)
    ├── createDocument(request)
    ├── updateDocument(request)
    ├── deleteDocument(documentId)
    └── publishDocument(request)
```

### 3. SessionUtils (managers/session-utils.ts)

Accessed via `eka.sessions.*`. Uses eka's transport for Eka-specific APIs and Alliance ScribeClient for session creation/status.

```
SessionUtils
├── constructor(transport: ITransport, allianceClient: ScribeClient)
│
├── Session (Alliance SDK)
│   ├── createSession(request)              # standalone, no recording
│   └── getSessionStatus(sessionId)
│
├── Session CRUD (eka transport)
│   ├── getSessionHistory({ txn_count, oid })
│   ├── deleteSession({ txn_id })           # delete past session from server
│   ├── patchSessionStatus(request)
│   └── getSessionDetails({ session_id, presigned })
│
├── Session Data (eka transport)
│   ├── getSuggestedMedications(txnId)
│   ├── addSessionContext({ txn_id, context })
│   ├── removeSessionContext({ txn_id, context })
│   └── updateResultSummary(request)
│
├── Config (eka transport)
│   ├── getConfig()
│   ├── getConfigMyTemplates()
│   └── updateConfig(request)
│
└── Profile (eka transport)
    ├── getDoctorHeaderFooter(request)
    └── getDoctorClinics(request)
```

---

## Transport Layer

### Interface

```typescript
interface ITransport {
  request<T>(config: TransportRequest): Promise<TransportResponse<T>>;
  setAuthToken(token: string): void;
}

interface TransportRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

interface TransportResponse<T> {
  status: number;
  data: T;
  headers?: Record<string, string>;
}
```

### HttpTransport

- Auto-injects: `Authorization: Bearer {token}`, `client-id`, `flavour` headers
- 401 handling: dispatches `onTokenRequired` callback -> gets new token -> updates own transport + `allianceClient.setAccessToken()` -> retries request once
- 403: returns error, no retry
- Configurable timeout

### IpcTransport

- Correlation-ID based request/response via IpcBridge
- Same 401/403 handling as HttpTransport
- 15s default timeout

---

## Configuration

```typescript
interface EkaScribeConfig {
  accessToken: string;
  baseUrl: string;                    // e.g. "https://api.eka.care"
  clientId?: string;
  mode?: 'http' | 'ipc';             // transport mode, default 'http'
  ipcBridge?: IpcBridge;              // required when mode === 'ipc'
  enableTracking?: boolean;           // Sentry tracking, default false
  flavour?: string;                   // user identity for tracking
  allianceConfig?: {
    baseUrl?: string;                 // defaults to same baseUrl
    useWorker?: boolean | 'auto';
    debug?: boolean;
  };
}
```

---

## Flow Diagrams

### Recording Flow

```
Consumer                    EkaScribe                   Alliance SDK
  │                            │                            │
  ├─ initTransaction(req) ────>│                            │
  │                            ├─ allianceClient.reset() ──>│  (clear previous state)
  │                            ├─ massage request ──────────│
  │                            ├─ createSession(massaged) ─>│
  │                            │<── CreateSessionResponse ──│
  │<── TPostTransactionResp ───│  (massage response back)   │
  │                            │                            │
  ├─ startRecording(micID) ───>│                            │
  │                            ├─ startRecording(deviceId) >│
  │                            │<── SDKResult<void> ────────│
  │<── response ───────────────│                            │
  │                            │                            │
  ├─ pauseRecording() ────────>│                            │
  │                            ├─ pauseRecording() ────────>│
  │                            │                            │
  ├─ resumeRecording() ───────>│                            │
  │                            ├─ resumeRecording() ───────>│
  │                            │                            │
  ├─ endRecording() ──────────>│                            │
  │                            ├─ endRecording() ──────────>│
  │                            │<── SDKResult<StopResult> ──│
  │<── response ───────────────│                            │
  │                            │  (state preserved for      │
  │                            │   retry/getFiles)          │
  │                            │                            │
  ├─ retryUploadRecording() ──>│                            │
  │                            ├─ retryFailedUploads() ────>│
  │                            │<── SDKResult<RetryResult> ─│
  │<── response ───────────────│                            │
```

### Discard Session Flow

```
Consumer                    EkaScribe                Alliance SDK         Eka Transport
  │                            │                        │                     │
  ├─ discardSession(req) ─────>│                        │                     │
  │                            ├─ discardSession() ────>│ (dummy for now)     │
  │                            ├─ patchSessionStatus ───│─────────────────────>│
  │                            │<── patch response ─────│─────────────────────│
  │                            ├─ allianceClient.reset()>│                    │
  │<── response ───────────────│                        │                     │
```

### Existing Session Recording Flow

```
Consumer                          EkaScribe                     Alliance SDK
  │                                  │                              │
  ├─ startRecordingForExisting ─────>│                              │
  │   (txn_id, business_id,         │                              │
  │    created_at, micID)            │                              │
  │                                  ├─ allianceClient.reset() ───>│
  │                                  ├─ construct CreateSession    │
  │                                  │   Response from existing     │
  │                                  │   data (txn_id, bucket path) │
  │                                  ├─ startRecordingWithSession ─>│
  │                                  │   (constructedSession, opts) │
  │                                  │<── SDKResult<void> ──────────│
  │<── response ─────────────────────│                              │
```

### 401/403 Error Handling Flow

```
                       ┌──────────────────────────────────────────────────────────┐
                       │               401 from Alliance SDK                      │
                       ├──────────────────────────────────────────────────────────┤
                       │                                                          │
                       │  Alliance transport gets 401                             │
                       │       │                                                  │
                       │       v                                                  │
                       │  Alliance dispatches 'onTokenRequired'                   │
                       │       │                                                  │
                       │       v                                                  │
                       │  EkaScribe's internal listener fires                     │
                       │       │                                                  │
                       │       v                                                  │
                       │  Dispatches consumer's 'onTokenRequired' callback        │
                       │       │                                                  │
                       │       v                                                  │
                       │  Consumer returns new token                              │
                       │       │                                                  │
                       │       ├── eka transport.setAuthToken(newToken)            │
                       │       ├── allianceClient.setAccessToken(newToken)         │
                       │       └── resolve(newToken) → Alliance auto-retries      │
                       │                                                          │
                       └──────────────────────────────────────────────────────────┘

                       ┌──────────────────────────────────────────────────────────┐
                       │               401 from Eka Transport                     │
                       ├──────────────────────────────────────────────────────────┤
                       │                                                          │
                       │  Eka HttpTransport gets 401                              │
                       │       │                                                  │
                       │       v                                                  │
                       │  Dispatches consumer's 'onTokenRequired' callback        │
                       │       │                                                  │
                       │       v                                                  │
                       │  Consumer returns new token                              │
                       │       │                                                  │
                       │       ├── eka transport.setAuthToken(newToken)            │
                       │       ├── allianceClient.setAccessToken(newToken)         │
                       │       └── retries original request once                  │
                       │                                                          │
                       └──────────────────────────────────────────────────────────┘

                       ┌──────────────────────────────────────────────────────────┐
                       │               403 from either transport                  │
                       ├──────────────────────────────────────────────────────────┤
                       │                                                          │
                       │  Returns error to consumer. No retry. No token refresh.  │
                       │                                                          │
                       └──────────────────────────────────────────────────────────┘
```

### Callback Flow

```
Consumer                     EkaScribe                    Alliance SDK
  │                             │                             │
  │  Registration:              │                             │
  ├─ registerCallback ─────────>│                             │
  │  ('onRecordingStateChange', │                             │
  │   handler)                  ├─ registerCallback ─────────>│  (forwarded)
  │                             │  ('onRecordingStateChange', │
  │                             │   handler)                  │
  │                             │                             │
  ├─ registerCallback ─────────>│                             │
  │  ('onTokenRequired',        │                             │
  │   handler)                  ├─ stored in eka registry     │
  │                             │  (NOT forwarded)            │
  │                             │                             │
  │  Constructor wiring:        │                             │
  │                             ├─ registerCallback ─────────>│
  │                             │  ('onTokenRequired',        │
  │                             │   internalBridgeHandler)    │
  │                             │                             │
  │  At runtime:                │                             │
  │                             │<── onTokenRequired ─────────│  (Alliance fires)
  │                             │                             │
  │<── onTokenRequired ─────────│  (eka dispatches to consumer)
  │                             │                             │
  │── returns newToken ────────>│                             │
  │                             ├─ setAccessToken (both) ────>│
  │                             ├─ resolve(newToken) ────────>│  (Alliance retries)
```

### Instance Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Instance Lifecycle                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  getEkaScribeInstance(config)                                        │
│  ├── Creates singleton (first call)                                  │
│  │   ├── transport ────────── persists across recordings             │
│  │   ├── allianceClient ──── persists, internal state resets         │
│  │   ├── callbackRegistry ── persists across recordings              │
│  │   ├── tracker ──────────── persists                               │
│  │   ├── documents ────────── persists                               │
│  │   └── sessions ─────────── persists                               │
│  │                                                                   │
│  └── Returns existing singleton (subsequent calls)                   │
│      └── If config changed (baseUrl/clientId) → destroy + recreate   │
│                                                                      │
│  Recording 1:                                                        │
│  ├── initTransaction() ──> allianceClient.reset() ──> createSession  │
│  ├── startRecording()                                                │
│  ├── endRecording()                                                  │
│  └── (state preserved: retryUploadRecording still works)             │
│                                                                      │
│  Recording 2:                                                        │
│  ├── initTransaction() ──> allianceClient.reset() ← wipes rec 1     │
│  ├── startRecording()                                                │
│  └── ...                                                             │
│                                                                      │
│  Discard:                                                            │
│  ├── discardSession() ──> allianceClient.discardSession() (dummy)    │
│  │                    ──> patchSessionStatus (eka transport)          │
│  │                    ──> allianceClient.reset()                      │
│  └── Ready for next initTransaction                                  │
│                                                                      │
│  Full teardown:                                                      │
│  └── resetInstance() ──> allianceClient.reset()                      │
│                      ──> callbackRegistry.removeAll()                │
│                      ──> singleton = null                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tracker (Sentry Abstraction)

```typescript
class Tracker {
  constructor(enabled: boolean, env: string)

  init(env: string)
  setUser(userId: string)
  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>)
  captureEvent(message: string, data?: Record<string, unknown>)
  captureError(error: Error)
}
```

Wraps Sentry today. Swap implementation later without touching any other class.

---

## SystemCompatibilityManager

5 sequential tests:

| # | Test | What it checks |
|---|------|----------------|
| 1 | Internet Connectivity | `navigator.onLine` + fetch google favicon |
| 2 | System Info | Browser detection, timezone validation against server |
| 3 | Microphone Permission | `getUserMedia({ audio: true })` |
| 4 | SharedWorker Support | `typeof SharedWorker` + worker communication test |
| 5 | Network & API Access | **Ping API only** (no S3 upload, no AWS config) |

---

## TODOs (deferred decisions)

1. **SDKResult pattern** — whether to adopt `{success, data}` | `{success: false, error}` for all public methods
2. **Alliance SDK `discardSession()`** — dummy for now, Alliance SDK will add the real method
3. **`uploadAudioWithPresignedUrl`** — use Alliance SDK's single-file upload flow (`uploadType: 'single'`)
