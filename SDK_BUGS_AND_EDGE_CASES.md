# EkaScribe SDK - Logic Bugs & Edge Cases Report

This document identifies logic bugs, race conditions, and edge cases that could break in production across multiple clients.

---

## Table of Contents

1. [Critical Issues](#-critical-issues)
2. [High Priority Issues](#-high-priority-issues)
3. [Medium Priority Issues](#-medium-priority-issues)
4. [Summary Table](#summary-table)

---

## 🔴 Critical Issues

### 1. Missing VAD Instance Null Check in start-recording.ts

**File:** `eka-sdk/ekascribe-v2rx/main/start-recording.ts:22-37`

**Buggy Code:**
```typescript
const vadInstance = EkaScribeStore.vadInstance;

const navigatorPermissionResponse = await navigator.permissions.query({
  name: 'microphone' as PermissionName,
});

if (navigatorPermissionResponse.state !== 'granted') {
  return { error_code: ERROR_CODE.MICROPHONE, ... };
}

await vadInstance?.initVad(microphoneID);  // VAD could be null here
const micVad = vadInstance?.getMicVad();
const isVadLoading = vadInstance?.isVadLoading();

if (isVadLoading || !micVad || Object.keys(micVad).length === 0) {
```

**What Could Go Wrong:**
- If `vadInstance` is null, `initVad()` is silently skipped due to optional chaining
- `isVadLoading` becomes `undefined`, causing `undefined || true` to evaluate incorrectly
- User thinks recording started but VAD isn't initialized
- Silent failures without proper error reporting

**Fix:**
```typescript
if (!vadInstance) {
  return {
    error_code: ERROR_CODE.VAD_NOT_INITIALIZED,
    status_code: SDK_STATUS_CODE.FORBIDDEN,
    message: 'VAD instance is not initialized. Initialize transaction first.',
  };
}
```

---

### 2. Race Condition in Pause/Resume VAD State Management

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:332-349`

**Buggy Code:**
```typescript
startVad() {
  if (this.micVad && typeof this.micVad.start === 'function') {
    this.micVad.start();
  }
  this.recording_started = true;  // Set synchronously
}

pauseVad() {
  if (this.micVad && typeof this.micVad.pause === 'function') {
    this.micVad.pause();
  }
  this.recording_started = false;  // Set synchronously
}
```

**What Could Go Wrong:**
- `recording_started` flag is set synchronously, but `micVad.start()`/`pause()` are async
- Audio frames arriving between flag set and operation completion are processed incorrectly
- Multiple pause/resume calls in quick succession cause race conditions
- Silence detection timer may not properly reset

**Fix:**
```typescript
async startVad() {
  if (this.micVad && typeof this.micVad.start === 'function') {
    await this.micVad.start();
  }
  this.recording_started = true;
}

async pauseVad() {
  if (this.micVad && typeof this.micVad.pause === 'function') {
    await this.micVad.pause();
  }
  this.recording_started = false;
}
```

---

### 3. Duplicate Successful Upload Tracking

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:338-349, 659`

**Buggy Code:**
```typescript
// In retryFailedUploads() - line 659
if (response.success) {
  this.successfulUploads.push(fileName);  // DUPLICATE PUSH
  // Already pushed on line 338 when first upload succeeded
}
```

**What Could Go Wrong:**
- Same filename pushed twice to `successfulUploads` array
- Success count becomes inflated
- `getSuccessfulUploads().length` returns wrong count
- Transaction commit receives duplicate file references
- Upstream audio processing systems fail

**Fix:**
```typescript
if (response.success) {
  if (!this.successfulUploads.includes(fileName)) {
    this.successfulUploads.push(fileName);
  }
}
```

---

### 4. Memory Leak in SharedWorker Message Listener

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:531`

**Buggy Code:**
```typescript
// In waitForAllUploads polling loop
this.sharedWorkerInstance?.port.addEventListener('message', messageHandler);

// Cleanup happens inside callbacks, but...
this.sharedWorkerInstance?.port.removeEventListener('message', messageHandler);
```

**What Could Go Wrong:**
- Multiple event listeners accumulate with each `waitForAllUploads()` call
- If timeout occurs, cleanup runs but next call adds another listener
- After 10 pause/resume cycles, messages trigger 10 handlers
- Memory leak grows unbounded during long recording sessions

**Fix:**
```typescript
// Remove existing listener before adding new one
this.sharedWorkerInstance?.port.removeEventListener('message', messageHandler);
this.sharedWorkerInstance?.port.addEventListener('message', messageHandler, { once: true });
```

---

## 🟠 High Priority Issues

### 5. Session Status Undefined Access

**File:** `eka-sdk/ekascribe-v2rx/index.ts:244-246`

**Buggy Code:**
```typescript
if (
  EkaScribeStore.sessionStatus[txnID].api?.status === 'stop' ||
  EkaScribeStore.sessionStatus[txnID].api?.status === 'commit'
) {
```

**What Could Go Wrong:**
- If `initTransaction` was never called, `sessionStatus[txnID]` is undefined
- Throws `TypeError: Cannot read properties of undefined`
- Unhandled exception crashes the SDK
- No graceful error response to client

**Fix:**
```typescript
const sessionInfo = EkaScribeStore.sessionStatus[txnID];
if (!sessionInfo?.api?.status) {
  return {
    error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
    status_code: SDK_STATUS_CODE.TXN_ERROR,
    message: 'Transaction not initialized',
  };
}

if (sessionInfo.api.status === 'stop' || sessionInfo.api.status === 'commit') {
  // ...
}
```

---

### 6. Permission Query Not Supported in Safari

**File:** `eka-sdk/ekascribe-v2rx/main/start-recording.ts:10-20`

**Buggy Code:**
```typescript
const navigatorPermissionResponse = await navigator.permissions.query({
  name: 'microphone' as PermissionName,
});

if (navigatorPermissionResponse.state !== 'granted') {
  return { error_code: ERROR_CODE.MICROPHONE, ... };
}
```

**What Could Go Wrong:**
- `navigator.permissions.query()` is NOT supported in Safari and older browsers
- Throws `TypeError` instead of showing native permission dialog
- Recording cannot start on Safari (30%+ of mobile users)
- No fallback to `getUserMedia()` permission prompt

**Fix:**
```typescript
let permissionGranted = true;

try {
  const navigatorPermissionResponse = await navigator.permissions.query({
    name: 'microphone' as PermissionName,
  });
  permissionGranted = navigatorPermissionResponse.state === 'granted';
} catch (e) {
  // Safari doesn't support permissions.query - let getUserMedia handle it
  permissionGranted = true; // Proceed, getUserMedia will prompt
}

if (!permissionGranted) {
  return { error_code: ERROR_CODE.MICROPHONE, ... };
}
```

---

### 7. Audio Chunk Timestamp Calculation Overflow

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-buffer-manager.ts:93-119`

**Buggy Code:**
```typescript
calculateChunkTimestamps(rawSamplesLength: number): {
  start: string;
  end: string;
} {
  const start = rawSamplesLength / SAMPLING_RATE - this.getDurationInSeconds();
  const end = start + this.getDurationInSeconds();

  const startMinutes = Math.floor(start / 60).toString().padStart(2, '0');
  const startSeconds = (start % 60).toFixed(6).toString().padStart(2, '0');
  // ...
}
```

**What Could Go Wrong:**
- For long recordings (hours), `start % 60` can produce values like `3599.999999`
- `padStart(2, '0')` expects max 2 chars but receives "3599.999999"
- Timestamps become malformed (e.g., "99:3599.999999")
- Downstream systems reject malformed timestamps
- Audio timeline becomes incoherent

**Fix:**
```typescript
const totalSeconds = Math.max(0, start);
const minutes = Math.floor(totalSeconds / 60);
const seconds = totalSeconds % 60;

const startMinutes = minutes.toString().padStart(2, '0');
const startSeconds = seconds.toFixed(6).padStart(9, '0'); // "SS.ffffff" format
```

---


### 9. Worker Upload Tracking — Not a Bug (By Design)

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:409-453`

**Status:** Not a bug. The fire-and-forget pattern in `uploadAudioChunkInWorker` is **intentional**.

**How tracking works:**
1. `uploadAudioChunkInWorker()` sends message to worker, returns immediately (non-blocking)
2. Worker uploads file, sends back `UPLOAD_FILE_WITH_WORKER_SUCCESS/ERROR`
3. `onmessage` handler in `createSharedWorkerInstance()` updates `successfulUploads` and `audioChunks[i].status`
4. `endRecording()` calls `waitForAllUploads()` (10s timeout) as a first-pass wait
5. After timeout/completion, `getFailedUploads()` catches any chunk where `status != 'success'` (including still-pending)
6. `retryFailedUploads()` re-uploads those chunks
7. If retry also fails → user gets `AUDIO_UPLOAD_FAILED` error with `failed_files` list
8. Commit only includes `successfullyUploadedAudioFiles` (line 138-141 in end-recording.ts)

**Minor edge case:** A chunk still `'pending'` (worker still uploading from first attempt) may get retried unnecessarily — causing a duplicate upload. This is harmless because:
- S3 PUT to the same key is idempotent
- `successfulUploads` dedup (fix #3) prevents double-counting

---

### 10. Token Refresh Timeout Race — Not a Bug (Safe by Design)

**File:** `eka-sdk/ekascribe-v2rx/shared-worker/s3-file-upload.ts:43-52`

**Status:** Not a bug. No double-resolution occurs.

**Why it's safe:**
The timeout (line 44-52) sets `isTokenRefreshInProgress = false` and clears `pendingTokenRefreshResolvers = []`. If `TOKEN_REFRESH_SUCCESS` arrives after timeout:
1. `isTokenRefreshInProgress` is already `false` → line 109 sets it `false` again (no-op)
2. `pendingTokenRefreshResolvers` is already `[]` → line 110 iterates empty array (no-op)
3. No resolver is called twice. No double-resolution.

The only real consequence: if refresh succeeds just after timeout, credentials ARE configured (line 101-105) but the uploads that were waiting already received `false`. They'll retry on next upload attempt with the now-valid credentials — which is correct behavior.

---

### 11. Stale Worker Upload Counter on Retry

**File:** `eka-sdk/ekascribe-v2rx/shared-worker/s3-file-upload.ts:19-20`

**Code:**
```typescript
let uploadRequestReceived: number = 0;
let uploadRequestCompleted: number = 0;
```

**What happens:**
1. Initial recording: 5 chunks sent → `uploadRequestReceived = 5`
2. 4 complete, 1 still uploading → `uploadRequestCompleted = 4`
3. `waitForAllUploads` times out (5 !== 4)
4. `endRecording` retries the 1 failed chunk → sends it to worker again
5. Now `uploadRequestReceived = 6`, `uploadRequestCompleted = 4`
6. Retry's `waitForAllUploads` polls worker → `6 !== 4` → keeps polling
7. Original upload (attempt 1) completes → `uploadRequestCompleted = 5` → still `6 !== 5`
8. Retry upload (attempt 2) completes → `uploadRequestCompleted = 6` → match! resolves

**Impact:** The retry's `waitForAllUploads` must wait for BOTH the original in-flight upload AND the retry to complete, even though they're the same file. On slow networks this could exceed the 10s timeout, triggering `AUDIO_UPLOAD_FAILED` even though the file eventually uploads successfully via one of the two attempts.

**Not a data-loss bug** — the upload still happens, S3 is idempotent, and the `onmessage` handler will update the chunk status. But the user may see a false `AUDIO_UPLOAD_FAILED` error when the upload actually succeeds moments later.

---

### 12. Callback Exception Crashes Recording

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:220-232`

**Buggy Code:**
```typescript
onFrameProcessed: (prob, frames) => {
  audioFileManager?.incrementTotalRawSamples(frames);
  audioBuffer?.append(frames);

  const vadFrameProcessedCallback = EkaScribeStore.vadFrameProcessedCallback;
  if (vadFrameProcessedCallback) {
    const rawSampleDetails = audioFileManager?.getRawSampleDetails();
    vadFrameProcessedCallback({ probabilities: prob, frame: frames, duration });
  }
}
```

**What Could Go Wrong:**
- If user-provided callback throws exception, entire `onFrameProcessed` crashes
- No error boundary around user callbacks
- One bad callback crashes the entire recording
- Exception in async context may not surface properly

**Fix:**
```typescript
if (vadFrameProcessedCallback) {
  try {
    vadFrameProcessedCallback({ probabilities: prob, frame: frames, duration });
  } catch (error) {
    console.error('Error in vadFrameProcessedCallback:', error);
    // Optionally notify via event callback
  }
}
```

---

## 🟡 Medium Priority Issues

### 13. Unbounded Silence Duration Accumulation

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:150-156`

**The Problem:**

`sil_duration_acc` is a frame counter that increments by 1 for every silent frame. It's only reset to 0 when either (a) speech is detected or (b) a clip point is created. In a quiet environment (e.g., doctor leaves mic on after consultation), this counter grows indefinitely.

**Why it matters:**

The counter is used in `Math.floor(this.sil_duration_acc / 2)` to calculate clip offset — but that's already capped by `Math.min(..., 5)`, so the clip logic is safe. However, the `max_length_samples` hard cutoff (25s) will force a clip point, resetting the counter. So in practice, the counter can't grow beyond ~25s worth of frames between clip points.

The real risk is a defensive one: if any future code reads `sil_duration_acc` without the `Math.min` cap, the unbounded value could cause unexpected behavior. Capping it at 2x max chunk length costs nothing and prevents this.

**Fix Applied:**
```typescript
// In processVadFrame, when incrementing silence:
this.sil_duration_acc = Math.min(this.sil_duration_acc + 1, this.max_length_samples * 2);
```

---

### 14. Missing Chunk Upload Error Recovery

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:308-347`

**The Problem:**

In `processAudioChunk()`, a chunk is registered in `audioChunks` with `status: 'pending'` and the audio buffer is reset **before** `uploadAudioToS3()` is awaited. If `uploadAudioToS3` throws synchronously (e.g., SharedWorker unavailable AND main-thread upload throws), the catch block only does `console.error`. The chunk remains with `status: 'pending'` — neither marked as `'failure'` nor reported to the client.

**How the existing retry flow handles this (partially):**

`endRecording()` → `getFailedUploads()` catches any chunk where `status !== 'success'` (including `'pending'`), so the chunk WILL be retried. The gap is: the client has no visibility into the failure until `endRecording` runs. For long recordings, a chunk could silently fail early and the developer won't know until minutes later.

**Fix Applied:**
```typescript
} catch (error) {
  console.error('[EkaScribe] Error uploading audio chunk:', error);

  // Mark chunk as failed so endRecording's retry flow picks it up
  const failedChunk = audioFileManager.audioChunks.find((c) => c.fileName === fileName);
  if (failedChunk) {
    failedChunk.status = 'failure';
  }

  // Notify client immediately via event callback
  const onEventCallback = EkaScribeStore.eventCallback;
  if (onEventCallback) {
    try {
      onEventCallback({
        callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
        status: 'error',
        message: `Failed to upload chunk ${fileName}: ${error}`,
        timestamp: new Date().toISOString(),
      });
    } catch (cbError) {
      console.error('[EkaScribe] Error in eventCallback:', cbError);
    }
  }
}
```

---

### 15. Resource Leak if MicVAD Initialization Fails — **FIXED** (in #1)

Already fixed. `initVad()` now calls `this.stopMicStream()` at the top before acquiring a new stream, and has a catch block that cleans up on any failure.

---

### 16. Zero-Size Buffer in AudioBufferManager

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-buffer-manager.ts:14-23`

**The Problem:**

If `samplingRate` or `allocationTimeInSeconds` is 0, `incrementalAllocationSize` becomes 0. This creates a `Float32Array(0)` — a valid but useless buffer. Every `append()` call triggers `expandBuffer()`, which does `buffer.length + 0 = 0`, so the buffer never actually grows. Audio frames are silently lost.

**Why it's unlikely but worth guarding:**

The constructor is only called from `initTransaction` in `index.ts` with hardcoded constants (`SAMPLING_RATE = 16000`, `AUDIO_BUFFER_SIZE_IN_S = 30`). No user input can make these 0. But a future refactor that makes these configurable (e.g., `configureVadConstants`) could introduce this silently. The guard is defense-in-depth.

**Fix Applied:**
```typescript
constructor(samplingRate: number, allocationTimeInSeconds: number) {
  if (samplingRate <= 0 || allocationTimeInSeconds <= 0) {
    throw new Error(
      `[EkaScribe] Invalid AudioBufferManager params: samplingRate=${samplingRate}, ` +
      `allocationTime=${allocationTimeInSeconds}. Both must be positive.`
    );
  }

  this.samplingRate = samplingRate;

  // Minimum 100ms worth of samples to prevent zero-size expansions
  const minAllocationSize = Math.floor(samplingRate * 0.1);
  this.incrementalAllocationSize = Math.max(
    Math.floor(samplingRate * allocationTimeInSeconds),
    minAllocationSize
  );

  this.buffer = new Float32Array(this.incrementalAllocationSize);
}
```

---

### 17. Silent Environment/ClientId Switch via getInstance

**File:** `eka-sdk/ekascribe-v2rx/index.ts` (getInstance pattern)

**The Problem:**

`getInstance()` calls `setEnv()` on **every** invocation, even when an instance already exists. `setEnv()` mutates module-level variables (`envVar`, `client_id`, `auth`) in `fetch-client/helper.ts`. This means a second call with different `env` **does** silently switch the environment for all subsequent API calls — including any in-flight recording session.

**Why the original bug doc description was inaccurate:**

The original doc said "second call returns production instance" — that's misleading. The env IS actually changed (via `setEnv`), so the instance now points to the new env. The real danger is **mid-session env switching**: you could be recording and uploading audio to S3 prod, then someone calls `getInstance({ env: 'DEV' })`, and suddenly the commit call goes to the dev API — causing the session to fail or data to land in the wrong environment.

**Fix Applied — Auto-reset on config change:**

If `env` or `clientId` differs from the current config, the old instance is fully cleaned up (`resetEkaScribe()` — destroys VAD, closes mic stream, resets audio buffers, clears store) and a fresh instance is created. A `console.warn` is logged so developers know the reset happened.

Token-only changes (`access_token`) do NOT trigger a reset — this is the normal token refresh flow and should be seamless.

```typescript
if (EkaScribe.instance) {
  const envChanging = env && GET_CURRENT_ENV() !== env;
  const clientChanging = clientId && GET_CLIENT_ID() !== clientId;

  if (envChanging || clientChanging) {
    console.warn(`[EkaScribe] Configuration changed (...). Resetting instance.`);

    try {
      EkaScribe.instance.resetEkaScribe(); // cleanup VAD, mic, buffers, store
    } catch {
      // sub-instances may not exist if initTransaction was never called
    }
    EkaScribe.instance = null;
  }
}

setEnv({ ... }); // Apply new config

if (!EkaScribe.instance) {
  EkaScribe.instance = new EkaScribe(); // Fresh instance with new config
}
```

---

## Summary Table

| # | Issue | Severity | Status | File | Impact |
|---|-------|----------|--------|------|--------|
| 1 | Missing VAD null check | CRITICAL | **FIXED** | start-recording.ts | Silent initialization failure |
| 2 | Race condition in VAD state | CRITICAL | **FIXED** | vad-web.ts | Rapid pause/resume race condition |
| 3 | Duplicate success tracking | CRITICAL | **FIXED** | audio-file-manager.ts | Wrong file count in commit |
| 4 | Memory leak in listeners | CRITICAL | **FIXED** | audio-file-manager.ts | Unbounded memory growth |
| 5 | Undefined session access | HIGH | **FIXED** | index.ts:244-246 | TypeError crashes SDK |
| 6 | Safari permissions unsupported | HIGH | **FIXED** (in #1) | start-recording.ts | 30%+ mobile users blocked |
| 7 | Timestamp overflow | HIGH | **FIXED** | audio-buffer-manager.ts | Malformed timestamps for long recordings |
| 8 | Fire-and-forget upload | ~~HIGH~~ | **Not a bug** | pause-recording.ts | By design — non-blocking, tracked via retry |
| 9 | Worker uploads not tracked | ~~HIGH~~ | **Not a bug** | audio-file-manager.ts | By design — tracked via onmessage + retry |
| 10 | Token refresh race | ~~HIGH~~ | **Not a bug** | s3-file-upload.ts | Safe — no double-resolution occurs |
| 11 | Empty TXN_ID validation | HIGH | **FIXED** (in #1) | start-recording.ts | Cross-session state corruption |
| 11b | Stale worker upload counter | HIGH | **FIXED** | s3-file-upload.ts:19-20 | False AUDIO_UPLOAD_FAILED on slow networks |
| 12 | Callback exception uncaught | HIGH | **FIXED** | vad-web.ts:220-232 | Recording crash on bad callback |
| 13 | Unbounded silence accumulation | MEDIUM | **FIXED** | vad-web.ts:150-156 | Capped at 2x max chunk length |
| 14 | Missing chunk error recovery | MEDIUM | **FIXED** | vad-web.ts:308-347 | Chunk now marked 'failure' + client notified |
| 15 | Resource leak on VAD failure | MEDIUM | **FIXED** (in #1) | vad-web.ts:199-274 | Mic stream cleanup on init failure |
| 16 | Zero-size buffer potential | MEDIUM | **FIXED** | audio-buffer-manager.ts:14-23 | Throws on invalid params + min 100ms allocation |
| 17 | Silent env/clientId switch | MEDIUM | **FIXED** | index.ts (getInstance) | Auto-reset instance on env/clientId change |

---

## Recommended Fix Priority

### DONE (Fixed in this session)
- [x] Fix #1: VAD null check + Safari permissions fallback + TXN_ID validation + MicVAD check
- [x] Fix #2: Idempotency guards on startVad/pauseVad
- [x] Fix #3: Dedup successfulUploads at all 3 push sites
- [x] Fix #4: AbortController-based listener cleanup in waitForAllUploads
- [x] Fix #5: Session status null guard in commitTransactionCall
- [x] Fix #7: Timestamp padStart fixed to `padStart(9, '0')` for proper SS.ffffff format
- [x] Fix #11b: Added RESET_UPLOAD_COUNTERS worker action, sent before retries
- [x] Fix #12: All user callbacks wrapped in try-catch (vadFrameProcessed, userSpeech, vadFrames)

### Not Bugs (Reclassified after thorough review)
- ~~Fix #8~~: Fire-and-forget pause upload — intentional non-blocking pattern
- ~~Fix #9~~: Worker upload tracking — handled via onmessage + endRecording retry flow
- ~~Fix #10~~: Token refresh timeout — safe, no double-resolution

### MEDIUM fixes (all done)
- [x] Fix #13: Silence accumulation capped at `max_length_samples * 2`
- [x] Fix #14: Failed chunks marked `'failure'` + client notified via `eventCallback`
- [x] Fix #16: AudioBufferManager throws on invalid params, enforces min 100ms allocation
- [x] Fix #17: `getInstance()` auto-resets instance on env/clientId change (clean slate)

---

*All issues resolved. 15 fixes applied, 3 reclassified as not-a-bug.*
