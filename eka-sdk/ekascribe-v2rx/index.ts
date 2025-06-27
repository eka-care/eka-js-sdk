// ekascribe main Class having all the methods - Entry point

import { getVoiceApiV2Status } from './api/get-voice-api-v2-status';
import postTransactionCommit from './api/post-transaction-commit';
import postTransactionStop from './api/post-transaction-stop';
import AudioBufferManager from './audio-chunker/audio-buffer-manager';
import AudioFileManager from './audio-chunker/audio-file-manager';
import VadWebClient from './audio-chunker/vad-web';
import {
  AUDIO_BUFFER_SIZE_IN_S,
  DESP_CHUNK_LENGTH,
  FRAME_RATE,
  MAX_CHUNK_LENGTH,
  PREF_CHUNK_LENGTH,
  SAMPLING_RATE,
} from './constants/audio-constants';
import { UploadProgressCallback } from './constants/types';
import setEnv from './fetch-client/helper';
import endVoiceRecording from './main/end-recording';
import initTransactionMethod from './main/init-transaction-method';
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

  public initEkaScribe({
    access_token,
    refresh_token,
  }: {
    access_token?: string;
    refresh_token?: string;
  }) {
    // set access_token and refresh_token in env
    if (!access_token || !refresh_token) return;

    setEnv({
      auth_token: access_token,
      refresh_token,
    });
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
    mode,
  }: {
    input_language: string[];
    output_format_template: { template_id: string }[];
    mode: string;
  }) {
    this.mode = mode;
    EkaScribeStore.mode = mode;
    const initTransactionResponse = await initTransactionMethod({
      mode,
      input_language,
      output_format_template,
    });
    return initTransactionResponse;
  }

  async stopTransaction() {
    const audioInfo = this.audioFileManagerInstance.audioChunks;
    const audioFiles = audioInfo.map((audio) => audio.fileName);

    const stopTransactionResponse = await postTransactionStop({
      txnId: EkaScribeStore.txnID,
      audioFiles,
    });
    return stopTransactionResponse;
  }

  async commitTransaction() {
    const audioInfo = this.audioFileManagerInstance.audioChunks;
    const audioFiles = audioInfo.map((audio) => audio.fileName);

    const commitTransactionResponse = await postTransactionCommit({
      txnId: EkaScribeStore.txnID,
      audioFiles,
    });
    return commitTransactionResponse;
  }

  async getOutputSummary() {
    const outputSummaryResponse = await getVoiceApiV2Status({
      txnId: EkaScribeStore.txnID,
    });
    return outputSummaryResponse;
  }

  // TODO: MAKE EVERY FUNCTION IN CLASS - PRIVATE

  getSuccessFiles() {
    return this.audioFileManagerInstance.getSuccessfulUploads();
  }

  getFailedFiles() {
    return this.audioFileManagerInstance.getFailedUploads();
  }

  getTotalAudioFiles() {
    return this.audioFileManagerInstance.getTotalAudioChunks();
  }

  resetEkaScribe() {
    this.audioFileManagerInstance.resetFileManagerInstance();
    this.audioBufferInstance.resetBufferManagerInstance();
    EkaScribeStore.resetStore();
  }

  configureVadConstants({
    pref_length,
    desp_length,
    max_length,
    sr,
    frame_size,
    pre_speech_pad_frames,
    short_thsld,
    long_thsld,
  }: {
    pref_length: number;
    desp_length: number;
    max_length: number;
    sr: number;
    frame_size: number;
    pre_speech_pad_frames: number;
    short_thsld: number;
    long_thsld: number;
  }) {
    return this.vadInstance.configureVadConstants({
      pref_length,
      desp_length,
      max_length,
      sr,
      frame_size,
      pre_speech_pad_frames,
      short_thsld,
      long_thsld,
    });
  }

  // TODO: publish this to npm
}

export default EkaScribe;

const ekascribeInstance = new EkaScribe();

export const initEkaScribe = ekascribeInstance.initEkaScribe.bind(ekascribeInstance);

/**
 * Client side handling:
 * 1. waiting for network
 * 2. recording too short error - reset store and start again
 * 3. failed too fetch - fetch summaries again
 *
 */
