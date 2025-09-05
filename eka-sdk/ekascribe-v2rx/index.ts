// ekascribe main Class having all the methods - Entry point

import { getConfigV2 } from './api/config/get-voice-api-v2-config';
import { getVoiceApiV3Status, TGetStatusResponse } from './api/transaction/get-voice-api-v3-status';
import patchTransactionStatus from './api/transaction/patch-transaction-status';
import postTransactionCommit from './api/transaction/post-transaction-commit';
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
  TPatchVoiceApiV2ConfigRequest,
  TPostTransactionResponse,
  TPostV1ConvertToTemplateRequest,
  TPostV1TemplateRequest,
  TPostV1TemplateSectionRequest,
  TPostV1UploadAudioFilesRequest,
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
import getTransactionHistory from './api/transaction/get-transaction-history';
import getV1Templates from './api/templates/get-v1-templates';
import postV1Template from './api/templates/post-v1-template';
import patchV1Template from './api/templates/patch-v1-template';
import deleteV1Template from './api/templates/delete-v1-template';
import getV1TemplateSections from './api/template-sections/get-v1-template-sections';
import postV1TemplateSection from './api/template-sections/post-v1-template-section';
import patchV1TemplateSection from './api/template-sections/patch-v1-template-section';
import deleteV1TemplateSection from './api/template-sections/delete-v1-template-section';
import patchVoiceApiV2Config from './api/config/patch-voice-api-v2-config';
import cookV1MediaAiCreateTemplate from './api/templates/cook-v1-medai-ai-create-template';
import postV1ConvertToTemplate from './api/templates/post-transaction-convert-to-template';
import searchSessionsByPatient, {
  TSearchSessionsByPatientRequest,
} from './utils/search-sessions-by-patient-name';
import { postV1UploadAudioFiles } from './main/upload-full-audio-with-presigned-url';

class EkaScribe {
  private static instance: EkaScribe | null = null;
  private vadInstance: VadWebClient; // vadWebClient Instance
  private audioFileManagerInstance: AudioFileManager; // AudioFileManager Instance
  private audioBufferInstance: AudioBufferManager;

  // Private constructor to prevent direct instantiation
  private constructor() {
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

  // Static method to get the singleton instance with optional initialization
  public static getInstance({
    access_token,
    env,
    clientId,
  }: {
    access_token?: string;
    env?: 'PROD' | 'DEV';
    clientId?: string;
  }): EkaScribe {
    setEnv({
      ...(access_token ? { auth_token: access_token } : {}),
      ...(env ? { env } : {}),
      ...(clientId ? { clientId } : {}),
    });

    if (!EkaScribe.instance) {
      EkaScribe.instance = new EkaScribe();

      console.log('EkaScribe.instance', EkaScribe.instance);
      // Initialize if params are provided
    }

    return EkaScribe.instance;
  }

  // Method to reset the singleton instance (useful for testing)
  public static resetInstance(): void {
    EkaScribe.instance = null;
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

  async initTransaction(request: TStartRecordingRequest) {
    console.log('Initializing transaction...');

    const initTransactionResponse = await initialiseTransaction(request);
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

      if (
        EkaScribeStore.sessionStatus[txnID].api?.status === 'stop' ||
        EkaScribeStore.sessionStatus[txnID].api?.status === 'commit'
      ) {
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
      } else {
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

  // Template SDK methods
  async getAllTemplates() {
    const templatesResponse = await getV1Templates();
    return templatesResponse;
  }

  async createTemplate(template: TPostV1TemplateRequest) {
    const templatesResponse = await postV1Template(template);
    return templatesResponse;
  }

  async updateTemplate(template: TPostV1TemplateRequest) {
    const templatesResponse = await patchV1Template(template);
    return templatesResponse;
  }

  async deleteTemplate(template_id: string) {
    const templatesResponse = await deleteV1Template(template_id);
    return templatesResponse;
  }

  async aiGenerateTemplate(formData: FormData) {
    const templatesResponse = await cookV1MediaAiCreateTemplate(formData);
    return templatesResponse;
  }

  async updateConfig(request: TPatchVoiceApiV2ConfigRequest) {
    const configResponse = await patchVoiceApiV2Config(request);
    return configResponse;
  }

  // Template Section SDK methods
  async getAllTemplateSections() {
    const templateSectionsResponse = await getV1TemplateSections();
    return templateSectionsResponse;
  }

  async createTemplateSection(templateSection: TPostV1TemplateSectionRequest) {
    const templateSectionsResponse = await postV1TemplateSection(templateSection);
    return templateSectionsResponse;
  }

  async updateTemplateSection(templateSection: TPostV1TemplateSectionRequest) {
    const templateSectionsResponse = await patchV1TemplateSection(templateSection);
    return templateSectionsResponse;
  }

  async deleteTemplateSection(section_id: string) {
    const templateSectionsResponse = await deleteV1TemplateSection(section_id);
    return templateSectionsResponse;
  }

  async postTransactionConvertToTemplate({ txn_id, template_id }: TPostV1ConvertToTemplateRequest) {
    const convertToTemplateResponse = await postV1ConvertToTemplate({ txn_id, template_id });
    return convertToTemplateResponse;
  }

  async searchSessionsByPatientName(request: TSearchSessionsByPatientRequest) {
    const searchSessionsByPatientNameResponse = await searchSessionsByPatient(request);
    return searchSessionsByPatientNameResponse;
  }

  async uploadAudioWithPresignedUrl(request: TPostV1UploadAudioFilesRequest) {
    const uploadAudioFilesResponse = await postV1UploadAudioFiles(request);
    return uploadAudioFilesResponse;
  }
}

// Export the singleton instance getter with optional initialization
export const getEkaScribeInstance = ({
  access_token,
  env,
  clientId,
}: {
  access_token?: string;
  env?: 'PROD' | 'DEV';
  clientId?: string;
}) => EkaScribe.getInstance({ access_token, env, clientId });
