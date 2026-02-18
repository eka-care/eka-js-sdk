// ekascribe main Class having all the methods - Entry point

import 'core-js/stable';

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
import { CALLBACK_TYPE, ERROR_CODE } from './constants/enums';
import {
  TEndRecordingResponse,
  TEventCallback,
  TGetTransactionHistoryResponse,
  TPartialResultCallback,
  TPatchTransactionRequest,
  TPatchVoiceApiV2ConfigRequest,
  TPatchVoiceApiV3StatusRequest,
  TPostTransactionInitRequest,
  TPostTransactionResponse,
  TPostV1ConvertToTemplateRequest,
  TPostV1TemplateRequest,
  TPostV1TemplateSectionRequest,
  TPostV1UploadAudioFilesRequest,
  TVadFrameProcessedCallback,
  TVadFramesCallback,
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
import cookV1MediaAiCreateTemplate from './api/templates/cook-v1-medai-ai-create-template';
import postV1ConvertToTemplate from './api/templates/post-transaction-convert-to-template';
import { postV1UploadAudioFiles } from './main/upload-full-audio-with-presigned-url';
import { patchVoiceApiV3Status } from './api/transaction/patch-voice-api-v3-status';
import searchSessions, {
  searchSessionsByPatient,
  searchSessionsBySessionId,
  TSearchSessionsByPatientRequest,
  TSearchSessionsRequest,
} from './utils/search-past-sessions';
import { getConfigV2MyTemplates } from './api/config/get-voice-api-v2-config-my-templates';
import putVoiceApiV2Config from './api/config/patch-voice-api-v2-config';
import postConvertTranscriptionToTemplate from './api/templates/post-convert-transcription-to-template';
import { getVoiceApiV3StatusTranscript } from './api/transaction/get-voice-api-v3-status-transcript';
import { pollOutputSummary } from './main/poll-output-summary';
import SystemCompatibilityManager from './main/system-compatiblity-manager';
import {
  TCompatibilityCallback,
  TCompatibilityTestSummary,
  TGetDoctorHeaderFooterRequest,
  TGetDoctorClinicsRequest,
} from './constants/types';
import { getDoctorHeaderFooter } from './api/profile/get-doctor-header-footer';
import { getDoctorClinics } from './api/profile/get-doctor-clinics';

class EkaScribe {
  private static instance: EkaScribe | null = null;
  private vadInstance!: VadWebClient; // vadWebClient Instance
  private audioFileManagerInstance!: AudioFileManager; // AudioFileManager Instance
  private audioBufferInstance!: AudioBufferManager;
  private compatibilityManager: SystemCompatibilityManager | null = null; // SystemCompatibilityManager Instance

  // Private constructor to prevent direct instantiation
  private constructor() {
    // Instances will be initialized in initTransaction
  }

  // Static method to get the singleton instance with optional initialization
  public static getInstance({
    access_token,
    env,
    clientId,
    flavour,
  }: {
    access_token?: string;
    env?: 'PROD' | 'DEV';
    clientId?: string;
    flavour?: string;
  }): EkaScribe {
    setEnv({
      ...(access_token ? { auth_token: access_token } : {}),
      ...(env ? { env } : {}),
      ...(clientId ? { clientId } : {}),
      ...(flavour ? { flavour } : {}),
    });

    if (!EkaScribe.instance) {
      EkaScribe.instance = new EkaScribe();
    }

    return EkaScribe.instance;
  }

  // Method to reset the singleton instance (useful for testing)
  public resetInstance(): void {
    EkaScribe.instance = null;
  }

  async getEkascribeConfig() {
    const response = await getConfigV2();
    return response;
  }

  updateAuthTokens({ access_token }: { access_token: string }) {
    setEnv({
      auth_token: access_token,
    });
  }

  async initTransaction(request: TPostTransactionInitRequest, sharedWorkerUrl?: string) {
    // reinitiate all instances before starting a new transaction
    EkaScribeStore.resetStore();

    this.audioFileManagerInstance = new AudioFileManager();
    EkaScribeStore.audioFileManagerInstance = this.audioFileManagerInstance;

    if (sharedWorkerUrl) {
      this.audioFileManagerInstance.createSharedWorkerInstance(sharedWorkerUrl);
    }

    this.audioBufferInstance = new AudioBufferManager(SAMPLING_RATE, AUDIO_BUFFER_SIZE_IN_S);
    EkaScribeStore.audioBufferInstance = this.audioBufferInstance;

    this.vadInstance = new VadWebClient(
      PREF_CHUNK_LENGTH,
      DESP_CHUNK_LENGTH,
      MAX_CHUNK_LENGTH,
      FRAME_RATE
    );
    EkaScribeStore.vadInstance = this.vadInstance;

    console.log('Initialising SDK Instances ', EkaScribeStore);

    const initTransactionResponse = await initialiseTransaction(request);
    console.log(initTransactionResponse, 'initTransactionResponse');
    return initTransactionResponse;
  }

  async startRecording(microphoneID?: string) {
    const startResponse = await startVoiceRecording(microphoneID);
    console.log('%c Line:110 🍓 startResponse', 'color:#465975', startResponse);
    return startResponse;
  }

  reinitializeVad() {
    this.vadInstance.reinitializeVad();
  }

  destroyVad() {
    this.vadInstance.destroyVad();
  }

  pauseVad() {
    this.vadInstance.pauseVad();
  }

  pauseRecording() {
    const pauseRecordingResponse = pauseVoiceRecording();
    console.log('%c Line:117 🍌 pauseRecordingResponse', 'color:#6ec1c2', pauseRecordingResponse);
    return pauseRecordingResponse;
  }

  resumeRecording() {
    const resumeRecordingResponse = resumeVoiceRecording();
    console.log('%c Line:124 🌶 resumeRecordingResponse', 'color:#33a5ff', resumeRecordingResponse);
    return resumeRecordingResponse;
  }

  async endRecording() {
    const endRecordingResponse = await endVoiceRecording();
    console.log('%c Line:131 🍅 endRecordingResponse', 'color:#e41a6a', endRecordingResponse);
    return endRecordingResponse;
  }

  async retryUploadRecording({ force_commit }: { force_commit?: boolean }) {
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
      const onEventCallback = EkaScribeStore.eventCallback;
      this.vadInstance.pauseVad();

      const patchTransactionResponse = await patchTransactionStatus({
        sessionId,
        processing_status,
        processing_error,
      });

      this.resetEkaScribe();

      if (onEventCallback) {
        onEventCallback({
          callback_type: CALLBACK_TYPE.TRANSACTION_STATUS,
          status: 'info',
          message: `Transaction cancel status: ${patchTransactionResponse.code}`,
          timestamp: new Date().toISOString(),
        });
      }

      return patchTransactionResponse;
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to cancel recording session, ${error}`,
      } as TPostTransactionResponse;
    }
  }

  async commitTransactionCall(): Promise<TEndRecordingResponse> {
    try {
      const txnID = EkaScribeStore.txnID;
      const onEventCallback = EkaScribeStore.eventCallback;
      let txnCommitMsg = '';

      const sessionInfo = EkaScribeStore.sessionStatus[txnID];
      if (!sessionInfo?.api?.status) {
        return {
          error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
          status_code: SDK_STATUS_CODE.TXN_ERROR,
          message: 'Transaction not initialized.',
        };
      }

      if (
        sessionInfo.api.status === 'stop' ||
        sessionInfo.api.status === 'commit'
      ) {
        const audioInfo = this.audioFileManagerInstance?.audioChunks.filter(
          (file) => file.status === 'success'
        );
        const audioFiles = audioInfo.map((audio) => audio.fileName);

        const { message, code: txnCommitStatusCode } = await postTransactionCommit({
          audioFiles,
          txnId: EkaScribeStore.txnID,
        });
        txnCommitMsg = message;

        if (onEventCallback) {
          onEventCallback({
            callback_type: CALLBACK_TYPE.TRANSACTION_STATUS,
            status: 'info',
            message: `Transaction commit status: ${txnCommitStatusCode}`,
            timestamp: new Date().toISOString(),
            data: {
              request: audioFiles,
            },
          });
        }

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
      return {
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch output templates, ${error}`,
      } as TGetStatusResponse;
    }
  }

  async getOutputTranscription({ txn_id }: { txn_id: string }) {
    try {
      const getStatusResponse = await getVoiceApiV3StatusTranscript({
        txnId: txn_id,
      });

      return getStatusResponse;
    } catch (error) {
      return {
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch output templates, ${error}`,
      } as TGetStatusResponse;
    }
  }

  async pollSessionOutput(request: {
    txn_id: string;
    max_polling_time?: number;
    template_id?: string;
    onPartialResultCb?: TPartialResultCallback;
  }) {
    const pollingResponse = await pollOutputSummary(request);

    return pollingResponse;
  }

  async getSessionHistory({ txn_count }: { txn_count: number }) {
    try {
      const transactionsResponse = await getTransactionHistory({
        txn_count,
      });

      return transactionsResponse;
    } catch (error) {
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
    // Clean up internal state before destroying instances
    this.audioFileManagerInstance.resetFileManagerInstance();
    this.audioBufferInstance.resetBufferManagerInstance();
    this.vadInstance.resetVadWebInstance();

    // Clear store (this also clears instance references)
    EkaScribeStore.resetStore();
  }

  onUserSpeechCallback(callback: (isSpeech: boolean) => void) {
    EkaScribeStore.userSpeechCallback = callback;
  }

  onEventCallback(callback: TEventCallback) {
    EkaScribeStore.eventCallback = callback;
  }

  onVadFramesCallback(callback: TVadFramesCallback) {
    EkaScribeStore.vadFramesCallback = callback;
  }

  onVadFrameProcessedCallback(callback: TVadFrameProcessedCallback) {
    EkaScribeStore.vadFrameProcessedCallback = callback;
  }

  onPartialResultCallback(callback: TPartialResultCallback) {
    EkaScribeStore.partialResultCallback = callback;
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
    const configResponse = await putVoiceApiV2Config(request);
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

  async postTransactionConvertToTemplate(request: TPostV1ConvertToTemplateRequest) {
    const convertToTemplateResponse = await postV1ConvertToTemplate(request);
    return convertToTemplateResponse;
  }

  async convertTranscriptionToTemplate(request: TPostV1ConvertToTemplateRequest) {
    const convertToTemplateResponse = await postConvertTranscriptionToTemplate(request);
    return convertToTemplateResponse;
  }

  async searchPastSessions(request: TSearchSessionsRequest) {
    const searchSessionsResponse = await searchSessions(request);
    return searchSessionsResponse;
  }

  async searchSessionsByPatientName(request: TSearchSessionsByPatientRequest) {
    const searchSessionsByPatientNameResponse = await searchSessionsByPatient(request);
    return searchSessionsByPatientNameResponse;
  }

  async searchSessionsBySessionId(request: TSearchSessionsByPatientRequest) {
    const searchSessionsBySessionIdResponse = await searchSessionsBySessionId(request);
    return searchSessionsBySessionIdResponse;
  }

  async uploadAudioWithPresignedUrl(request: TPostV1UploadAudioFilesRequest) {
    const uploadAudioFilesResponse = await postV1UploadAudioFiles(request);
    return uploadAudioFilesResponse;
  }

  async updateResultSummary(request: TPatchVoiceApiV3StatusRequest) {
    const updateResultSummaryResponse = await patchVoiceApiV3Status(request);
    return updateResultSummaryResponse;
  }

  async getConfigMyTemplates() {
    const configMyTemplatesResponse = await getConfigV2MyTemplates();
    return configMyTemplatesResponse;
  }

  async runSystemCompatibilityTest(
    callback: TCompatibilityCallback,
    sharedWorker?: SharedWorker
  ): Promise<TCompatibilityTestSummary> {
    try {
      this.compatibilityManager = new SystemCompatibilityManager();

      if (sharedWorker) {
        this.compatibilityManager.setCompatiblityTestSharedWorker(sharedWorker);
      }

      // Run all compatibility tests
      const summary = await this.compatibilityManager.runCompatibilityTest(callback);

      return summary;
    } catch (error) {
      console.error('Error running compatibility test:', error);
      throw error;
    }
  }

  async destroySharedWorker() {
    if (this.audioFileManagerInstance) {
      this.audioFileManagerInstance.terminateSharedWorkerInstance();
    }
  }

  async getDoctorHeaderFooter(request: TGetDoctorHeaderFooterRequest) {
    const headerFooterResponse = await getDoctorHeaderFooter(request);
    return headerFooterResponse;
  }

  async getDoctorClinics(request: TGetDoctorClinicsRequest) {
    const clinicsResponse = await getDoctorClinics(request);
    return clinicsResponse;
  }
}

// Export the singleton instance getter with optional initialization
export const getEkaScribeInstance = ({
  access_token,
  env,
  clientId,
  flavour,
}: {
  access_token?: string;
  env?: 'PROD' | 'DEV';
  clientId?: string;
  flavour?: string;
}) => EkaScribe.getInstance({ access_token, env, clientId, flavour });
