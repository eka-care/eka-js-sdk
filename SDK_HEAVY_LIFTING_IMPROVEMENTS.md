# SDK Heavy Lifting Improvements

Improvements to shift maximum work from the consumer app into the SDK.

---

## CRITICAL — Consumer shouldn't have to do this

### 1. Merge `initTransaction` into `startRecording`

**Current flow (consumer has to call 2 methods):**
```typescript
await sdk.initTransaction({ txn_id, input_language, mode, ... });
await sdk.startRecording();
```

**Proposed flow:**
```typescript
await sdk.startRecording({ txn_id, input_language, mode, ... });
// SDK calls initTransaction internally, then starts VAD + mic
```

- `initTransaction` only makes sense when a new session is started — the consumer shouldn't need to know about it
- If the consumer needs to pre-initialize (e.g., to validate config before recording), expose an optional `sdk.prepareSession()` method
- `startRecording` should be the single entry point

---

### 2. Auto-retry transaction APIs

**Current:** `init`, `stop`, `commit` API calls fail once and return error. Consumer wraps them in retry logic.

**Proposed:** SDK auto-retries transient failures (5xx, network timeout) with exponential backoff — same pattern already used for S3 uploads in `s3RetryWrapper`.

- Max 3 retries for transient errors (5xx, network timeout, CORS)
- No retry for permanent errors (4xx — bad request, auth failure, limit exceeded)
- Exponential backoff: 1s, 2s, 4s
- Emit callback on each retry attempt so consumer can show progress

---

### 3. Network resilience — auto pause/resume uploads

**Current:** If network drops mid-recording, uploads fail silently. Consumer monitors network state themselves.

**Proposed:**
- Listen to `online`/`offline` events on `window`
- When offline: pause upload dispatch, queue new chunks in memory
- When online: auto-resume queued uploads
- Emit `NETWORK_STATUS_CHANGED` callback so consumer can update UI
- Continue recording audio locally even while offline

---

### 4. Auto-poll for results in `endRecording()`

**Current:** After `endRecording()`, consumer must manually call `pollSessionOutput()` or loop on `getTemplateOutput()`.

**Proposed:**
```typescript
const result = await sdk.endRecording({ waitForResults: true, maxWaitTime: 120000 });
// result.data = transcription output directly
```

- Optional `waitForResults` flag (default `false` for backward compatibility)
- SDK handles polling internally with the existing `pollSessionOutput` logic
- Returns final results directly in the response
- Fires `onPartialResultCallback` during polling for progress updates

---

### 5. Proactive credential refresh

**Current:** S3 tokens refresh reactively on failure. Auth tokens require manual `updateAuthTokens()` call.

**Proposed:**
- Store S3 token expiry time, refresh 1-2 minutes before expiry
- Fire `TOKEN_REFRESH_REQUIRED` callback when auth token is about to expire (based on 401 response or JWT decode)
- Accept an `onTokenRefresh` callback during initialization:
```typescript
const sdk = getEkaScribeInstance({
  access_token,
  env,
  clientId,
  onTokenRefresh: async () => {
    const newToken = await myAuthService.refresh();
    return newToken;
  }
});
```
- SDK calls this automatically instead of failing and requiring consumer to detect + fix

---

## HIGH VALUE — Reduces consumer-side glue code

### 6. State machine enforcement

**Current:** Consumer can call `pauseRecording()` before `startRecording()`, or `endRecording()` twice. SDK does minimal checks.

**Proposed:** Enforce valid state transitions:
```
IDLE → RECORDING → PAUSED → RECORDING → STOPPING → COMMITTED → IDLE
```

- Reject invalid transitions with clear error: `"Cannot pause — recording has not started"`
- Prevent double calls: calling `endRecording()` twice returns the result of the first call instead of throwing

---

### 7. Convenience status methods

**Current:** Consumer tracks recording state in their own app state.

**Proposed:**
```typescript
sdk.isRecording()     // true if VAD is active and recording
sdk.isPaused()        // true if recording is paused
sdk.getSessionInfo()  // { status, duration, chunksUploaded, chunksFailed, txnId }
```

- Derived from existing store state — no new state needed
- Eliminates consumer-side state tracking for basic status queries

---

### 8. Auto-cleanup after session ends

**Current:** Consumer must call `resetEkaScribe()` between sessions or risk state leakage.

**Proposed:**
- Auto-reset internal state after `endRecording()` completes successfully
- Keep callbacks intact (consumer registered them once, shouldn't need to re-register)
- Add `autoCleanup` option if consumer wants to opt out:
```typescript
await sdk.endRecording({ autoCleanup: false }); // keep state for debugging
```

---

### 9. Enhanced error context

**Current:** Errors return `{ error_code, status_code, message }`. Consumer guesses if retry is safe.

**Proposed:** Add actionable fields:
```typescript
{
  error_code: 'AUDIO_UPLOAD_FAILED',
  status_code: 500,
  message: 'Audio upload failed for some files after retry.',
  canRetry: true,
  retryAfterMs: 2000,
  recommendedAction: 'Call retryUploadRecording() or check network connection',
  failed_files: ['3.mp3', '5.mp3'],
  total_audio_files: ['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3']
}
```

---

### 10. Upload queue with concurrency limit

**Current:** All chunks upload simultaneously. On slow networks, this overwhelms the connection.

**Proposed:**
- Max 3 concurrent uploads (configurable)
- Queue additional chunks
- If a chunk fails, move to back of queue for retry
- Adapt concurrency based on success rate (reduce to 1 if failures increase)

---

## NICE TO HAVE — Polish

### 11. Audio quality feedback

**Current:** SDK detects 10s silence and warns. No other audio quality analysis.

**Proposed:** Real-time audio quality callbacks:
- Volume too low — "Speak louder or move closer to the microphone"
- Clipping detected — "Volume is too high"
- Background noise level assessment
- Fires via existing `onEventCallback` with `CALLBACK_TYPE.AUDIO_QUALITY`

---

### 12. Debug mode

**Current:** Raw `console.log` scattered throughout production code.

**Proposed:**
```typescript
const sdk = getEkaScribeInstance({ debug: true, ... });
```
- Structured logs with timestamps and context
- Performance metrics: compression time, upload duration per chunk, API latency
- All logs go through single `logger` utility that respects the flag
- Remove existing raw `console.log` statements from production path

---

### 13. Callback unsubscribe pattern

**Current:** Callbacks are set but consumer can't cleanly unsubscribe (must set to `null`).

**Proposed:**
```typescript
const unsubscribe = sdk.onEventCallback((event) => { ... });
// Later:
unsubscribe();
```

---

### 14. Session persistence for page reload recovery

**Current:** Page reload loses entire session — all audio chunks, transaction state, everything.

**Proposed:**
- Persist session metadata + uploaded chunk list to IndexedDB (not raw audio — too large)
- On `getEkaScribeInstance()`, check for incomplete sessions
- Offer `sdk.recoverSession(txnId)` to resume — re-commit already-uploaded files
- Auto-clean stale sessions older than 24 hours

---

### 15. Automatic `system_info` collection

**Current:** Consumer must build `system_info` object with platform, language, device memory, network info, timezone.

**Proposed:** SDK collects this automatically:
```typescript
// Consumer currently has to do:
await sdk.initTransaction({
  system_info: {
    platform: navigator.platform,
    language: navigator.language,
    hardware_concurrency: navigator.hardwareConcurrency,
    device_memory: navigator.deviceMemory,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    network_info: { ... }
  },
  ...
});

// Should just be:
await sdk.startRecording({ ... });
// SDK fills system_info internally
```

---

### 16. Mic disconnection handling

**Current:** If the user unplugs their mic mid-recording, the `MediaStream` audio track fires an `ended` event. SDK doesn't listen for it — recording silently captures empty frames.

**Proposed:**
- Listen to `audioTrack.onended` event when mic stream is acquired
- Auto-pause recording when mic disconnects
- Fire callback: `CALLBACK_TYPE.MICROPHONE_DISCONNECTED`
- When a new mic is available (via `devicechange` event), notify consumer so they can resume
- Prevents silent capture of empty/garbage audio that wastes upload bandwidth and produces bad transcriptions

---

### 17. Recording duration method

**Current:** Duration is available inside `vadFrameProcessedCallback` (computed as `totalRawSamples / SAMPLING_RATE`), but consumer must subscribe to every frame just to get a number for their timer UI.

**Proposed:** Add an explicit on-demand method:
```typescript
sdk.getRecordingDuration() // → number (seconds)
```

- Internally reads from `audioFileManager.getRawSampleDetails().totalRawSamples / SAMPLING_RATE`
- Consumer queries at their own interval (e.g., `setInterval(() => updateTimer(sdk.getRecordingDuration()), 1000)`)
- No need to process every VAD frame just to display a timer
- Existing `vadFrameProcessedCallback` duration remains for consumers who need frame-level precision

---

## Priority Order for Implementation

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| P0 | #1 Merge initTransaction into startRecording | High | Low |
| P0 | #2 Auto-retry transaction APIs | High | Medium |
| P0 | #6 State machine enforcement | High | Medium |
| P0 | #16 Mic disconnection handling | High | Low |
| P1 | #3 Network resilience | High | Medium |
| P1 | #4 Auto-poll in endRecording | High | Low |
| P1 | #7 Convenience status methods | Medium | Low |
| P1 | #8 Auto-cleanup | Medium | Low |
| P1 | #15 Auto system_info collection | Medium | Low |
| P1 | #17 Recording duration method | Medium | Low |
| P2 | #5 Proactive credential refresh | Medium | Medium |
| P2 | #9 Enhanced error context | Medium | Low |
| P2 | #10 Upload concurrency limit | Medium | Medium |
| P2 | #12 Debug mode | Medium | Medium |
| P3 | #11 Audio quality feedback | Low | Medium |
| P3 | #13 Callback unsubscribe | Low | Low |
| P3 | #14 Session persistence | Low | High |
