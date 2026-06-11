---

## Known Issues (Historical)

### v2.1.39 - Audio Chunk Accumulation Bug

**Symptom:** In some sessions, later chunks (e.g., `10.mp3`) contained all accumulated audio from the entire session rather than just their own segment. Chunks grew progressively larger:

| Chunk | Expected | Actual (buggy) |
|-------|----------|-----------------|
| 1.mp3 | ~10s | ~10s |
| 2.mp3 | ~10s | ~20s (chunks 1+2) |
| 3.mp3 | ~10s | ~30s (chunks 1+2+3) |
| ... | ... | ... |
| 10.mp3 | ~10s | ~100s (all audio) |

**Root Cause: Closure vs Store Reference Mismatch**

Two code paths used different references to the `AudioBufferManager`:

1. **`onFrameProcessed` callback** (in `vad-web.ts`) captured `audioBuffer` in a **closure** when `initVad()` was called:

```ts
async initVad(deviceId?) {
    const audioBuffer = EkaScribeStore.audioBufferInstance; // captured once in closure

    const vad = await MicVAD.new({
        onFrameProcessed: (prob, frames) => {
            audioBuffer?.append(frames);                      // appends to CLOSURE ref
            if (is_clip_point) {
                const chunk = audioBuffer?.getAudioData();    // reads from CLOSURE ref
                this.processAudioChunk({ audioFrames: chunk });
            }
        },
    });
}
```

2. **`processAudioChunk`** read `audioBuffer` from the **store** on every call:

```ts
async processAudioChunk({ audioFrames }) {
    const audioBuffer = EkaScribeStore.audioBufferInstance; // fetched from store each time
    if (!audioFrames || !audioFileManager || !audioBuffer) return; // early exit = no reset
    // ...
    audioBuffer.resetBufferState(); // resets the STORE's buffer, not the closure's
}
```

**Trigger condition:** If `initTransaction()` was called again during an active recording session (e.g., user started a new session without ending the previous one):

1. `initTransaction()` called `EkaScribeStore.resetStore()` and created **new** `AudioBufferManager` (B) in the store
2. The **old** MicVAD was never destroyed — it kept running with its closure still referencing the **old** buffer (A)
3. `onFrameProcessed` kept appending frames to old buffer **A** (closure ref)
4. `processAudioChunk` fetched new buffer **B** from the store and called `resetBufferState()` on **B**
5. Old buffer **A** was **never reset** — it accumulated all audio from the start of the session
6. Each `getAudioData()` on buffer A returned progressively more data

**Why "some sessions":** This only triggered when the consumer app called `initTransaction()` a second time without first calling `endRecording()`. Normal single-session flows had matching closure and store references, so they worked correctly.

**When does the old MicVAD / Buffer A stop?**

It doesn't — not on its own. The old MicVAD instance keeps running indefinitely because:

1. **`resetStore()` only nulls JS references** — it never calls `destroyVad()` or `vad.pause()`/`vad.destroy()` on the old instance
2. **The Web Audio API keeps internal references** — even after EkaScribeStore drops its reference, the browser's AudioContext still holds a reference chain: `AudioContext → AudioWorklet → MicVAD callbacks`. This prevents garbage collection.
3. **The microphone stream stays open** — the old `getUserMedia` stream is never stopped (`track.stop()` is never called), so the mic keeps feeding frames into the old MicVAD
4. **The old `onFrameProcessed` closure keeps firing** — appending to Buffer A on every frame (~64ms intervals at 16kHz/1024 samples)

This means:
- **Buffer A grows without bound** for the lifetime of the page
- **Old chunk uploads go to the old session's S3 path** — the closure also captured the old `audioFileManager`, which has the old `filePath` (e.g., `{date}/{old-txn-id}/{n}.mp3`). These orphaned uploads land in S3 under the previous session's directory.
- **The mic is shared** — both old and new MicVAD instances read from the same physical microphone, so both process the same audio frames

The old MicVAD only stops when:
- The browser tab is closed or navigated away (AudioContext is garbage collected)
- The page calls `destroyVad()` explicitly (which was never done in this code path)

**Impact beyond chunk accumulation:**
- Memory leak: Buffer A's `Float32Array` grows unbounded (~128KB/s at 16kHz mono)
- CPU waste: old MicVAD still runs VAD inference on every frame
- Duplicate S3 uploads: same audio uploaded to both old and new session paths
- Potential mic contention issues on some browsers

**Resolution:** The recording logic was migrated to `med-scribe-alliance-ts-sdk`, which manages its own buffer lifecycle internally. The Alliance SDK's `RecordingManager` has proper `forceStop()`, `reset()`, and `cleanupRecordingState()` methods that destroy the VAD instance, stop media tracks, and clear buffers before starting a new session. The wrapper calls `clearRecordingState()` before each new `startRecordingV2()`, ensuring no zombie instances survive.

---