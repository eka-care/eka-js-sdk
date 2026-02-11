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

### 8. Fire-and-Forget Upload in pauseRecording

**File:** `eka-sdk/ekascribe-v2rx/main/pause-recording.ts:54-58`

**Buggy Code:**
```typescript
fileManagerInstance.uploadAudioToS3({
  audioFrames,
  fileName,
  chunkIndex: audioChunkLength - 1,
});  // No await, fire and forget
```

**What Could Go Wrong:**
- Upload promise is not awaited
- If upload fails, user won't know
- Chunk marked pending forever with no error callback
- Later `endRecording()` waits indefinitely or fails

**Fix:**
```typescript
try {
  await fileManagerInstance.uploadAudioToS3({
    audioFrames,
    fileName,
    chunkIndex: audioChunkLength - 1,
  });
} catch (error) {
  console.error('Failed to upload audio chunk on pause:', error);
  // Notify via callback
}
```

---

### 9. Worker Upload Promises Not Tracked

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-file-manager.ts:409-453`

**Buggy Code:**
```typescript
private uploadAudioChunkInWorker({...}): { success: boolean; fileName: string } {
  this.sharedWorkerInstance?.port.postMessage({
    action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
    payload: { ... },
  });

  return {
    success: true,
    fileName,
  };  // Returns immediately without waiting for worker response
}
```

**What Could Go Wrong:**
- Function returns before worker even receives the message
- Promise never created for worker uploads
- `waitForAllUploads()` cannot wait for these uploads
- `endRecording()` proceeds before worker uploads complete
- Transaction committed with missing audio files

**Fix:**
```typescript
private async uploadAudioChunkInWorker({...}): Promise<{ success: boolean; fileName: string }> {
  return new Promise((resolve, reject) => {
    const messageId = crypto.randomUUID();

    const handler = (event: MessageEvent) => {
      if (event.data.messageId === messageId) {
        this.sharedWorkerInstance?.port.removeEventListener('message', handler);
        if (event.data.success) {
          resolve({ success: true, fileName });
        } else {
          reject(new Error(event.data.error));
        }
      }
    };

    this.sharedWorkerInstance?.port.addEventListener('message', handler);
    this.sharedWorkerInstance?.port.postMessage({
      action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
      payload: { ..., messageId },
    });
  });
}
```

---

### 10. Race Condition in Token Refresh Timeout

**File:** `eka-sdk/ekascribe-v2rx/shared-worker/s3-file-upload.ts:43-52`

**Buggy Code:**
```typescript
if (!isTokenRefreshInProgress) {
  isTokenRefreshInProgress = true;

  workerPort.postMessage({
    action: SHARED_WORKER_ACTION.REQUEST_TOKEN_REFRESH,
  });

  setTimeout(() => {
    if (isTokenRefreshInProgress) {
      console.error('[SharedWorker] Token refresh timeout');
      isTokenRefreshInProgress = false;
      pendingTokenRefreshResolvers.forEach((r) => r(false));
      pendingTokenRefreshResolvers = [];
    }
  }, 10000);
}
```

**What Could Go Wrong:**
- Timeout fires at 10s, resolves all pending requests with `false`
- If main thread sends `TOKEN_REFRESH_SUCCESS` at 10.1s, handler resolves again with `true`
- Resolvers called twice with different values
- Upload thinks refresh failed when it actually succeeded
- Possible unhandled promise rejection

**Fix:**
```typescript
setTimeout(() => {
  if (isTokenRefreshInProgress) {
    isTokenRefreshInProgress = false;
    const resolvers = [...pendingTokenRefreshResolvers];
    pendingTokenRefreshResolvers = [];  // Clear BEFORE resolving
    resolvers.forEach((r) => r(false));
  }
}, 10000);
```

---

### 11. Invalid TXN_ID Access Without Validation

**File:** `eka-sdk/ekascribe-v2rx/main/start-recording.ts:41-47`

**Buggy Code:**
```typescript
const txn_id = EkaScribeStore.txnID;
EkaScribeStore.sessionStatus[txn_id] = {
  ...EkaScribeStore.sessionStatus[txn_id],
  vad: {
    status: 'start',
  },
};
```

**What Could Go Wrong:**
- If `initTransaction()` was never called, `txnID` is empty string `''`
- `sessionStatus['']` is accessed and modified
- Multiple sessions accidentally share state under empty string key
- Two concurrent sessions corrupt each other's state

**Fix:**
```typescript
const txn_id = EkaScribeStore.txnID;
if (!txn_id) {
  return {
    error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
    status_code: SDK_STATUS_CODE.TXN_ERROR,
    message: 'Transaction not initialized. Call initTransaction first.',
  };
}
```

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

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:150-178`

**Buggy Code:**
```typescript
const sample_passed: number = this.vad_past.length - this.last_clip_index;

if (sample_passed > this.pref_length_samples) {
  if (this.sil_duration_acc > this.long_thsld) {
    this.last_clip_index =
      this.vad_past.length - Math.min(Math.floor(this.sil_duration_acc / 2), 5);
  }
}
```

**What Could Go Wrong:**
- `sil_duration_acc` is never bounded
- In very quiet environment, silence accumulates for hours
- No overflow checks - can become NaN or Infinity
- Silence detection logic becomes unpredictable

**Fix:**
```typescript
const MAX_SILENCE_ACC = this.max_length_samples * 2;
this.sil_duration_acc = Math.min(this.sil_duration_acc, MAX_SILENCE_ACC);
```

---

### 14. Missing Chunk Upload Error Recovery

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:288-327`

**Buggy Code:**
```typescript
async processAudioChunk({ audioFrames }: { audioFrames?: Float32Array }) {
  // ...
  try {
    const chunkInfo: TAudioChunksInfo = { ... };
    const audioChunkLength = audioFileManager.updateAudioInfo(chunkInfo);

    audioFileManager?.incrementInsertedSamples(...);
    audioBuffer.resetBufferState();

    await audioFileManager.uploadAudioToS3({ ... });
  } catch (error) {
    console.error('Error uploading audio chunk:', error);
    // NO RECOVERY: chunk already added, buffer reset, but upload failed
  }
}
```

**What Could Go Wrong:**
- Chunk added to `audioChunks` list before upload
- Buffer is reset before upload completes
- If upload fails, chunk is marked but never uploaded
- No retry mechanism, user unaware of failure

**Fix:**
```typescript
try {
  await audioFileManager.uploadAudioToS3({...});
} catch (error) {
  console.error('Error uploading audio chunk:', error);

  // Mark chunk as failed for retry
  if (audioChunkLength - 1 >= 0) {
    audioFileManager.audioChunks[audioChunkLength - 1].status = 'failure';
  }

  // Notify callback
  const onEventCallback = EkaScribeStore.eventCallback;
  if (onEventCallback) {
    onEventCallback({
      callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
      status: 'error',
      message: `Failed to upload chunk: ${error}`,
    });
  }
}
```

---

### 15. Invalid MicVAD Object Check

**File:** `eka-sdk/ekascribe-v2rx/main/start-recording.ts:27`

**Buggy Code:**
```typescript
const micVad = vadInstance?.getMicVad();
const isVadLoading = vadInstance?.isVadLoading();

if (isVadLoading || !micVad || Object.keys(micVad).length === 0) {
  // Retry
}
```

**What Could Go Wrong:**
- `Object.keys(micVad).length === 0` is unreliable
- A valid MicVAD may have 0 enumerable keys but still work
- Causes unnecessary retries
- User experiences unexplained delays

**Fix:**
```typescript
// Check for required methods instead of key count
if (!micVad || typeof micVad.start !== 'function' || typeof micVad.pause !== 'function') {
  // Retry - VAD not properly initialized
}
```

---

### 16. Resource Leak if MicVAD Initialization Fails

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/vad-web.ts:199-274`

**Buggy Code:**
```typescript
let selectedMicrophoneStream: MediaStream;
try {
  selectedMicrophoneStream = await navigator.mediaDevices.getUserMedia({...});
} catch (e: any) {
  if (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError') {
    selectedMicrophoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } else {
    throw e;
  }
}

this.micStream = selectedMicrophoneStream;

try {
  const vad = await MicVAD.new({...});
  this.micVad = vad;
} catch (e) {
  this.stopMicStream();
  throw e;
}
```

**What Could Go Wrong:**
- If error occurs between stream assignment and VAD creation
- Old stream may not be cleaned up before new one assigned
- Microphone resource locked indefinitely
- Mobile users must refresh browser to use mic again

**Fix:**
```typescript
// Clean up existing stream first
this.stopMicStream();

let selectedMicrophoneStream: MediaStream;
try {
  selectedMicrophoneStream = await navigator.mediaDevices.getUserMedia({...});
  this.micStream = selectedMicrophoneStream;

  const vad = await MicVAD.new({...});
  this.micVad = vad;
} catch (e) {
  this.stopMicStream();  // Always cleanup on any failure
  throw e;
}
```

---

### 17. Division by Zero in AudioBufferManager

**File:** `eka-sdk/ekascribe-v2rx/audio-chunker/audio-buffer-manager.ts:14-23`

**Buggy Code:**
```typescript
constructor(samplingRate: number, allocationTimeInSeconds: number) {
  this.samplingRate = samplingRate;
  this.incrementalAllocationSize = Math.floor(samplingRate * allocationTimeInSeconds);
  this.buffer = new Float32Array(this.incrementalAllocationSize);
}
```

**What Could Go Wrong:**
- If `allocationTimeInSeconds` is 0 or `samplingRate` is 0
- `incrementalAllocationSize` becomes 0
- Creates `new Float32Array(0)` - valid but useless
- Any audio append triggers buffer expansion
- Potential infinite loop or memory exhaustion

**Fix:**
```typescript
constructor(samplingRate: number, allocationTimeInSeconds: number) {
  if (samplingRate <= 0 || allocationTimeInSeconds <= 0) {
    throw new Error('samplingRate and allocationTimeInSeconds must be positive');
  }

  this.samplingRate = samplingRate;

  const minAllocationSize = Math.floor(samplingRate * 0.1); // Minimum 100ms
  this.incrementalAllocationSize = Math.max(
    Math.floor(samplingRate * allocationTimeInSeconds),
    minAllocationSize
  );

  this.buffer = new Float32Array(this.incrementalAllocationSize);
}
```

---

### 18. Singleton getInstance with Different Parameters

**File:** `eka-sdk/ekascribe-v2rx/index.ts` (getInstance pattern)

**Buggy Code:**
```typescript
static getEkaScribeInstance({ access_token, env, clientId }): EkaScribe {
  if (!EkaScribe.instance) {
    EkaScribe.instance = new EkaScribe({ access_token, env, clientId });
  }
  return EkaScribe.instance;
}
```

**What Could Go Wrong:**
- First call creates instance with `env: 'production'`
- Second call with `env: 'staging'` returns production instance
- Different clients in same app get wrong environment
- Silent configuration mismatch

**Fix:**
```typescript
static getEkaScribeInstance({ access_token, env, clientId }): EkaScribe {
  if (EkaScribe.instance) {
    // Warn if parameters differ
    if (EkaScribe.instance.env !== env || EkaScribe.instance.clientId !== clientId) {
      console.warn(
        'EkaScribe instance already exists with different configuration. ' +
        'Call resetInstance() first to change configuration.'
      );
    }
  } else {
    EkaScribe.instance = new EkaScribe({ access_token, env, clientId });
  }
  return EkaScribe.instance;
}
```

---

## Summary Table

| # | Issue | Severity | File | Impact |
|---|-------|----------|------|--------|
| 1 | Missing VAD null check | CRITICAL | start-recording.ts:22-37 | Silent initialization failure |
| 2 | Race condition in VAD state | CRITICAL | vad-web.ts:332-349 | Audio frames processed incorrectly |
| 3 | Duplicate success tracking | CRITICAL | audio-file-manager.ts:659 | Wrong file count, duplicate uploads |
| 4 | Memory leak in listeners | CRITICAL | audio-file-manager.ts:531 | Unbounded memory growth |
| 5 | Undefined session access | HIGH | index.ts:244-246 | TypeError crashes SDK |
| 6 | Safari permissions unsupported | HIGH | start-recording.ts:10-20 | 30%+ mobile users blocked |
| 7 | Timestamp overflow | HIGH | audio-buffer-manager.ts:93-119 | Malformed timestamps |
| 8 | Fire-and-forget upload | HIGH | pause-recording.ts:54-58 | Silent upload failures |
| 9 | Worker uploads not tracked | HIGH | audio-file-manager.ts:409-453 | Premature transaction commit |
| 10 | Token refresh race | HIGH | s3-file-upload.ts:43-52 | Double promise resolution |
| 11 | Empty TXN_ID validation | HIGH | start-recording.ts:41-47 | Cross-session state corruption |
| 12 | Callback exception uncaught | HIGH | vad-web.ts:220-232 | Recording crash on bad callback |
| 13 | Unbounded silence accumulation | MEDIUM | vad-web.ts:150-178 | Unpredictable silence detection |
| 14 | Missing chunk error recovery | MEDIUM | vad-web.ts:288-327 | Silent chunk upload failure |
| 15 | Invalid MicVAD check | MEDIUM | start-recording.ts:27 | Unnecessary retries |
| 16 | Resource leak on VAD failure | MEDIUM | vad-web.ts:199-274 | Mic locked after error |
| 17 | Division by zero potential | MEDIUM | audio-buffer-manager.ts:14-23 | Memory exhaustion |
| 18 | Singleton parameter mismatch | MEDIUM | index.ts | Wrong environment used |

---

## Recommended Fix Priority

### Immediate (Before Next Release)
- [ ] Fix #1: Add VAD null check
- [ ] Fix #4: Remove accumulated event listeners
- [ ] Fix #5: Add session status validation
- [ ] Fix #6: Add Safari permissions fallback
- [ ] Fix #11: Validate TXN_ID before use

### Short-term (Next Sprint)
- [ ] Fix #2: Make VAD start/pause async-aware
- [ ] Fix #3: Deduplicate success tracking
- [ ] Fix #8: Await pause upload
- [ ] Fix #9: Track worker upload promises
- [ ] Fix #12: Wrap user callbacks in try-catch

### Medium-term (Planned)
- [ ] Fix #7: Handle long recording timestamps
- [ ] Fix #10: Fix token refresh race condition
- [ ] Fix #13-18: Address remaining edge cases

---

*Generated from comprehensive codebase analysis*
