# Implementation Plan - EkaScribe SDK v3

## Overview

| Task | What | Depends on |
|------|------|------------|
| 1 | **Transport Layer** — `ITransport`, `HttpTransport`, `IpcTransport` | — |
| 2 | **Callback Registry** — consumer-facing, bridges Alliance SDK | — |
| 3 | **Tracker** — Sentry abstraction (swappable later) | — |
| 4 | **Refactor API functions** — all `api/` files to use transport instead of fetchWrapper | 1 |
| 5 | **DocumentManager** — templates, sections, documents | 1, 4 |
| 6 | **SessionUtils** — session CRUD, config, profile + Alliance SDK methods | 1, 4 |
| 7 | **SystemCompatibilityManager** — refactor test 5 to ping-only, use transport | 1 |
| 8 | **EkaScribe main class** — recording (Alliance SDK), deprecated methods, output, callbacks, auth, lifecycle | 1-7 |
| 9 | **Entry point + exports** — rewrite `index.ts` with factory + re-exports | 8 |
| 10 | **Cleanup** — delete old files, add Alliance SDK dependency | 9 |
| 11 | **Build verification** — `yarn build`, fix errors | 10 |

---

## Task Details

Tasks are ordered by dependency — each builds on the previous.

### Task 1: Transport Layer
Create `transport/` directory with `ITransport` interface, `HttpTransport`, and `IpcTransport` implementations.

**Files:**
- `eka-sdk/ekascribe-v2rx/transport/transport.interface.ts`
- `eka-sdk/ekascribe-v2rx/transport/http-transport.ts`
- `eka-sdk/ekascribe-v2rx/transport/ipc-transport.ts`

**Depends on:** Nothing

---

### Task 2: Callback Registry
Create `callbacks/callback-registry.ts` — consumer-facing callback registry that bridges Alliance SDK callbacks.

**Files:**
- `eka-sdk/ekascribe-v2rx/callbacks/callback-registry.ts`

**Depends on:** Nothing

---

### Task 3: Tracker
Create `tracker/tracker.ts` — Sentry abstraction (init, setUser, addBreadcrumb, captureEvent, captureError).

**Files:**
- `eka-sdk/ekascribe-v2rx/tracker/tracker.ts`

**Depends on:** Nothing

---

### Task 4: Refactor API functions to use transport
Update all `api/` files to accept `transport: ITransport` and `baseUrl: string` instead of using `fetchWrapper` + `helper.ts` globals.

**Files:** All files in `api/templates/`, `api/template-sections/`, `api/documents/`, `api/config/`, `api/profile/`, `api/session/` (renamed from `api/transaction/`)

**Depends on:** Task 1

---

### Task 5: DocumentManager
Create `managers/document-manager.ts` with all template, template section, and document methods.

**Files:**
- `eka-sdk/ekascribe-v2rx/managers/document-manager.ts`

**Depends on:** Task 1, Task 4

---

### Task 6: SessionUtils
Create `managers/session-utils.ts` with session CRUD, config, profile methods + Alliance SDK's `createSession`/`getSessionStatus`.

**Files:**
- `eka-sdk/ekascribe-v2rx/managers/session-utils.ts`

**Depends on:** Task 1, Task 4

---

### Task 7: SystemCompatibilityManager refactor
Move to `compatibility/system-compatibility-manager.ts`. Refactor test 5 to ping-only (remove S3 upload + AWS config). Update to use transport instead of fetchWrapper.

**Files:**
- `eka-sdk/ekascribe-v2rx/compatibility/system-compatibility-manager.ts`

**Depends on:** Task 1

---

### Task 8: EkaScribe main class
Create `ekascribe.ts` — constructor wiring (transport, Alliance ScribeClient, managers, callbacks, tracker), recording methods (delegating to Alliance SDK), deprecated methods, output methods, callback registration, auth, compatibility, lifecycle.

**Files:**
- `eka-sdk/ekascribe-v2rx/ekascribe.ts`

**Depends on:** Tasks 1-7

---

### Task 9: Entry point + exports
Rewrite `index.ts` — `getEkaScribeInstance()` factory, type re-exports, enum re-exports.

**Files:**
- `eka-sdk/ekascribe-v2rx/index.ts`

**Depends on:** Task 8

---

### Task 10: Cleanup
Delete old files that are no longer needed (audio-chunker/, aws-services/, shared-worker/, fetch-client/, store/, main/, sentry/, old utils, api/post-cog-init.ts). Update constants (remove audio constants from constant.ts). Update package.json to add `med-scribe-alliance-ts-sdk` dependency.

**Depends on:** Task 9

---

### Task 11: Build verification
Run `yarn build` and fix any TypeScript/build errors.

**Depends on:** Task 10
