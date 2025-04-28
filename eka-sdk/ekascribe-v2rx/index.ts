// ekascribe main Class having all the methods

import postTransactionCommitV2 from './api/post-transaction-commit-v2';
import postTransactionInitV2 from './api/post-transaction-init-v2 copy';
import postTransactionStopV2 from './api/post-transaction-stop-v2';
import AudioBufferManager from './audio-chunker/audio-buffer-manager';
import AudioFileManager from './audio-chunker/audio-file-manager';
import VadWebClient from './audio-chunker/vad-web';
import {
  AUDIO_BUFFER_SIZE_IN_S,
  DESP_CHUNK_LENGTH,
  FRAME_RATE,
  MAX_CHUNK_LENGTH,
  PREF_CHUNK_LENGTH,
  S3_BUCKET_NAME,
  SAMPLING_RATE,
} from './constants/audio-constants';
import { UploadProgressCallback } from './constants/types';
import endVoiceRecording from './main/end-recording';
import initEkaScribe from './main/init-ekascribe';
import retryUploadFiles from './main/retry-upload-recording';
import startVoiceRecording from './main/start-recording';
import EkaScribeStore from './store/store';

class EkaScribe {
  private mode: string;
  private vadInstance; // vadWebClient Instance
  private audioFileManagerInstance; // AudioFileManager Instance
  private audioBufferInstance;

  constructor() {
    this.mode = 'dictation';
    EkaScribeStore.mode = this.mode;
    this.vadInstance = new VadWebClient(
      PREF_CHUNK_LENGTH,
      DESP_CHUNK_LENGTH,
      MAX_CHUNK_LENGTH,
      FRAME_RATE
    );
    EkaScribeStore.vadInstance = this.vadInstance;
    this.audioFileManagerInstance = new AudioFileManager();
    EkaScribeStore.audioFileManagerInstance = this.audioFileManagerInstance;
    this.audioBufferInstance = new AudioBufferManager(SAMPLING_RATE, AUDIO_BUFFER_SIZE_IN_S);
    EkaScribeStore.audioBufferInstance = this.audioBufferInstance;
  }

  async init({ mode }: { mode: string }) {
    this.mode = mode;
    EkaScribeStore.mode = mode;
    const initResponse = await initEkaScribe();
    return initResponse;
  }

  async startRecording() {
    const startResponse = await startVoiceRecording();
    return startResponse;
  }

  pauseRecording() {
    this.vadInstance?.pauseVad();
    return;
  }

  resumeRecording() {
    this.vadInstance?.startVad();
    return;
  }

  async endRecording() {
    const endRecordingResponse = await endVoiceRecording();
    return endRecordingResponse;
  }

  setProgressCallback(callback: UploadProgressCallback): void {
    this.audioFileManagerInstance.setProgressCallback(callback);
  }

  async retryUploadRecording() {
    const retryUploadResponse = await retryUploadFiles();
    return retryUploadResponse;
  }

  async initTransaction({
    input_language,
    output_format_template,
    transfer,
  }: {
    input_language: string[];
    output_format_template: { template_id: string }[];
    transfer: string;
  }) {
    const initTransactionResponse = await postTransactionInitV2({
      mode: this.mode,
      txnId: EkaScribeStore.txnID,
      s3Url: `s3://${S3_BUCKET_NAME}/${EkaScribeStore.s3FilePath}`,
      input_language,
      output_format_template,
      transfer,
    });
    return initTransactionResponse;
  }

  async stopTransaction() {
    const audioInfo = this.audioFileManagerInstance.audioChunks;
    const audioFiles = audioInfo
      .map((audio) => audio.fileName)
      .filter((fileName) => fileName !== 'som.json');
    const stopTransactionResponse = await postTransactionStopV2({
      txnId: EkaScribeStore.txnID,
      audioFiles,
    });
    return stopTransactionResponse;
  }

  async commitTransaction() {
    const audioInfo = this.audioFileManagerInstance.audioChunks;
    const audioFiles = audioInfo
      .map((audio) => audio.fileName)
      .filter((fileName) => fileName !== 'som.json');
    const commitTransactionResponse = await postTransactionCommitV2({
      txnId: EkaScribeStore.txnID,
      audioFiles,
    });
    return commitTransactionResponse;
  }

  // TODO
  async getOutputSummary() {}

  resetEkaScribe() {
    this.audioFileManagerInstance.resetFileManagerInstance();
    this.audioBufferInstance.resetBufferManagerInstance();
    EkaScribeStore.resetStore();
  }

  // TODO: publish this to npm
}

export default EkaScribe;

/**
 * Client side handling:
 * 1. waiting for network
 * 2. recording too short error - reset store and start again
 * 3. failed too fetch - fetch summaries again
 *
 */
