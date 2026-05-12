# EkaScribe SDK - Method Mapping (v2 -> v3)

## Legend

| Symbol | Meaning |
|--------|---------|
| -> | Method moved / renamed |
| (Alliance) | Delegates to Alliance SDK internally |
| (eka transport) | Uses eka-js-sdk's own transport layer |
| REMOVED | Method deleted, no replacement |
| @deprecated | Kept for backward compat, will be removed in future |

---

## EkaScribe (main class)

### v2 (current `index.ts`) -> v3 (`ekascribe.ts`)

| v2 Method | v3 Location | Notes |
|-----------|-------------|-------|
| `getEkaScribeInstance({ access_token, env, clientId, flavour })` | `getEkaScribeInstance(config: EkaScribeConfig)` | Config object replaces individual params. `env` replaced by `baseUrl`. |
| `initTransaction(request, sharedWorkerUrl?)` | `eka.initTransaction(request)` | (Alliance) Massages `TPostTransactionInitRequest` -> `CreateSessionRequest`. `sharedWorkerUrl` moved to `allianceConfig.useWorker`. Calls `allianceClient.reset()` before creating session. |
| `startRecording(microphoneID?)` | `eka.startRecording(microphoneID?)` | (Alliance) `allianceClient.startRecording({ deviceId })` |
| `startRecordingForExistingSession(request)` | `eka.startRecordingForExistingSession(request)` | (Alliance) Constructs `CreateSessionResponse` from existing data, calls `allianceClient.startRecordingWithSession()` |
| `pauseRecording()` | `eka.pauseRecording()` | (Alliance) |
| `resumeRecording()` | `eka.resumeRecording()` | (Alliance) |
| `endRecording()` | `eka.endRecording()` | (Alliance) Does NOT reset state. |
| `retryUploadRecording({ force_commit })` | `eka.retryUploadRecording()` | (Alliance) `allianceClient.retryFailedUploads()` |
| `discardSession(request)` | `eka.discardSession(request)` | (Alliance) Calls `allianceClient.discardSession()` (dummy for now) + patches status via eka transport + `allianceClient.reset()` |
| `commitTransactionCall()` | `eka.commitTransactionCall()` | @deprecated. Kept as-is, uses eka transport directly (post-transaction-commit API). |
| `stopTransactionCall()` | `eka.stopTransactionCall()` | @deprecated. Kept as-is, uses eka transport directly (post-transaction-stop API). |
| `getTemplateOutput({ txn_id })` | `eka.getTemplateOutput({ txn_id })` | (eka transport) Same behavior. |
| `getOutputTranscription({ txn_id })` | `eka.getOutputTranscription({ txn_id })` | (eka transport) Same behavior. |
| `pollSessionOutput(request)` | `eka.pollForCompletion(sessionId, options?)` | (Alliance) Renamed. Uses `allianceClient.pollForCompletion()`. |
| `patchSessionStatus(request)` | `eka.sessions.patchSessionStatus(request)` | Moved to SessionUtils. |
| `resetEkaScribe()` | `eka.resetInstance()` | Full teardown: reset Alliance, clear callbacks, null singleton. |
| `resetInstance()` | `eka.resetInstance()` | Same. |
| `updateAuthTokens({ access_token })` | `eka.setAccessToken(token)` | Renamed. Updates both eka transport + Alliance SDK. |
| `runSystemCompatibilityTest(callback, sharedWorker?)` | `eka.runSystemCompatibilityTest(callback, sharedWorker?)` | Same. Test 5 changed to ping-only (no S3). |

### Callbacks (v2 -> v3)

| v2 Method | v3 Method | Notes |
|-----------|-----------|-------|
| `onEventCallback(callback)` | `eka.registerCallback('onSessionEvent', handler)` | Unified callback API |
| `onUserSpeechCallback(callback)` | `eka.registerCallback('onAudioEvent', handler)` | Alliance SDK `onAudioEvent` with `type: 'user_speech'` |
| `onVadFramesCallback(callback)` | `eka.registerCallback('onAudioEvent', handler)` | Alliance SDK `onAudioEvent` with `type: 'chunk_ready'` |
| `onVadFrameProcessedCallback(callback)` | `eka.registerCallback('onAudioEvent', handler)` | Alliance SDK `onAudioEvent` with `type: 'frame_processed'` |
| `onPartialResultCallback(callback)` | `eka.registerCallback('onSessionEvent', handler)` | Alliance SDK `onSessionEvent` with `type: 'partial_result'` |
| — | `eka.registerCallback('onRecordingStateChange', handler)` | NEW. Recording lifecycle events. |
| — | `eka.registerCallback('onUploadEvent', handler)` | NEW. Upload progress/failure events. |
| — | `eka.registerCallback('onError', handler)` | NEW. Error notification events. |
| — | `eka.registerCallback('onTokenRequired', handler)` | NEW. Auth token refresh. |

### VAD Methods (v2 -> v3)

| v2 Method | v3 Status | Notes |
|-----------|-----------|-------|
| `reinitializeVad()` | REMOVED | Alliance SDK manages VAD lifecycle internally |
| `destroyVad()` | REMOVED | Alliance SDK manages VAD lifecycle internally |
| `pauseVad()` | REMOVED | Alliance SDK manages VAD lifecycle internally |
| `configureVadConstants({...})` | REMOVED | Configure via Alliance SDK config or recording options |

### Audio File Methods (v2 -> v3)

| v2 Method | v3 Status | Notes |
|-----------|-----------|-------|
| `getSuccessFiles()` | REMOVED | Alliance SDK tracks internally. Available via `endRecording` result or callbacks. |
| `getFailedFiles()` | REMOVED | Use `allianceClient.hasFailedUploads()` or `endRecording` result. |
| `getTotalAudioFiles()` | REMOVED | Available via callbacks. |
| `destroySharedWorker()` | REMOVED | Alliance SDK manages worker lifecycle. |
| `uploadAudioWithPresignedUrl(request)` | REMOVED | Use Alliance SDK's single-file upload (`uploadType: 'single'`). |

---

## DocumentManager (NEW - `eka.documents.*`)

All methods moved from v2 EkaScribe main class. Use eka transport.

| v2 Method (on EkaScribe) | v3 Method (on `eka.documents`) |
|--------------------------|-------------------------------|
| `getAllTemplates()` | `eka.documents.getAllTemplates()` |
| `createTemplate(template)` | `eka.documents.createTemplate(template)` |
| `updateTemplate(template)` | `eka.documents.updateTemplate(template)` |
| `deleteTemplate(template_id)` | `eka.documents.deleteTemplate(templateId)` |
| `aiGenerateTemplate(formData)` | `eka.documents.aiGenerateTemplate(formData)` |
| `postTransactionConvertToTemplate(request)` | `eka.documents.convertToTemplate(request)` |
| `convertTranscriptionToTemplate(request)` | `eka.documents.convertTranscriptionToTemplate(request)` |
| `getAllTemplateSections()` | `eka.documents.getAllTemplateSections()` |
| `createTemplateSection(section)` | `eka.documents.createTemplateSection(section)` |
| `updateTemplateSection(section)` | `eka.documents.updateTemplateSection(section)` |
| `deleteTemplateSection(section_id)` | `eka.documents.deleteTemplateSection(sectionId)` |
| `createDocument(request)` | `eka.documents.createDocument(request)` |
| `updateDocument(request)` | `eka.documents.updateDocument(request)` |
| `getDocument(document_id)` | `eka.documents.getDocument(documentId)` |
| `deleteDocument(document_id)` | `eka.documents.deleteDocument(documentId)` |
| `publishDocument(request)` | `eka.documents.publishDocument(request)` |

---

## SessionUtils (NEW - `eka.sessions.*`)

Methods moved from v2 EkaScribe main class + new Alliance SDK methods.

| v2 Method (on EkaScribe) | v3 Method (on `eka.sessions`) | Notes |
|--------------------------|------------------------------|-------|
| — | `eka.sessions.createSession(request)` | NEW. (Alliance) Standalone session creation without recording. |
| — | `eka.sessions.getSessionStatus(sessionId)` | NEW. (Alliance) Get session processing status. |
| `getSessionHistory({ txn_count, oid })` | `eka.sessions.getSessionHistory({ txn_count, oid })` | (eka transport) |
| `deleteSession({ txn_id })` | `eka.sessions.deleteSession({ txn_id })` | (eka transport) Delete past session from server. Different from `discardSession`. |
| `patchSessionStatus(request)` | `eka.sessions.patchSessionStatus(request)` | (eka transport) |
| `getSessionDetails({ session_id, presigned })` | `eka.sessions.getSessionDetails({ session_id, presigned })` | (eka transport) |
| `getChunkTranscript(txnId, chunkNumber)` | `eka.getChunkTranscript(txnId, chunkNumber)` | (eka transport) Stays on main class. |
| `getSuggestedMedications(txnId)` | `eka.sessions.getSuggestedMedications(txnId)` | (eka transport) |
| `addSessionContext({ txn_id, context })` | `eka.sessions.addSessionContext({ txn_id, context })` | (eka transport) |
| `removeSessionContext({ txn_id, context })` | `eka.sessions.removeSessionContext({ txn_id, context })` | (eka transport) |
| `updateResultSummary(request)` | `eka.sessions.updateResultSummary(request)` | (eka transport) |
| `getEkascribeConfig()` | `eka.sessions.getConfig()` | (eka transport) Renamed. |
| `getConfigMyTemplates()` | `eka.sessions.getConfigMyTemplates()` | (eka transport) |
| `updateConfig(request)` | `eka.sessions.updateConfig(request)` | (eka transport) |
| `getDoctorHeaderFooter(request)` | `eka.sessions.getDoctorHeaderFooter(request)` | (eka transport) |
| `getDoctorClinics(request)` | `eka.sessions.getDoctorClinics(request)` | (eka transport) |

---

## Removed Methods (no v3 equivalent)

| v2 Method | Reason |
|-----------|--------|
| `searchPastSessions(request)` | Client-side search removed. Not an SDK concern. |
| `searchSessionsByPatientName(request)` | Client-side search removed. |
| `searchSessionsBySessionId(request)` | Client-side search removed. |
| `reinitializeVad()` | Alliance SDK manages VAD. |
| `destroyVad()` | Alliance SDK manages VAD. |
| `pauseVad()` | Alliance SDK manages VAD. |
| `configureVadConstants({...})` | Alliance SDK config. |
| `getSuccessFiles()` | Alliance SDK tracks internally. |
| `getFailedFiles()` | Alliance SDK tracks internally. |
| `getTotalAudioFiles()` | Alliance SDK tracks internally. |
| `destroySharedWorker()` | Alliance SDK manages worker. |
| `uploadAudioWithPresignedUrl(request)` | Alliance SDK single-file upload. |

---

## Summary

| Category | v2 Count | v3 Count | Moved To |
|----------|----------|----------|----------|
| Recording (EkaScribe) | 8 | 8 | Same class, delegates to Alliance |
| Deprecated (EkaScribe) | 2 | 2 | Same class, eka transport |
| Output (EkaScribe) | 3 | 3 | Same class |
| Callbacks (EkaScribe) | 5 | 2 methods | `registerCallback` / `removeCallback` |
| Auth (EkaScribe) | 1 | 1 | Same class |
| Compatibility (EkaScribe) | 1 | 1 | Same class |
| Templates | 7 | 7 | `eka.documents.*` |
| Template Sections | 4 | 4 | `eka.documents.*` |
| Documents | 5 | 5 | `eka.documents.*` |
| Session CRUD | 5 | 7 | `eka.sessions.*` (+createSession, +getSessionStatus) |
| Config | 3 | 3 | `eka.sessions.*` |
| Profile | 2 | 2 | `eka.sessions.*` |
| VAD direct | 4 | 0 | REMOVED (Alliance manages) |
| Audio files | 4 | 0 | REMOVED (Alliance manages) |
| Search | 3 | 0 | REMOVED |
| **Total** | **57** | **45** | |
