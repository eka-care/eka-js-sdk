// ekascribe main Class having all the methods - Entry point

import { getConfigV2 } from './api/get-voice-api-v2-config';
import { getVoiceApiV3Status, TGetStatusResponse } from './api/get-voice-api-v3-status';
import patchTransactionStatus from './api/patch-transaction-status';
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
  SDK_STATUS_CODE,
} from './constants/constant';
import { ERROR_CODE } from './constants/enums';
import {
  TEndRecordingResponse,
  TErrorCallback,
  TFileUploadProgressCallback,
  TGetTransactionHistoryResponse,
  TPatchTransactionRequest,
  TPostTransactionResponse,
  TStartRecordingRequest,
} from './constants/types';
import setEnv from './fetch-client/helper';
import endVoiceRecording from './main/end-recording';
import pauseVoiceRecording from './main/pause-recording';
import resumeVoiceRecording from './main/resume-recording';
import retryUploadFailedFiles from './main/retry-upload-recording';
import startVoiceRecording from './main/start-recording';
import EkaScribeStore from './store/store';
import initialiseTransaction from './main/init-transaction';
import getTransactionHistory from './api/get-transaction-history';

class EkaScribe {
  private vadInstance; // vadWebClient Instance
  private audioFileManagerInstance; // AudioFileManager Instance
  private audioBufferInstance;

  constructor() {
    this.audioFileManagerInstance = new AudioFileManager();
    console.log(
      '%c Line:48 🥕 this.audioFileManagerInstance',
      'color:#b03734',
      this.audioFileManagerInstance
    );
    EkaScribeStore.audioFileManagerInstance = this.audioFileManagerInstance;
    this.audioBufferInstance = new AudioBufferManager(SAMPLING_RATE, AUDIO_BUFFER_SIZE_IN_S);
    console.log(
      '%c Line:50 🍇 this.audioBufferInstance',
      'color:#fca650',
      this.audioBufferInstance
    );
    EkaScribeStore.audioBufferInstance = this.audioBufferInstance;
    this.vadInstance = new VadWebClient(
      PREF_CHUNK_LENGTH,
      DESP_CHUNK_LENGTH,
      MAX_CHUNK_LENGTH,
      FRAME_RATE
    );
    EkaScribeStore.vadInstance = this.vadInstance;
    console.log('%c Line:62 🍖 this.vadInstance', 'color:#2eafb0', this.vadInstance);
  }

  public initEkaScribe({ access_token }: { access_token?: string }) {
    // set access_token and refresh_token in env
    if (!access_token) return;

    setEnv({
      auth_token: access_token,
    });
  }

  public async getEkascribeConfig() {
    console.log('Fetching EkaScribe configuration...');
    const response = await getConfigV2();
    return response;
  }

  public updateAuthTokens({ access_token }: { access_token: string }) {
    setEnv({
      auth_token: access_token,
    });
  }

  async initTransaction({
    mode,
    input_language,
    output_format_template,
    txn_id,
  }: TStartRecordingRequest) {
    console.log('Initializing transaction...');

    const initTransactionResponse = await initialiseTransaction({
      mode,
      input_language,
      output_format_template,
      txn_id,
    });
    console.log(initTransactionResponse, 'initTransactionResponse');
    return initTransactionResponse;
  }

  async startRecording() {
    console.log('Starting recording...');
    const startResponse = await startVoiceRecording();
    console.log('%c Line:110 🍓 startResponse', 'color:#465975', startResponse);
    return startResponse;
  }

  reinitializeVad() {
    this.vadInstance.reinitializeVad();
  }

  pauseRecording() {
    console.log('Pausing recording...');
    const pauseRecordingResponse = pauseVoiceRecording();
    console.log('%c Line:117 🍌 pauseRecordingResponse', 'color:#6ec1c2', pauseRecordingResponse);
    return pauseRecordingResponse;
  }

  resumeRecording() {
    console.log('Resuming recording...');
    const resumeRecordingResponse = resumeVoiceRecording();
    console.log('%c Line:124 🌶 resumeRecordingResponse', 'color:#33a5ff', resumeRecordingResponse);
    return resumeRecordingResponse;
  }

  async endRecording() {
    console.log('Ending recording...');
    const endRecordingResponse = await endVoiceRecording();
    console.log('%c Line:131 🍅 endRecordingResponse', 'color:#e41a6a', endRecordingResponse);
    return endRecordingResponse;
  }

  async retryUploadRecording({ force_commit }: { force_commit: boolean }) {
    console.log('Retrying upload for failed files...');
    const retryUploadResponse = await retryUploadFailedFiles({ force_commit });
    console.log('%c Line:138 🍖 retryUploadResponse', 'color:#3f7cff', retryUploadResponse);
    return retryUploadResponse;
  }

  async patchSessionStatus({
    sessionId,
    processing_status,
    processing_error,
  }: TPatchTransactionRequest): Promise<TPostTransactionResponse> {
    try {
      const patchTransactionResponse = await patchTransactionStatus({
        sessionId,
        processing_status,
        processing_error,
      });

      this.resetEkaScribe();

      return patchTransactionResponse;
    } catch (error) {
      console.error('Error cancelling recording session:', error);
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to cancel recording session, ${error}`,
      } as TPostTransactionResponse;
    }
  }

  async commitTransactionCall(): Promise<TEndRecordingResponse> {
    try {
      const txnID = EkaScribeStore.txnID;
      let txnCommitMsg = '';

      if (EkaScribeStore.sessionStatus[txnID].api?.status === 'stop') {
        const audioInfo = this.audioFileManagerInstance?.audioChunks;
        const audioFiles = audioInfo.map((audio) => audio.fileName);

        const { message, code: txnCommitStatusCode } = await postTransactionCommit({
          audioFiles,
          txnId: EkaScribeStore.txnID,
        });
        txnCommitMsg = message;

        if (txnCommitStatusCode != 200) {
          return {
            error_code: ERROR_CODE.TXN_COMMIT_FAILED,
            status_code: txnCommitStatusCode,
            message: txnCommitMsg || 'Transaction commit failed.',
          };
        }

        EkaScribeStore.sessionStatus[txnID] = {
          ...EkaScribeStore.sessionStatus[txnID],
          api: {
            status: 'commit',
            code: txnCommitStatusCode,
            response: txnCommitMsg,
          },
        };
      } else if (EkaScribeStore.sessionStatus[txnID].api?.status != 'commit') {
        // transaction is not stopped or committed
        return {
          error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
          status_code: SDK_STATUS_CODE.TXN_ERROR,
          message: 'Transaction is not initialised or stopped. Cannot end recording.',
        };
      }

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: txnCommitMsg || 'Transaction committed successfully.',
      };
    } catch (error) {
      console.error('Error in transaction commit: ', error);
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to cancel recording session, ${error}`,
      } as TEndRecordingResponse;
    }
  }

  async stopTransactionCall() {
    // call endRecording method since all the steps are same
    const endRecordingResponse = await endVoiceRecording();
    return endRecordingResponse;
  }

  async getTemplateOutput({ txn_id }: { txn_id: string }) {
    try {
      const getStatusResponse = await getVoiceApiV3Status({
        txnId: txn_id,
      });

      return getStatusResponse;
    } catch (error) {
      console.error('Error in fetching templates response: ', error);
      return {
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch output templates, ${error}`,
      } as TGetStatusResponse;
    }
  }

  async getSessionHistory({ txn_count }: { txn_count: number }) {
    try {
      const transactionsResponse = await getTransactionHistory({
        txn_count,
      });

      return transactionsResponse;
    } catch (error) {
      console.error('Error cancelling recording session:', error);
      return {
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch previous transactions, ${error}`,
      } as TGetTransactionHistoryResponse;
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

  onError(callback: TErrorCallback) {
    EkaScribeStore.errorCallback = callback;
  }

  onUserSpeechCallback(callback: (isSpeech: boolean) => void) {
    EkaScribeStore.userSpeechCallback = callback;
  }

  onFileUploadProgressCallback(callback: TFileUploadProgressCallback) {
    this.audioFileManagerInstance.setProgressCallback(callback);
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
export const patchSessionStatus = ekascribeInstance.patchSessionStatus.bind(ekascribeInstance);
export const getSessionHistory = ekascribeInstance.getSessionHistory.bind(ekascribeInstance);
export const commitTransactionCall =
  ekascribeInstance.commitTransactionCall.bind(ekascribeInstance);
export const stopTransactionCall = ekascribeInstance.stopTransactionCall.bind(ekascribeInstance);
export const getTemplateOutput = ekascribeInstance.getTemplateOutput.bind(ekascribeInstance);
export const initTransaction = ekascribeInstance.initTransaction.bind(ekascribeInstance);

export const getSuccessfullyUploadedFiles =
  ekascribeInstance.getSuccessFiles.bind(ekascribeInstance);
export const getFailedFiles = ekascribeInstance.getFailedFiles.bind(ekascribeInstance);
export const getTotalAudioFiles = ekascribeInstance.getTotalAudioFiles.bind(ekascribeInstance);
export const reinitializeVad = ekascribeInstance.reinitializeVad.bind(ekascribeInstance);

export const onError = ekascribeInstance.onError.bind(ekascribeInstance);
export const onUserSpeechCallback = ekascribeInstance.onUserSpeechCallback.bind(ekascribeInstance);
export const onFileUploadProgressCallback =
  ekascribeInstance.onFileUploadProgressCallback.bind(ekascribeInstance);
export const resetEkaScribe = ekascribeInstance.resetEkaScribe.bind(ekascribeInstance);
