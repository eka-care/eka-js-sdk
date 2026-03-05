import { NonRealTimeVAD } from '@ricky0123/vad-web';

// ─── Constants — exact match with constants/constant.ts ───────────────────────
const FRAME_SIZE              = 1024;
const SAMPLING_RATE           = 16000;
const FRAME_RATE              = SAMPLING_RATE / FRAME_SIZE;   // 15.625
const PREF_CHUNK_LENGTH       = 10;
const DESP_CHUNK_LENGTH       = 20;
const MAX_CHUNK_LENGTH        = 25;
const SHORT_SILENCE_THRESHOLD = 0.1;
const LONG_SILENCE_THRESHOLD  = 0.25;
const PRE_SPEECH_PAD_FRAMES   = 10;
const SPEECH_THRESHOLD        = 0.5;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.22/dist/silero_vad_legacy.onnx';
const ORT_WASM  = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';

// ─── Exact replica of processVadFrame from vad-web.ts ────────────────────────
function makeVadState() {
  const sr = FRAME_RATE;
  return {
    vad_frame_count:     0,
    last_clip_index:     0,
    last_clip_point:     0,
    sil_duration_acc:    0,
    pref_length_samples: PREF_CHUNK_LENGTH * sr,
    desp_length_samples: DESP_CHUNK_LENGTH * sr,
    max_length_samples:  MAX_CHUNK_LENGTH  * sr,
    shor_thsld:          SHORT_SILENCE_THRESHOLD * sr,
    long_thsld:          LONG_SILENCE_THRESHOLD  * sr,
  };
}

function processVadFrame(state, vad_frame) {
  let clipped = false;
  let clip_type = null;

  if (state.vad_frame_count > 0) {
    if (vad_frame === 0) {
      state.sil_duration_acc = Math.min(state.sil_duration_acc + 1, state.max_length_samples * 2);
    }
    if (vad_frame === 1) {
      state.sil_duration_acc = 0;
    }
  }

  const sample_passed = state.vad_frame_count - state.last_clip_index;

  if (sample_passed > state.pref_length_samples && state.sil_duration_acc > state.long_thsld) {
    state.last_clip_index = state.vad_frame_count - Math.min(Math.floor(state.sil_duration_acc / 2), 5);
    state.last_clip_point = state.last_clip_index;
    state.sil_duration_acc = 0;
    clipped = true; clip_type = 'PREF';
  }

  if (sample_passed > state.desp_length_samples && state.sil_duration_acc > state.shor_thsld) {
    state.last_clip_index = state.vad_frame_count - Math.min(Math.floor(state.sil_duration_acc / 2), 5);
    state.last_clip_point = state.last_clip_index;
    state.sil_duration_acc = 0;
    clipped = true; clip_type = 'DESP';
  }

  if (sample_passed >= state.max_length_samples) {
    state.last_clip_index = state.vad_frame_count;
    state.last_clip_point = state.last_clip_index;
    state.sil_duration_acc = 0;
    clipped = true; clip_type = 'MAX';
  }

  state.vad_frame_count++;
  return { clipped, clip_type };
}

// ─── Decode audio file → mono Float32Array at 16kHz ──────────────────────────
async function decodeAudioTo16k(arrayBuffer) {
  const tmpCtx = new AudioContext();
  const decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  await tmpCtx.close();

  const targetLength = Math.ceil(decoded.duration * SAMPLING_RATE);
  const offlineCtx = new OfflineAudioContext(1, targetLength, SAMPLING_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

// ─── Run Silero VAD → per-frame decisions ────────────────────────────────────
async function runSileroVAD(samples) {
  const vad = await NonRealTimeVAD.new({
    modelURL: MODEL_URL,
    // Fix: Vite ESM bundling loses currentScript so ort can't find its WASM.
    // Pass them explicitly via ortConfig callback.
    ortConfig: (ort) => {
      ort.env.wasm.wasmPaths = ORT_WASM;
    },
    frameSamples:            FRAME_SIZE,
    preSpeechPadFrames:      PRE_SPEECH_PAD_FRAMES,
    positiveSpeechThreshold: SPEECH_THRESHOLD,
    negativeSpeechThreshold: SPEECH_THRESHOLD - 0.15,
  });

  const speechSegments = [];
  for await (const { start, end } of vad.run(samples, SAMPLING_RATE)) {
    speechSegments.push({ start, end });
  }

  // Reconstruct per-frame vad_dec (1=speech, 0=silence) from Silero segments.
  // NOTE: NonRealTimeVAD.run() yields start/end in MILLISECONDS
  // (formula: frameIndex * frameSamples / 16, where /16 converts 16kHz samples → ms).
  // To get frame index: ms / (FRAME_SIZE / SAMPLING_RATE * 1000) = ms * SAMPLING_RATE / (FRAME_SIZE * 1000)
  const totalFrames = Math.floor(samples.length / FRAME_SIZE);
  const frameDecisions = new Uint8Array(totalFrames);
  for (const { start, end } of speechSegments) {
    const s = Math.max(0, Math.floor(start * SAMPLING_RATE / (FRAME_SIZE * 1000)));
    const e = Math.min(totalFrames, Math.ceil(end   * SAMPLING_RATE / (FRAME_SIZE * 1000)));
    for (let f = s; f < e; f++) frameDecisions[f] = 1;
  }

  return { frameDecisions, speechSegments, totalFrames };
}

// ─── Process one file ─────────────────────────────────────────────────────────
async function processFile(file, setStatus) {
  setStatus('Decoding audio…');
  const arrayBuffer = await file.arrayBuffer();
  const samples = await decodeAudioTo16k(arrayBuffer);

  setStatus(`Running Silero VAD on ${(samples.length / SAMPLING_RATE).toFixed(1)}s audio…`);
  const { frameDecisions, speechSegments, totalFrames } = await runSileroVAD(samples);

  setStatus('Running processVadFrame…');
  const state = makeVadState();
  const chunks = [];
  const timelineDecisions = [];
  let chunkStart = 0, speechFrames = 0, silenceFrames = 0;
  let totalSpeech = 0, totalSilence = 0;

  for (let f = 0; f < totalFrames; f++) {
    const vad_dec = frameDecisions[f];
    vad_dec === 1 ? (speechFrames++, totalSpeech++) : (silenceFrames++, totalSilence++);
    timelineDecisions.push(vad_dec);

    const { clipped, clip_type } = processVadFrame(state, vad_dec);
    if (clipped) {
      chunks.push({ startFrame: chunkStart, endFrame: f, frames: f - chunkStart, speechFrames, silenceFrames, clipType: clip_type });
      chunkStart = f + 1; speechFrames = 0; silenceFrames = 0;
    }
  }

  const remaining = state.vad_frame_count - state.last_clip_index;
  if (remaining > 0) {
    chunks.push({ startFrame: chunkStart, endFrame: totalFrames, frames: remaining, speechFrames, silenceFrames, clipType: 'END' });
  }

  return { file, durationS: (samples.length / SAMPLING_RATE).toFixed(2), chunks, speechSegments, totalSpeech, totalSilence, totalFrames, timelineDecisions };
}

// ─── Render ───────────────────────────────────────────────────────────────────
function toTimestamp(frames) {
  const secs = frames / FRAME_RATE;
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

function renderResult({ file, durationS, chunks, speechSegments, totalSpeech, totalSilence, totalFrames, timelineDecisions }) {
  const total = totalSpeech + totalSilence;
  const speechPct  = total > 0 ? ((totalSpeech  / total) * 100).toFixed(1) : 0;
  const silencePct = total > 0 ? ((totalSilence / total) * 100).toFixed(1) : 0;
  const avgChunk   = chunks.length > 0 ? (chunks.reduce((s, c) => s + c.frames, 0) / chunks.length / FRAME_RATE).toFixed(2) : '—';

  const clipCounts = { PREF: 0, DESP: 0, MAX: 0, END: 0 };
  chunks.forEach(c => { clipCounts[c.clipType] = (clipCounts[c.clipType] || 0) + 1; });

  // Timeline
  const step = Math.max(1, Math.floor(totalFrames / 600));
  const clipFrameSet = new Set(chunks.map(c => Math.floor(c.endFrame / step)));
  let tlHTML = '';
  for (let i = 0; i < Math.ceil(totalFrames / step); i++) {
    if (clipFrameSet.has(i)) tlHTML += `<div class="tl-frame tl-clip" style="width:2px"></div>`;
    else tlHTML += `<div class="tl-frame ${(timelineDecisions[i * step] ?? 0) === 1 ? 'tl-speech' : 'tl-silence'}" style="width:1px"></div>`;
  }

  const rows = chunks.map((c, i) => {
    const dS = (c.frames / FRAME_RATE).toFixed(2);
    const sp = c.frames > 0 ? ((c.speechFrames  / c.frames) * 100).toFixed(0) : 0;
    const sl = c.frames > 0 ? ((c.silenceFrames / c.frames) * 100).toFixed(0) : 0;
    return `<tr>
      <td>${i + 1}</td><td>${toTimestamp(c.startFrame)}</td><td>${toTimestamp(c.endFrame)}</td>
      <td>${dS}s</td><td class="clip-${c.clipType}">${c.clipType}</td>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <div class="speech-bar"><div class="speech-fill" style="width:${sp}%"></div><div class="silence-fill" style="width:${sl}%"></div></div>
        <span style="color:#4caf50">${sp}%</span>/<span style="color:#555">${sl}%</span>
      </div></td>
    </tr>`;
  }).join('');

  // start/end are in ms — divide by 1000 for seconds display
  const segRows = speechSegments.map(({ start, end }) =>
    `<tr><td>${(start / 1000).toFixed(3)}s</td><td>${(end / 1000).toFixed(3)}s</td><td>${((end - start) / 1000).toFixed(3)}s</td></tr>`
  ).join('');

  return `
  <div class="file-result">
    <div class="file-header">
      <div class="file-name">${file.name}</div>
      <div class="file-meta">${durationS}s &nbsp;|&nbsp; ${(file.size / 1024).toFixed(1)} KB</div>
    </div>
    <div class="summary-bar">
      <div class="stat"><div class="stat-label">Duration</div><div class="stat-value">${durationS}s</div></div>
      <div class="stat"><div class="stat-label">Chunks</div><div class="stat-value">${chunks.length}</div></div>
      <div class="stat"><div class="stat-label">Avg Chunk</div><div class="stat-value">${avgChunk}s</div></div>
      <div class="stat"><div class="stat-label">Speech Frames</div><div class="stat-value" style="color:#4caf50">${totalSpeech} (${speechPct}%)</div></div>
      <div class="stat"><div class="stat-label">Silence Frames</div><div class="stat-value" style="color:#666">${totalSilence} (${silencePct}%)</div></div>
      <div class="stat"><div class="stat-label">Silero Segments</div><div class="stat-value">${speechSegments.length}</div></div>
      <div class="stat"><div class="stat-label">Clips</div><div class="stat-value">
        <span class="clip-PREF">PREF×${clipCounts.PREF}</span>&nbsp;
        <span class="clip-DESP">DESP×${clipCounts.DESP}</span>&nbsp;
        <span class="clip-MAX">MAX×${clipCounts.MAX}</span>&nbsp;
        <span style="color:#888">END×${clipCounts.END}</span>
      </div></div>
    </div>
    <div class="timeline-wrap">
      <div class="timeline-label">Timeline — <span style="color:#4caf50">█</span> speech &nbsp;<span style="color:#333">█</span> silence &nbsp;<span style="color:#f44336">|</span> clip</div>
      <div class="timeline">${tlHTML}</div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>Clip Type</th><th>Speech / Silence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <details style="padding:12px 18px;border-top:1px solid #222;">
      <summary style="cursor:pointer;font-size:12px;color:#666;margin-bottom:8px;">Silero raw segments (${speechSegments.length})</summary>
      <table style="margin-top:8px;">
        <thead><tr><th>Start</th><th>End</th><th>Duration</th></tr></thead>
        <tbody>${segRows}</tbody>
      </table>
    </details>
  </div>`;
}

// ─── Entry ────────────────────────────────────────────────────────────────────
async function handleFiles(files) {
  const fileList = Array.from(files);
  if (!fileList.length) return;

  const container = document.getElementById('results');
  container.innerHTML = '';

  for (const file of fileList) {
    // Create a stable container div — never replace it, only update innerHTML
    const card = document.createElement('div');
    card.className = 'file-result';
    card.innerHTML = `<div class="status"><div class="spinner"></div> Starting…</div>`;
    container.appendChild(card);

    try {
      const result = await processFile(file, (msg) => {
        card.innerHTML = `<div class="status"><div class="spinner"></div> ${msg}</div>`;
      });
      card.innerHTML = renderResult(result)
        .replace(/^[\s\S]*?<div class="file-result">/, '')   // strip outer wrapper
        .replace(/<\/div>\s*$/, '');                          // strip closing tag
    } catch (err) {
      console.error('[VAD Test] Error processing', file.name, err);
      card.innerHTML = `<div class="error-msg">
        <b>${file.name}</b><br/>
        ${err?.message || String(err)}
      </div>`;
    }
  }
}

document.getElementById('file-input').addEventListener('change', (e) => handleFiles(e.target.files));
document.getElementById('upload-area').addEventListener('dragover', (e) => e.preventDefault());
document.getElementById('upload-area').addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });
