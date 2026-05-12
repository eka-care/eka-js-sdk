/**
 * EkaScribe SDK — ES6 (Legacy) Example
 * Package: @eka-care/ekascribe-ts-sdk-legacy
 *
 * Same SDK source, but built targeting ES6 with polyfills for legacy browser support.
 * The API surface is identical to the ES11 package.
 *
 * Flows covered:
 * 1. Live recording (with SharedWorker)
 * 2. Live recording (without SharedWorker)
 * 3. Pre-recorded audio upload
 * 4. Session management, templates, documents
 *
 * Replace ACCESS_TOKEN with a valid token before running.
 */

import {
  getEkaScribeInstance,
  getWorkerUrl,
  type EkaScribeConfig,
  type CreateSessionRequest,
  TEMPLATE_ID,
} from '../../eka-sdk/ekascribe-v2rx/index';

const ACCESS_TOKEN = '<YOUR_ACCESS_TOKEN>';
const ALLIANCE_BASE_URL = '<YOUR_ALLIANCE_BASE_URL>'; // e.g. https://scribe.eka.care

// ─── Setup: With SharedWorker ───────────────────────────────────────────────
// SharedWorker offloads audio uploads to a background thread.
// Use getWorkerUrl() from the Alliance SDK to resolve the worker bundle URL.

function createInstanceWithWorker() {
  const config: EkaScribeConfig = {
    access_token: ACCESS_TOKEN,
    env: 'DEV',
    clientId: 'test-client-legacy',
    flavour: 'web',
    sharedWorkerUrl: getWorkerUrl(),
    allianceConfig: {
      baseUrl: ALLIANCE_BASE_URL,
      debug: true,
    },
  };
  return getEkaScribeInstance(config);
}

// ─── Setup: Without SharedWorker ────────────────────────────────────────────
// No SharedWorker — uploads happen on main thread.
// Use this when SharedWorker is not supported (e.g. some mobile browsers).

function createInstanceWithoutWorker() {
  const config: EkaScribeConfig = {
    access_token: ACCESS_TOKEN,
    env: 'DEV',
    clientId: 'test-client-legacy',
    flavour: 'web',
    allianceConfig: {
      baseUrl: ALLIANCE_BASE_URL,
      useWorker: false,
      debug: true,
    },
  };
  return getEkaScribeInstance(config);
}

// ─── Flow 1: Live Recording ─────────────────────────────────────────────────

async function testLiveRecording(withWorker: boolean) {
  console.log(`\n=== Live Recording (${withWorker ? 'with' : 'without'} SharedWorker) ===\n`);

  const sdk = withWorker ? createInstanceWithWorker() : createInstanceWithoutWorker();

  // Register callbacks
  sdk.registerCallback('onTokenRequired', async () => {
    console.log('[Auth] Token expired, refreshing...');
    return '<REFRESHED_TOKEN>';
  });

  sdk.registerCallback('onSessionEvent', (event) => {
    console.log('[Event]', event);
  });

  // Step 1: Init transaction
  const initResult = await sdk.initTransaction({
    txn_id: `live-legacy-${Date.now()}`,
    mode: 'dictation',
    input_language: ['en'],
    output_language: 'en',
    model_type: 'default',
    output_format_template: [{ template_id: '3d707c1c-311e-4424-80e9-e5d7a229d519' }],
    patient_details: {
      username: 'Jane Doe',
      age: 42,
      biologicalSex: 'female',
    },
  });
  console.log('Init:', initResult);
  if (initResult.error_code) return;

  const txnId = initResult.txn_id!;

  // Step 2: Start recording
  const startResult = await sdk.startRecording();
  console.log('Start:', startResult);

  // Step 3: Pause / Resume
  console.log('Pause:', sdk.pauseRecording());
  console.log('Resume:', sdk.resumeRecording());

  // Step 4: End recording
  const endResult = await sdk.endRecording();
  console.log('End:', endResult);

  if (endResult.failed_files?.length) {
    console.log('Retrying failed uploads...');
    const retryResult = await sdk.retryUploadRecording();
    console.log('Retry:', retryResult);
  }

  // Step 5: Poll for output
  const status = await sdk.getSessionStatus(txnId, {
    poll: { maxAttempts: 30, intervalMs: 2000 },
  });
  console.log('Status:', status);

  await sdk.resetInstance();
}

// ─── Flow 2: Pre-recorded Audio Upload ──────────────────────────────────────

async function testPreRecordedAudio() {
  console.log('\n=== Pre-recorded Audio Upload ===\n');

  const sdk = createInstanceWithoutWorker();

  // Step 1: Create session
  const sessionRequest: CreateSessionRequest = {
    templates: ['3d707c1c-311e-4424-80e9-e5d7a229d519'],
    model: 'pro',
    language_hint: ['en'],
    transcript_language: 'en',
    upload_type: 'single',
    communication_protocol: 'http',
    session_mode: 'dictation',
    additional_data: {
      audio_file_names: ['recording.mp3'],
    },
  };

  const sessionResult = await sdk.sessions.createSession(sessionRequest);
  console.log('Session:', sessionResult);
  if (!sessionResult.success) return;

  const { session_id, upload_url } = sessionResult.data;

  // Step 2: Upload audio file
  const audioBlob = new Blob(['fake-audio-data'], { type: 'audio/mpeg' });
  const uploadResult = await sdk.processPreRecordedAudio({
    uploadUrl: upload_url,
    audioFile: audioBlob,
    audioFileName: 'recording.mp3',
  });
  console.log('Upload:', uploadResult);

  // Step 3: End session
  const patchResult = await sdk.sessions.patchSessionStatus(
    { user_status: 'completed' },
    session_id
  );
  console.log('Patch:', patchResult);

  // Step 4: Poll for output
  const status = await sdk.getSessionStatus(session_id, {
    poll: { maxAttempts: 30, intervalMs: 2000 },
  });
  console.log('Status:', status);

  await sdk.resetInstance();
}

// ─── Flow 3: Session Management ─────────────────────────────────────────────

async function testSessionManagement() {
  console.log('\n=== Session Management ===\n');

  const sdk = createInstanceWithoutWorker();

  const history = await sdk.sessions.getSessionHistory({ txn_count: 5 });
  console.log('History:', history);

  const config = await sdk.sessions.getConfig();
  console.log('Config:', config);

  const discovery = sdk.sessions.getDiscoveryDocument();
  console.log('Discovery:', discovery);

  await sdk.resetInstance();
}

// ─── Flow 4: Templates & Documents ──────────────────────────────────────────

async function testTemplatesAndDocuments() {
  console.log('\n=== Templates & Documents ===\n');

  const sdk = createInstanceWithoutWorker();

  const templates = await sdk.documents.getAllTemplates();
  console.log('Templates:', templates);

  const sections = await sdk.documents.getAllTemplateSections();
  console.log('Sections:', sections);

  await sdk.resetInstance();
}

// ─── Run ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await testLiveRecording(true); // with SharedWorker
    await testLiveRecording(false); // without SharedWorker
    await testPreRecordedAudio();
    await testSessionManagement();
    await testTemplatesAndDocuments();
    console.log('\nAll tests done.');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main();
