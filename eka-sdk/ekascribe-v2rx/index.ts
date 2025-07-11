// ekascribe main Class having all the methods - Entry point

import { getConfigV2 } from './api/get-voice-api-v2-config';
import { getVoiceApiV2Status, TGetStatusResponse } from './api/get-voice-api-v2-status';
import patchTransactionStatus, { processingError } from './api/patch-transaction-status';
import postTransactionCommit from './api/post-transaction-commit';
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
import { PROCESSING_STATUS } from './constants/enums';
import {
  TErrorCallback,
  TPostTransactionResponse,
  TStartRecordingRequest,
} from './constants/types';
import setEnv from './fetch-client/helper';
import endVoiceRecording from './main/end-recording';
import pauseVoiceRecording from './main/pause-recording';
import resumeVoiceRecorfing from './main/resume-recording';
import retryUploadFailedFiles from './main/retry-upload-recording';
import startVoiceRecording from './main/start-recording';
import EkaScribeStore from './store/store';

class EkaScribe {
  private vadInstance; // vadWebClient Instance
  private audioFileManagerInstance; // AudioFileManager Instance
  private audioBufferInstance;

  constructor() {
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

  public async getEkascribeConfig() {
    return await getConfigV2();
  }

  public updateAuthTokens({
    access_token,
    refresh_token,
  }: {
    access_token: string;
    refresh_token: string;
  }) {
    setEnv({
      auth_token: access_token,
      refresh_token,
    });
  }

  // TODO: callbacks - excalidraw dependency

  async startRecording({
    mode,
    input_language,
    output_format_template,
    txn_id,
  }: TStartRecordingRequest) {
    /*
    Client side handling:
    1. check network
    2. check microphone permission
    */
    const startResponse = await startVoiceRecording({
      mode,
      input_language,
      output_format_template,
      txn_id,
    });
    return startResponse;
  }

  async pauseRecording() {
    const pauseRecordingResponse = await pauseVoiceRecording();
    return pauseRecordingResponse;
  }

  resumeRecording() {
    const resumeRecordingResponse = resumeVoiceRecorfing();
    return resumeRecordingResponse;
  }

  async endRecording() {
    const endRecordingResponse = await endVoiceRecording();
    return endRecordingResponse;
  }

  async retryUploadRecording({ force_commit }: { force_commit: boolean }) {
    const retryUploadResponse = await retryUploadFailedFiles({ force_commit });
    return retryUploadResponse;
  }

  async cancelRecordingSession({ txn_id }: { txn_id: string }): Promise<TPostTransactionResponse> {
    try {
      const patchTransactionResponse = await patchTransactionStatus({
        sessionId: txn_id,
        processing_status: PROCESSING_STATUS.CANCELLED,
        processing_error: processingError,
      });

      this.resetEkaScribe();

      return patchTransactionResponse;
    } catch (error) {
      console.error('Error cancelling recording session:', error);
      return {
        code: 520,
        message: `Failed to cancel recording session, ${error}`,
      } as TPostTransactionResponse;
    }
  }

  async commitTransactionCall(): Promise<TPostTransactionResponse> {
    try {
      const audioInfo = this.audioFileManagerInstance?.audioChunks;
      const audioFiles = audioInfo.map((audio) => audio.fileName);

      const postTransactionResponse = await postTransactionCommit({
        audioFiles,
        txnId: EkaScribeStore.txnID,
      });

      return postTransactionResponse;
    } catch (error) {
      console.error('Error in transaction commit: ', error);
      return {
        code: 520,
        message: `Failed to cancel recording session, ${error}`,
      } as TPostTransactionResponse;
    }
  }

  async stopTransactionCall() {
    // call endRecording method since all the steps are same
    const endRecordingResponse = await endVoiceRecording();
    return endRecordingResponse;
  }

  async getTemplateOutput({ txnID }: { txnID: string }) {
    try {
      const getStatusResponse = await getVoiceApiV2Status({
        txnId: txnID,
      });

      return getStatusResponse;
    } catch (error) {
      console.error('Error in fetching templates response: ', error);
      return {
        code: 520,
        message: `Failed to fetch output templates, ${error}`,
      } as TGetStatusResponse;
    }
  }

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
    this.vadInstance.resetVadWebInstance();
    EkaScribeStore.resetStore();
  }

  onError(callback: TErrorCallback) {}

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
}

export default EkaScribe;

const ekascribeInstance = new EkaScribe();

export const initEkascribe = ekascribeInstance.initEkaScribe.bind(ekascribeInstance);
export const getEkascribeConfig = ekascribeInstance.getEkascribeConfig.bind(ekascribeInstance);
export const startRecording = ekascribeInstance.startRecording.bind(ekascribeInstance);
export const pauseRecording = ekascribeInstance.pauseRecording.bind(ekascribeInstance);
export const resumeRecording = ekascribeInstance.resumeRecording.bind(ekascribeInstance);
export const endRecording = ekascribeInstance.endRecording.bind(ekascribeInstance);
export const retryUploadRecording = ekascribeInstance.retryUploadRecording.bind(ekascribeInstance);
export const cancelRecordingSession =
  ekascribeInstance.cancelRecordingSession.bind(ekascribeInstance);
export const commitTransactionCall =
  ekascribeInstance.commitTransactionCall.bind(ekascribeInstance);
export const stopTransactionCall = ekascribeInstance.stopTransactionCall.bind(ekascribeInstance);
export const getTemplateOutput = ekascribeInstance.getTemplateOutput.bind(ekascribeInstance);

export const getSuccessfullyUploadedFiles =
  ekascribeInstance.getSuccessFiles.bind(ekascribeInstance);
export const getFailedFiles = ekascribeInstance.getFailedFiles.bind(ekascribeInstance);
export const getTotalAudioFiles = ekascribeInstance.getTotalAudioFiles.bind(ekascribeInstance);

/**
 * Client side handling:
 * 1. show the activity indicator - user speaking/not speaking
 *
 * SDK pending tasks:
 * 1. publish this to npm
 * 2. write documentation
 * 3. thoroughly test the SDK - each function end to end
 *
 */
