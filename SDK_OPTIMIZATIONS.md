# EkaScribe SDK Optimization Report

This document outlines optimization opportunities identified in the EkaScribe TypeScript SDK.

---

## Table of Contents

1. [Critical Issues (Memory Leaks & Stability)](#-critical-issues-memory-leaks--stability)
2. [High Priority (Bundle Size & Performance)](#-high-priority-bundle-size--performance)
3. [Medium Priority (Performance Optimization)](#-medium-priority-performance-optimization)
4. [Code Quality & Type Safety](#-code-quality--type-safety)
5. [API Design & Architecture](#-api-design--architecture)
6. [Dead Code & Duplication](#-dead-code--duplication)
7. [Estimated Impact Summary](#estimated-impact-summary)

---

## 🔴 Critical Issues (Memory Leaks & Stability)

### 1. EventListener Accumulation in Polling Loop

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:531`
- **Issue:** `addEventListener` called repeatedly in polling loop without cleanup
- **Impact:** Memory leak, listener accumulation over time

### 2. Upload Promises Array Never Cleared

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:26`
- **Issue:** `uploadPromises: UploadPromise[] = []` holds references indefinitely
- **Impact:** Memory leak, references retained even after promise resolution

### 3. AudioBuffer Expansion Creates New Allocations

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-buffer-manager.ts:31-34`
- **Issue:** `expandBuffer()` uses `new Float32Array()` on every overflow
- **Impact:** High GC pressure during long recordings, no memory pooling

### 4. No Callback Unsubscribe Mechanism

- **File:** `eka-sdk/ekascribe-v2rx/index.ts`, `store/store.ts`
- **Issue:** Callbacks persist until `resetInstance()` is called
- **Impact:** Memory leak if callbacks hold large closures

### 5. VAD State Arrays Grow Indefinitely

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:138-186`
- **Issue:** `vad_past` and `clip_points` arrays never pruned
- **Impact:** Memory accumulation in long recording sessions

---

## 🟠 High Priority (Bundle Size & Performance)

### 6. Remove `core-js/stable` Import

- **File:** `eka-sdk/ekascribe-v2rx/index.ts:3`
- **Issue:** `import 'core-js/stable'` adds polyfills for IE11/ES5
- **Impact:** 50-100KB unnecessary bundle weight for modern browsers

### 7. Console Statements in Production

- **Files:** Multiple (86 total)
- **Issue:** `console.log` statements scattered throughout codebase
- **Impact:** Bundle bloat, potential performance overhead, information leakage

### 8. Duplicate Retry Logic

- **Files:**
  - `eka-sdk/ekascribe-v2rx/aws-services/s3-retry-wrapper.ts`
  - `eka-sdk/ekascribe-v2rx/aws-services/s3-upload-service.ts`
- **Issue:** Both implement exponential backoff independently
- **Impact:** Code duplication, maintenance burden

### 9. Unused `aws-sdk` Dependency

- **File:** `eka-sdk/ekascribe-v2rx/aws-services/configure-aws.ts:1`
- **Issue:** Only `aws4fetch` is actively used, `aws-sdk` imported but unused
- **Impact:** ~5KB+ unnecessary bundle weight

### 10. Synchronous MP3 Encoding on Main Thread

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/compress-mp3-audio.ts`
- **Issue:** MP3 encoding runs synchronously, blocking main thread
- **Impact:** UI jank during high upload rates

### 11. Large Main Entry File

- **File:** `eka-sdk/ekascribe-v2rx/index.ts`
- **Issue:** 567 lines with 32 imports loaded eagerly
- **Impact:** Initial load time, no lazy loading for optional features (templates, search)

---

## 🟡 Medium Priority (Performance Optimization)

### 12. Buffer Slicing Creates New TypedArray

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-buffer-manager.ts:48`
- **Issue:** `getAudioData()` returns `buffer.slice(0, currentSampleLength)`
- **Impact:** New TypedArray copy created on every call in hot path

### 13. Multiple Data Conversions in Audio Pipeline

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/compress-mp3-audio.ts:9-12`
- **Issue:** Float32Array → Int16Array loop conversion per chunk
- **Impact:** ~10% slower on large buffers, could use optimized TypedArray methods

### 14. Fixed Polling Interval Without Backoff

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:524`
- **Issue:** `waitForAllUploads()` polls every 500ms fixed
- **Impact:** Unnecessary CPU usage, no exponential backoff

### 15. String Concatenation in Hot Paths

- **Files:**
  - `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:94-95, 112`
  - `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:301, 417, 654`
- **Issue:** File paths built via concatenation on every upload
- **Impact:** String allocation overhead in frequently called code

### 16. Per-Frame Callback Overhead

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:220-232`
- **Issue:** `onFrameProcessed` fires every ~64ms with dynamic store lookups
- **Impact:** Callback invocation overhead per audio frame

### 17. No Presigned URL Expiry Handling

- **File:** `eka-sdk/ekascribe-v2rx/aws-services/upload-audio-with-presigned-url.ts`
- **Issue:** No handling for expired URLs during retry scenarios
- **Impact:** Silent failures, wasted retry attempts

### 18. Timestamp Recalculated on Every Call

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-buffer-manager.ts:93-119`
- **Issue:** `calculateChunkTimestamps()` recomputes on every invocation
- **Impact:** Redundant calculations in hot path

---

## 🔵 Code Quality & Type Safety

### 19. Excessive `any` Type Usage

- **Files:**
  - `eka-sdk/ekascribe-v2rx/aws-services/s3-upload-service.ts:43`
  - `eka-sdk/ekascribe-v2rx/constants/types.ts:151`
  - `eka-sdk/ekascribe-v2rx/aws-services/configure-aws.ts:26`
- **Issue:** 15+ instances of `any` type
- **Impact:** Reduced type safety, potential runtime errors

### 20. Swallowed Errors with Silent Catch Blocks

- **Files:**
  - `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:61-62`
  - `eka-sdk/ekascribe-v2rx/audio-chunker/compress-mp3-audio.ts:24-26`
- **Issue:** Empty catch blocks or silent error handling
- **Impact:** Hidden failures, difficult debugging

### 21. No Centralized Error Logging

- **Files:** Multiple
- **Issue:** Each function handles errors independently, no structured logging
- **Impact:** Inconsistent error handling, difficult troubleshooting

### 22. Magic Strings for Transaction States

- **File:** `eka-sdk/ekascribe-v2rx/index.ts:237-239`
- **Issue:** State comparisons use hardcoded strings instead of enums
- **Impact:** Typo-prone, no IDE autocomplete

### 23. Inconsistent Return Types Across API Methods

- **Files:** Various API files
- **Issue:** Some methods return `Promise<Response>`, others return parsed objects
- **Impact:** Inconsistent consumer experience

### 24. Missing Type Exports

- **File:** `eka-sdk/ekascribe-v2rx/constants/types.ts`
- **Issue:** Some response types (e.g., `TGetStatusResponse`) not exported
- **Impact:** Consumers can't properly type their code

---

## 🟣 API Design & Architecture

### 25. Multiple Callback Registration Methods

- **File:** `eka-sdk/ekascribe-v2rx/index.ts`
- **Issue:** 5 separate methods: `onEventCallback`, `onUserSpeechCallback`, `onVadFramesCallback`, `onVadFrameProcessedCallback`, `onPartialResultCallback`
- **Recommendation:** Unify into single event emitter pattern

### 26. Too Many Public Methods

- **File:** `eka-sdk/ekascribe-v2rx/index.ts`
- **Issue:** 28 public methods mixing recording lifecycle with template operations
- **Recommendation:** Separate template SDK into optional module

### 27. Missing `sideEffects` Declaration

- **File:** `package.json`
- **Issue:** No `"sideEffects": false` declaration
- **Impact:** Hurts tree-shaking, larger consumer bundles

### 28. Missing `exports` Field

- **File:** `package.json`
- **Issue:** No conditional exports for ESM/CJS
- **Impact:** Suboptimal module resolution for different environments

### 29. Inconsistent Error Response Format

- **Files:** Various API files
- **Issue:** No standardized error contract across APIs
- **Impact:** Consumers must handle errors differently per endpoint

---

## ⚪ Dead Code & Duplication

### 30. Potentially Unused s3-retry-wrapper.ts

- **File:** `eka-sdk/ekascribe-v2rx/aws-services/s3-retry-wrapper.ts`
- **Issue:** Full retry wrapper implementation that may be unused
- **Impact:** Dead code bloating bundle

### 31. Duplicate Timestamp Formatting Logic

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-buffer-manager.ts:101-112`
- **Issue:** Formatting logic duplicated, no shared utility
- **Impact:** Code duplication

### 32. Repeated State Spread Operations

- **Files:**
  - `eka-sdk/ekascribe-v2rx/index.ts:272-278, 377`
  - `eka-sdk/ekascribe-v2rx/main/end-recording.ts:22-26, 99-105, 171-178`
- **Issue:** `...EkaScribeStore.sessionStatus[txnID]` pattern repeated 6+ times
- **Impact:** Verbose, error-prone code

### 33. Duplicate AudioChunks Mapping Logic

- **Files:**
  - `eka-sdk/ekascribe-v2rx/main/end-recording.ts:67-68`
  - `eka-sdk/ekascribe-v2rx/index.ts:241-244`
  - `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:567-570`
- **Issue:** Same `.map()` logic in 3 files
- **Impact:** Code duplication

### 34. Repeated Callback Status Object Construction

- **File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:177-198, 215-227, 229-245, 312-325`
- **Issue:** Same callback structure repeated 4+ times
- **Recommendation:** Use factory function

---

## Estimated Impact Summary

| Category | Potential Improvement |
|----------|----------------------|
| **Bundle Size** | 50-100KB reduction (core-js + dead code removal) |
| **Memory** | Fix 5 memory leak vectors |
| **Main Thread** | Offload MP3 encoding to worker |
| **Code Reduction** | ~500 lines (deduplication + dead code) |
| **Type Safety** | Eliminate 15+ `any` usages |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Immediate)

- [ ] Fix EventListener accumulation in polling
- [ ] Implement promise cleanup mechanism
- [ ] Add callback unsubscribe methods
- [ ] Implement circular buffer for VAD state

### Phase 2: Bundle Optimization (Short-term)

- [ ] Remove `core-js/stable` import
- [ ] Remove/consolidate unused aws-sdk
- [ ] Remove dead code (s3-retry-wrapper if unused)
- [ ] Strip console.log statements for production

### Phase 3: Performance (Medium-term)

- [ ] Offload MP3 compression to Web Worker
- [ ] Implement buffer pooling for audio chunks
- [ ] Add exponential backoff to polling
- [ ] Cache presigned URLs with TTL

### Phase 4: Code Quality (Ongoing)

- [ ] Enable TypeScript strict mode
- [ ] Replace `any` with proper types
- [ ] Implement centralized error logging
- [ ] Consolidate callback mechanisms
- [ ] Add `sideEffects: false` and `exports` to package.json

---

*Generated from codebase analysis*
