# EkaScribe SDK Optimization Report

This document outlines optimization opportunities identified in the EkaScribe TypeScript SDK, with current status after review and fixes.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| **FIXED** | Issue identified and resolved |
| **NOT AN ISSUE** | Investigated — not actually a problem (see explanation) |
| **VALID (future)** | Real improvement but low priority / future work |

---

## Table of Contents

1. [Critical Issues (Memory Leaks & Stability)](#-critical-issues-memory-leaks--stability)
2. [High Priority (Bundle Size & Performance)](#-high-priority-bundle-size--performance)
3. [Medium Priority (Performance Optimization)](#-medium-priority-performance-optimization)
4. [Code Quality & Type Safety](#-code-quality--type-safety)
5. [API Design & Architecture](#-api-design--architecture)
6. [Dead Code & Duplication](#-dead-code--duplication)
7. [Additional Issues Found During Review](#-additional-issues-found-during-review)
8. [Summary of Changes](#summary-of-changes)

---

## 🔴 Critical Issues (Memory Leaks & Stability)

### 1. EventListener Accumulation in Polling Loop — `NOT AN ISSUE`

- **File:** `audio-chunker/audio-file-manager.ts`
- **Original claim:** `addEventListener` called repeatedly in polling loop without cleanup
- **Reality:** The listener uses `{ once: true }` which auto-removes after firing. No accumulation occurs.

### 2. Upload Promises Array Never Cleared — `NOT AN ISSUE`

- **File:** `audio-chunker/audio-file-manager.ts`
- **Original claim:** `uploadPromises[]` holds references indefinitely
- **Reality:** The array is session-scoped — it's cleared on `resetAudioFileManager()` which runs at end of every transaction. During a single recording session, holding references to pending uploads is correct behavior (needed for `waitForAllUploads`). Promises are lightweight once resolved.

### 3. AudioBuffer Expansion Creates New Allocations — `NOT AN ISSUE`

- **File:** `audio-chunker/audio-buffer-manager.ts`
- **Original claim:** `expandBuffer()` creates GC pressure via `new Float32Array()`
- **Reality:** This is the standard growing-array pattern. The buffer doubles each time, so expansions become exponentially rare. For a typical 15-minute session, expansion happens ~3-4 times total. A memory pool would add complexity for negligible gain.

### 4. No Callback Unsubscribe Mechanism — `NOT AN ISSUE`

- **File:** `index.ts`, `store/store.ts`
- **Original claim:** Callbacks persist causing memory leaks
- **Reality:** Callbacks are session-scoped and cleared on `resetEkaScribe()`. The SDK is a singleton with one active session at a time. Adding unsubscribe would increase API surface complexity for no practical benefit.

### 5. VAD State Arrays Grow Indefinitely — `FIXED`

- **File:** `audio-chunker/vad-web.ts`
- **Issue:** `vad_past` array accumulated every VAD frame (~15.6 frames/sec). In a 1-hour session: ~56K entries ≈ 450KB. `clip_points` also grew but slower.
- **Fix:** Replaced `vad_past: number[]` with `vad_frame_count: number` (only `.length` was ever accessed). Replaced `clip_points: number[]` with `last_clip_point: number` (only last element was ever read). Memory: O(n) → O(1).

---

## 🟠 High Priority (Bundle Size & Performance)

### 6. Remove `core-js/stable` Import — `FIXED`

- **File:** `index.ts` → `packages/es6/entry.ts`
- **Issue:** `import 'core-js/stable'` in shared source added ~50-100KB polyfills to ALL builds, including es11 (ES2020 target) where they're unnecessary.
- **Fix:** Removed from shared source. Created `packages/es6/entry.ts` as a wrapper that imports `core-js/stable` before re-exporting the SDK. The es11 package gets zero polyfill overhead; the es6 legacy package still includes them for older browser support.

### 7. Console Statements in Production — `FIXED`

- **Files:** Multiple (~86 total: mix of `console.log`, `console.error`, `console.warn`)
- **Impact:** Minor bundle bloat, potential information leakage
- **Fix:** Added `esbuild: { pure: ['console.log'] }` to `packages/es11/vite.config.ts`. This tree-shakes all `console.log` calls from the production build while preserving `console.error` and `console.warn` for critical diagnostics. The es6 build already had `drop: ['console', 'debugger']` configured.

### 8. Duplicate Retry Logic — `FIXED (dead code removed)`

- **Files:** `s3-retry-wrapper.ts` + `s3-upload-service.ts`
- **Original claim:** Both implement exponential backoff independently
- **Reality:** `s3-retry-wrapper.ts` was dead code — not imported anywhere. The only active retry logic is in `s3-upload-service.ts`. Deleted `s3-retry-wrapper.ts` entirely. No duplication remains.

### 9. Unused `aws-sdk` Dependency — `FIXED`

- **File:** `aws-services/configure-aws.ts`
- **Issue:** `import * as AWS from 'aws-sdk'` was used only for `AWS.config.update()` which had no downstream consumers. The SDK uses `aws4fetch` for all actual S3 operations.
- **Fix:** Removed the `aws-sdk` import and `AWS.config.update()` call. `configure-aws.ts` now only stores credentials locally for `aws4fetch` consumption.

### 10. Synchronous MP3 Encoding on Main Thread — `NOT AN ISSUE`

- **File:** `audio-chunker/compress-mp3-audio.ts`
- **Original claim:** MP3 encoding blocks main thread causing UI jank
- **Reality:** The S3 upload (including MP3 compression) is offloaded to the SharedWorker (`shared-worker/s3-file-upload.ts`). The SharedWorker handles both compression and upload in a background thread. When SharedWorker is unavailable, fallback runs on main thread — but this is the exception, not the norm. The current architecture already addresses this concern.

### 11. Large Main Entry File — `VALID (future, next major version)`

- **File:** `index.ts` (~567 lines, 32 imports)
- **Impact:** All features loaded eagerly including template CRUD, search, translate
- **Note:** Splitting templates into a separate module would be a breaking API change. Best addressed in next major version. The bundle is already tree-shakeable via Vite.

---

## 🟡 Medium Priority (Performance Optimization)

### 12. Buffer Slicing Creates New TypedArray — `NOT AN ISSUE`

- **File:** `audio-chunker/audio-buffer-manager.ts`
- **Original claim:** `buffer.slice(0, currentSampleLength)` creates unnecessary copies
- **Reality:** The slice is intentional and necessary. The internal buffer is over-allocated (growth strategy) and shared — returning a reference would expose internal state and cause data corruption when the buffer is reset. The copy ensures data integrity.

### 13. Multiple Data Conversions in Audio Pipeline — `NOT AN ISSUE`

- **File:** `audio-chunker/compress-mp3-audio.ts`
- **Original claim:** Float32Array → Int16Array conversion is inefficient
- **Reality:** lamejs (MP3 encoder) requires Int16Array input — this conversion is mandatory. The loop is a simple multiply-and-clamp, highly optimized by V8. No alternative approach exists without replacing the MP3 encoder.

### 14. Fixed Polling Interval Without Backoff — `FIXED`

- **File:** `audio-chunker/audio-file-manager.ts`
- **Issue:** `waitForAllUploads()` polled at a fixed 500ms interval regardless of how long uploads were taking.
- **Fix:** Added exponential backoff to the SharedWorker polling path: starts at 500ms, multiplied by 1.5x on each poll, capped at 3s. Reduces unnecessary message passing for longer uploads while remaining responsive for quick completions.

### 15. String Concatenation in Hot Paths — `NOT AN ISSUE`

- **Files:** Various
- **Original claim:** String concatenation overhead in frequently called code
- **Reality:** V8 heavily optimizes string concatenation. The "hot paths" in question (S3 URL construction, file naming) are called once per audio chunk (~every 10-25 seconds), not per frame. Negligible overhead.

### 16. Per-Frame Callback Overhead — `NOT AN ISSUE`

- **File:** `audio-chunker/vad-web.ts`
- **Original claim:** `onFrameProcessed` callback with dynamic store lookups causes overhead
- **Reality:** The callback fires ~15.6 times/sec (1024 samples @ 16kHz). This is the SDK's core feature — providing real-time audio probability data to the consuming application. The store lookup is a simple property access on a singleton. Removing it would break the callback API.

### 17. No Presigned URL Expiry Handling — `NOT AN ISSUE`

- **File:** `aws-services/upload-audio-with-presigned-url.ts`
- **Original claim:** No handling for expired presigned URLs during retry
- **Reality:** The SDK uses `aws4fetch` with IAM credentials for S3 uploads, NOT presigned URLs. Each upload request is independently signed. Credential refresh is handled via the SharedWorker's `REQUEST_TOKEN_REFRESH` mechanism. The presigned URL file exists but is not the primary upload path.

### 18. Timestamp Recalculated on Every Call — `NOT AN ISSUE`

- **File:** `audio-chunker/audio-buffer-manager.ts`
- **Original claim:** `calculateChunkTimestamps()` recomputes redundantly in hot path
- **Reality:** This is called once per audio chunk (every 10-25 seconds), not per frame. The calculation involves basic arithmetic (division, formatting). Caching would add complexity for zero measurable gain.

---

## 🔵 Code Quality & Type Safety

### 19. Excessive `any` Type Usage — `FIXED`

- **Files:** ~13 instances across codebase
- **Fix:** Replaced all `any` types with proper alternatives:
  - `catch (error: any)` → `catch (error: unknown)` with type narrowing via `instanceof DOMException` / `instanceof Error` (in `s3-upload-service.ts`, `start-recording.ts`, `vad-web.ts`, `system-compatiblity-manager.ts`)
  - `const error: any = new Error(...)` → `Object.assign(new Error(...), { code, statusCode })` (in `s3-upload-service.ts`)
  - `classifyError(error: any)` → `classifyError(error: unknown)` with `Record<string, unknown>` cast (in `s3-upload-service.ts`)
  - `additional_data?: any` → `Record<string, unknown>` (in `types.ts`)
  - `sys_info?: any` → `TSystemInfo` (in `types.ts` — the type already existed!)
  - `data?: any` → `Record<string, unknown>` (in `types.ts` and `system-compatiblity-manager.ts`)
  - `(navigator as any).deviceMemory` → `(navigator as Navigator & { deviceMemory?: number })` (in `system-compatiblity-manager.ts`)

### 20. Swallowed Errors with Silent Catch Blocks — `NOT AN ISSUE`

- **Files:** `vad-web.ts:61-62`, `index.ts:119`, `audio-file-manager.ts:749`
- **Reality:** All 3 silent catch blocks are intentional with explanatory comments:
  - `stopMicStream()`: Best-effort cleanup — failure is acceptable
  - `resetEkaScribe()` in getInstance: Sub-instances may not be initialized
  - `promise.catch(() => {})`: Prevents unhandled rejection warnings during cleanup

### 21. No Centralized Error Logging — `NOT AN ISSUE`

- **Original recommendation:** Create a logger utility with configurable log levels.
- **Reality:** With #7 now stripping `console.log` from production builds, the existing console-based logging is sufficient. A separate logger abstraction would add indirection for no practical benefit. `console.error` and `console.warn` are preserved in production for critical diagnostics.

### 22. Magic Strings for Transaction States — `FIXED`

- **Files:** `index.ts`, `init-transaction.ts`, `start-recording.ts`, `pause-recording.ts`, `resume-recording.ts`, `end-recording.ts`, `retry-upload-recording.ts`
- **Issue:** State comparisons used hardcoded strings like `'init'`, `'stop'`, `'commit'`, `'na'`, `'start'`, `'pause'`, `'resume'`
- **Fix:** Created `API_STATUS` and `VAD_STATUS` enums in `constants/enums.ts`. Updated `TSessionStatus` type to use enums. Replaced all magic string literals across 7 files with enum references (e.g., `=== 'init'` → `=== API_STATUS.INIT`). Full IDE autocomplete and type safety.

### 23. Inconsistent Return Types Across API Methods — `VALID (future, next major version)`

- **Files:** Various API files
- **Note:** Standardizing return types would be a breaking change. Best addressed in next major version.

### 24. Missing Type Exports — `FIXED`

- **File:** `index.ts`
- **Issue:** Types were defined in `constants/types.ts` but not re-exported from the package entry point. Consumers had to reach into internal paths.
- **Fix:** Added comprehensive `export type { ... }` and `export { ... }` blocks at the bottom of `index.ts`. All 45+ types and 10 enums are now importable directly from `@eka-care/ekascribe-ts-sdk`.

---

## 🟣 API Design & Architecture

### 25-29. Architecture Items — `VALID (future)`

These are valid architectural improvements for a future major version:
- Unify callback registration into event emitter pattern (#25)
- Separate template SDK into optional module (#26)
- Add `sideEffects` field to package.json (#27)
- Add conditional `exports` field (#28)
- Standardize error response format (#29)

None of these are bugs or performance issues — they're API design improvements.

---

## ⚪ Dead Code & Duplication

### 30. Unused s3-retry-wrapper.ts — `FIXED`

- **File:** `aws-services/s3-retry-wrapper.ts`
- **Status:** Deleted. Confirmed via grep that it was not imported anywhere. Also deleted `get-files-s3.ts` which was its only consumer and itself unused.

### 31. Duplicate Timestamp Formatting — `NOT AN ISSUE`

- Only 1 occurrence exists (`calculateChunkTimestamps` in `audio-buffer-manager.ts`). Not actually duplicated.

### 32. Repeated State Spread Operations — `FIXED`

- **Files:** `store/store.ts`, `start-recording.ts`, `pause-recording.ts`, `resume-recording.ts`, `end-recording.ts`, `retry-upload-recording.ts`, `index.ts`
- **Issue:** 8 occurrences of `EkaScribeStore.sessionStatus[txnID] = { ...EkaScribeStore.sessionStatus[txnID], api/vad: {...} }` spread pattern.
- **Fix:** Added `updateApiStatus(txnID, status, code, response?)` and `updateVadStatus(txnID, status)` helper methods to `EkaScribeStore`. Replaced all spread call sites.

### 33. Duplicate AudioChunks Mapping — `FIXED`

- **Files:** `audio-file-manager.ts`, `end-recording.ts`, `retry-upload-recording.ts`, `index.ts`
- **Issue:** 3 occurrences of `.audioChunks.filter(f => f.status === 'success').map(a => a.fileName)`.
- **Fix:** Added `getSuccessfulAudioFileNames()` method to `AudioFileManager`. Replaced all filter→map call sites.

### 34. Repeated Callback Construction — `FIXED`

- **File:** `audio-file-manager.ts`
- **Issue:** 10 occurrences of `FILE_UPLOAD_STATUS` callback construction with identical boilerplate (`callback_type`, `timestamp`, `if (onEventCallback)` guard).
- **Fix:** Added private `emitUploadEvent(status, message, data?, error?)` helper to `AudioFileManager`. Replaced all 10 callback constructions.

---

## 🆕 Additional Issues Found During Review

### 35. No-Delay Recursive Polling in poll-output-summary.ts — `FIXED` (P0)

- **File:** `main/poll-output-summary.ts`
- **Issue:** The 1-second delay between polling calls was **commented out**, causing tight recursive polling at ~20 requests/second to the backend. This could effectively DDoS the own API and cause rapid call-stack growth.
- **Fix:** Uncommented `await new Promise((resolve) => setTimeout(resolve, 1000))` to restore the 1-second delay between polling cycles.

---

## Summary of Changes

### Fixed in This Review

| # | Issue | Fix Applied |
|---|-------|-------------|
| **5** | VAD arrays grow indefinitely | Replaced `vad_past[]` and `clip_points[]` with scalar counters (`vad_frame_count`, `last_clip_point`) |
| **6** | core-js/stable in shared source | Moved to `packages/es6/entry.ts` wrapper; es11 builds are polyfill-free |
| **7** | console.log in production | Added `esbuild: { pure: ['console.log'] }` to vite.config.ts |
| **8+30** | Dead retry wrapper | Deleted `s3-retry-wrapper.ts` and `get-files-s3.ts` (both unused) |
| **9** | Unused aws-sdk import | Removed `aws-sdk` import from `configure-aws.ts` |
| **14** | Fixed polling interval | Added exponential backoff (500ms → 750ms → ... capped 3s) |
| **19** | `any` types (~13 instances) | Replaced with `unknown`, `Record<string, unknown>`, proper type narrowing |
| **22** | Magic strings for states | Created `API_STATUS` + `VAD_STATUS` enums, replaced all literals in 7 files |
| **24** | Missing type exports | Re-exported 45+ types and 10 enums from `index.ts` |
| **32** | Repeated state spread | Added `updateApiStatus()`/`updateVadStatus()` helpers to `EkaScribeStore` |
| **33** | Duplicate audioChunks mapping | Added `getSuccessfulAudioFileNames()` to `AudioFileManager` |
| **34** | Repeated callback construction | Added `emitUploadEvent()` helper to `AudioFileManager` |
| **35** | Polling without delay | Restored 1-second delay in `poll-output-summary.ts` |

### Reclassified as Not an Issue

| # | Original Claim | Why It's Not an Issue |
|---|---------------|----------------------|
| **1** | EventListener accumulation | Uses `{ once: true }`, auto-cleans |
| **2** | Upload promises never cleared | Cleared on session reset, correct lifecycle |
| **3** | Buffer expansion GC pressure | Standard growth pattern, ~3-4 expansions per session |
| **4** | No callback unsubscribe | Session-scoped, cleared on reset |
| **10** | MP3 encoding blocks main thread | Already offloaded to SharedWorker |
| **12** | Buffer slice creates copy | Intentional — protects shared internal buffer |
| **13** | Float32→Int16 conversion | Required by lamejs, unavoidable |
| **15** | String concatenation overhead | Called per-chunk (10-25s), not per-frame |
| **16** | Per-frame callback overhead | Core feature, ~15.6/sec is fine |
| **17** | Presigned URL expiry | SDK uses aws4fetch, not presigned URLs |
| **18** | Timestamp recalculation | Called once per chunk, trivial cost |
| **20** | Swallowed errors | All 3 are intentional with explanatory comments |
| **21** | No centralized logger | console.log stripped in prod (#7); console.error/warn preserved |
| **31** | Duplicate timestamp formatting | Only 1 occurrence — not actually duplicated |

### Genuine Future Improvements (not urgent)

| # | Item | Priority |
|---|------|----------|
| **11** | Lazy-load optional modules (templates, translate) | Next major version |
| **23** | Standardize API return types | Next major version |
| **25-29** | API design improvements | Next major version |

---

*Updated after thorough code review and fixes — February 2026*
