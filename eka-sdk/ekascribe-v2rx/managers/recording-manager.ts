import { SDK_STATUS_CODE } from '../constants/constant';
import { CALLBACK_TYPE, ERROR_CODE } from '../constants/enums';
import {
  TPostTransactionInitRequest,
  TPostTransactionResponse,
  TStartRecordingResponse,
  TPauseRecordingResponse,
  TEndRecordingResponse,
  TPatchTransactionRequest,
  TStartRecordingForExistingSessionRequest,
} from '../constants/types';
import { ITransport } from '../transport/transport.interface';
import { EkaHosts } from '../transport/hosts';
import { CallbackRegistry } from '../callbacks/callback-registry';
import { Tracker } from '../tracker/tracker';
import { SessionUtils } from './session-utils';
import {
  type ScribeClient,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type SDKResult,
  type StopRecordingResult,
  type RetryUploadResult,
  SessionStatus,
} from 'med-scribe-alliance-ts-sdk';

export class RecordingManager {
  private txnID: string = '';
  private storedSession: CreateSessionResponse | null = null;

  constructor(
    private allianceClient: ScribeClient,
    private transport: ITransport,
    private hosts: EkaHosts,
    private tracker: Tracker,
    private sessions: SessionUtils,
    private callbackRegistry: CallbackRegistry
  ) {}

  get transactionId(): string {
    return this.txnID;
  }

  get currentSession(): CreateSessionResponse | null {
    return this.storedSession;
  }

  // Backward compatible
  async initTransaction(request: TPostTransactionInitRequest): Promise<TStartRecordingResponse> {
    try {
      await this.allianceClient.reset();

      this.tracker.addBreadcrumb('recording', 'initTransaction', { txn_id: request.txn_id });

      // Massage eka format → Alliance format
      const allianceRequest: CreateSessionRequest = {
        templates: request.output_format_template.map((t) => t.template_id),
        model: request.model_type,
        language_hint: request.input_language,
        ...(request.output_language ? { transcript_language: [request.output_language] } : {}),
        upload_type: request.transfer || 'chunked',
        communication_protocol: 'http',
        additional_data: {
          mode: request.mode,
          txn_id: request.txn_id,
          patient_details: request.patient_details,
          system_info: request.system_info,
          auto_download: request.auto_download,
          model_training_consent: request.model_training_consent,
          version: request.version,
          encounter_id: request.encounter_id,
          ...(request.additional_data || {}),
        },
      };

      const result: SDKResult<CreateSessionResponse> = await this.allianceClient.createSession(
        allianceRequest
      );

      if (!result.success) {
        const errorCode =
          result.error.code === 'rate_limit_exceeded'
            ? ERROR_CODE.TXN_LIMIT_EXCEEDED
            : ERROR_CODE.TXN_INIT_FAILED;

        return {
          error_code: errorCode,
          status_code: result.error.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
          message: result.error.message || 'Transaction initialization failed.',
        };
      }

      this.storedSession = result.data;
      this.txnID = result.data.session_id;
      this.tracker.setTransactionId(this.txnID);

      this.tracker.captureEvent('Session started', {
        txn_id: this.txnID,
        status_code: 200,
      });

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Transaction initialized successfully.',
        txn_id: result.data.session_id,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.TXN_INIT_FAILED,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to initialize transaction. ${error}`,
      };
    }
  }

  // Backward compatible - ideally it should call startRecording() of Alliance SDK directly
  async startRecording(microphoneID?: string): Promise<TStartRecordingResponse> {
    try {
      if (!this.storedSession) {
        return {
          error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
          status_code: SDK_STATUS_CODE.TXN_ERROR,
          message: 'Transaction not initialized. Call initTransaction() first.',
        };
      }

      const result: SDKResult<void> = await this.allianceClient.startRecordingWithSession(
        this.storedSession,
        {
          uploadType: 'chunked',
          deviceId: microphoneID,
        }
      );

      if (!result.success) {
        return {
          error_code: ERROR_CODE.MICROPHONE,
          status_code: result.error.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
          message: result.error.message || 'Failed to start recording.',
        };
      }

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Recording started successfully.',
        txn_id: this.txnID,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to start recording. ${error}`,
      };
    }
  }

  async startRecordingForExistingSession(
    request: TStartRecordingForExistingSessionRequest
  ): Promise<TStartRecordingResponse> {
    try {
      await this.allianceClient.reset();

      // Construct CreateSessionResponse from existing session data
      const constructedSession: CreateSessionResponse = {
        session_id: request.txn_id,
        status: SessionStatus.CREATED,
        created_at: new Date(request.created_at * 1000).toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        upload_url: `${this.hosts.voiceV2}/upload/${request.txn_id}`,
      };

      const result: SDKResult<void> = await this.allianceClient.startRecordingWithSession(
        constructedSession,
        {
          uploadType: 'chunked',
          deviceId: request.microphoneID,
        }
      );

      if (!result.success) {
        return {
          error_code: ERROR_CODE.MICROPHONE,
          status_code: result.error.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
          message: result.error.message || 'Failed to start recording for existing session.',
        };
      }

      this.storedSession = constructedSession;
      this.txnID = request.txn_id;
      this.tracker.setTransactionId(this.txnID);

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Recording started for existing session.',
        txn_id: this.txnID,
        business_id: request.business_id,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to start recording for existing session. ${error}`,
      };
    }
  }

  pauseRecording(): TPauseRecordingResponse {
    try {
      this.allianceClient.pauseRecording();
      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Recording paused.',
        is_paused: true,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to pause recording. ${error}`,
      };
    }
  }

  resumeRecording(): TPauseRecordingResponse {
    try {
      this.allianceClient.resumeRecording();
      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Recording resumed.',
        is_paused: false,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to resume recording. ${error}`,
      };
    }
  }

  async endRecording(): Promise<TEndRecordingResponse> {
    try {
      this.tracker.addBreadcrumb('recording', 'endRecording', { txn_id: this.txnID });

      const result: SDKResult<StopRecordingResult> = await this.allianceClient.endRecording();

      if (!result.success) {
        this.tracker.captureEvent('Session end failed', {
          txn_id: this.txnID,
          error: result.error.message,
        });

        return {
          error_code: ERROR_CODE.TXN_STOP_FAILED,
          status_code: result.error.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
          message: result.error.message || 'Failed to end recording.',
        };
      }

      this.tracker.captureEvent('Session ended', {
        txn_id: this.txnID,
        total_files: result.data.totalFiles,
        failed_files: result.data.failedUploads.length,
      });

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Recording ended successfully.',
        failed_files: result.data.failedUploads,
        total_audio_files: Array.from({ length: result.data.totalFiles }, (_, i) => `${i}.mp3`),
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to end recording. ${error}`,
      };
    }
  }

  async retryUploadRecording(): Promise<TEndRecordingResponse> {
    try {
      const result: SDKResult<RetryUploadResult> = await this.allianceClient.retryFailedUploads();

      if (!result.success) {
        return {
          error_code: ERROR_CODE.AUDIO_UPLOAD_FAILED,
          status_code: result.error.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
          message: result.error.message || 'Retry upload failed.',
        };
      }

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: `Retried ${result.data.retried} files. ${result.data.succeeded} succeeded.`,
        failed_files: result.data.stillFailed,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to retry upload. ${error}`,
      };
    }
  }

  // TODO: cancelSession - Alliance SDK
  async discardSession(request: TPatchTransactionRequest): Promise<TPostTransactionResponse> {
    try {
      const patchResponse = await this.sessions.patchSessionStatus(request);

      await this.allianceClient.reset();
      this.storedSession = null;

      if (this.callbackRegistry.hasHandlers('onSessionEvent')) {
        await this.callbackRegistry.dispatch('onSessionEvent', {
          callback_type: CALLBACK_TYPE.TRANSACTION_STATUS,
          status: 'info',
          message: `Transaction cancel status: ${patchResponse.code}`,
          timestamp: new Date().toISOString(),
        });
      }

      return patchResponse;
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to cancel recording session, ${error}`,
      } as TPostTransactionResponse;
    }
  }

  /** @deprecated Backward compatible */
  async commitTransactionCall(): Promise<TEndRecordingResponse> {
    try {
      if (!this.txnID) {
        return {
          error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
          status_code: SDK_STATUS_CODE.TXN_ERROR,
          message: 'Transaction not initialized.',
        };
      }

      const response = await this.transport.request<TPostTransactionResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV2}/transaction/commit/${this.txnID}`,
        body: { audio_files: [] },
      });

      if (response.status !== 200) {
        return {
          error_code: ERROR_CODE.TXN_COMMIT_FAILED,
          status_code: response.status,
          message: response.data.message || 'Transaction commit failed.',
        };
      }

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: response.data.message || 'Transaction committed successfully.',
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to commit transaction, ${error}`,
      };
    }
  }

  /** @deprecated Backward compatible */
  async stopTransactionCall(): Promise<TEndRecordingResponse> {
    try {
      if (!this.txnID) {
        return {
          error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
          status_code: SDK_STATUS_CODE.TXN_ERROR,
          message: 'Transaction not initialized.',
        };
      }

      const response = await this.transport.request<TPostTransactionResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV2}/transaction/stop/${this.txnID}`,
        body: { audio_files: [] },
      });

      return {
        status_code: response.status,
        message: response.data.message || 'Transaction stopped.',
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.TXN_STOP_FAILED,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to stop transaction, ${error}`,
      };
    }
  }

  async reset(): Promise<void> {
    await this.allianceClient.reset();
    this.txnID = '';
    this.storedSession = null;
  }
}
