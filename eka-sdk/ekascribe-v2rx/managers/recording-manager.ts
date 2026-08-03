import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';
import { mapTransportError } from '../utils/map-transport-error';
import {
  mapAllianceError,
  allianceResultStatus,
  confirmedSuccessStatus,
} from '../utils/map-alliance-error';
import {
  TPostTransactionInitRequest,
  TPostTransactionResponse,
  TStartRecordingResponse,
  TPauseRecordingResponse,
  TEndRecordingResponse,
  TStartRecordingForExistingSessionRequest,
} from '../constants/types';
import { ITransport } from '../transport/transport.interface';
import { EkaHosts } from '../transport/hosts';
import { Tracker } from '../tracker/tracker';
import {
  type ScribeClient,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type RecordingOptions,
  type SDKResult,
  type EndRecordingResult,
  type RetryUploadResult,
  type GetSessionStatusResponse,
  type PollOptions,
  type PatchSessionResponse,
  type SessionUploadInfo,
  SessionStatus,
  ScribeError,
} from 'med-scribe-alliance-ts-sdk';

export class RecordingManager {
  private txnID: string = '';
  private storedSession: CreateSessionResponse | null = null;

  /** Set once the server confirms the session ended — separates a repeat
   * endRecording() (idempotent success) from one that never finalized (error). */
  private sessionEnded = false;
  private endedAudioFiles?: string[];

  constructor(
    private allianceClient: ScribeClient,
    private transport: ITransport,
    private hosts: EkaHosts,
    private tracker: Tracker
  ) {}

  get transactionId(): string {
    return this.txnID;
  }

  get currentSession(): CreateSessionResponse | null {
    return this.storedSession;
  }

  /** Adopt a newly created session and clear any previous session's end state. */
  private beginSession(session: CreateSessionResponse): void {
    this.storedSession = session;
    this.txnID = session.session_id;
    this.sessionEnded = false;
    this.endedAudioFiles = undefined;
    this.tracker.setTransactionId(this.txnID);
  }

  // Backward compatible
  async initTransaction(request: TPostTransactionInitRequest): Promise<TStartRecordingResponse> {
    try {
      this.allianceClient.clearRecordingState();

      this.tracker.addBreadcrumb('recording', 'initTransaction', { txn_id: request.txn_id });

      // Massage eka format → Alliance format
      const allianceRequest: CreateSessionRequest = {
        templates: request.output_format_template.map((t) => t.template_id),
        model: request.model_type,
        language_hint: request.input_language,
        ...(request.output_language ? { transcript_language: request.output_language } : {}),
        upload_type: request.transfer || 'chunked',
        communication_protocol: 'http',
        session_mode: request.mode,
        session_id: request.txn_id,
        ...(request.patient_details
          ? {
              patient_details: {
                name: request.patient_details.username,
                age: String(request.patient_details.age),
                gender: request.patient_details.biologicalSex,
                mobile: request.patient_details.mobile
                  ? Number(request.patient_details.mobile)
                  : undefined,
              },
            }
          : {}),
        additional_data: {
          system_info: request.system_info,
          auto_download: request.auto_download,
          model_training_consent: request.model_training_consent,
          version: request.version,
          encounter_id: request.encounter_id,
          ...(request.additional_data || {}),
        },
      };

      const result: SDKResult<CreateSessionResponse> = await this.allianceClient.createSession(
        allianceRequest,
        request.api_version
      );

      if (!result.success) {
        return mapAllianceError(
          result.error,
          ERROR_CODE.TXN_INIT_FAILED,
          'Transaction initialization failed.'
        );
      }

      this.beginSession(result.data);

      this.tracker.captureEvent('Session started', {
        txn_id: this.txnID,
        status_code: confirmedSuccessStatus(result),
      });

      return {
        status_code: confirmedSuccessStatus(result),
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

  async startRecordingV2(options: RecordingOptions): Promise<TStartRecordingResponse> {
    try {
      this.allianceClient.clearRecordingState();

      this.tracker.addBreadcrumb('recording', 'startRecordingV2', {
        sessionId: options.sessionId,
      });

      const result = await this.allianceClient.startRecording(options);

      if (!result.success) {
        return mapAllianceError(
          result.error,
          ERROR_CODE.TXN_INIT_FAILED,
          'Failed to start recording.'
        );
      }

      this.beginSession(result.data);

      this.tracker.captureEvent('Session started (v2)', {
        txn_id: this.txnID,
        status_code: confirmedSuccessStatus(result),
      });

      return {
        status_code: confirmedSuccessStatus(result),
        message: 'Recording started successfully.',
        txn_id: result.data.session_id,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to start recording. ${error}`,
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

      this.allianceClient.clearRecordingState();

      const result: SDKResult<void> = await this.allianceClient.startRecordingWithSession(
        this.storedSession,
        {
          uploadType: 'chunked',
          deviceId: microphoneID,
        }
      );

      if (!result.success) {
        return mapAllianceError(
          result.error,
          ERROR_CODE.START_RECORDING_FAILED,
          'Failed to start recording.'
        );
      }

      this.sessionEnded = false;
      this.endedAudioFiles = undefined;

      // Attaches a recorder to an existing session — no HTTP call is made.
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
      this.allianceClient.clearRecordingState();

      const constructedSession: CreateSessionResponse = {
        session_id: request.txn_id,
        status: SessionStatus.CREATED,
        created_at: new Date(request.created_at * 1000).toISOString(),
        expires_at: request.expires_at,
        upload_url: request.upload_url,
      };

      const result: SDKResult<void> = await this.allianceClient.startRecordingWithSession(
        constructedSession,
        {
          uploadType: 'chunked',
          deviceId: request.microphoneID,
          version: request.version,
        }
      );

      if (!result.success) {
        return mapAllianceError(
          result.error,
          ERROR_CODE.START_RECORDING_FAILED,
          'Failed to start recording for existing session.'
        );
      }

      this.beginSession(constructedSession);

      // No HTTP call is made on this path — see startRecording().
      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Recording started for existing session.',
        txn_id: this.txnID,
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
        is_paused: this.allianceClient.isRecordingPaused(),
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to pause recording. ${error}`,
      };
    }
  }

  forceAllowMoreChunks(): void {
    this.allianceClient.forceAllowMoreChunks();
  }

  resumeRecording(): TPauseRecordingResponse {
    try {
      this.allianceClient.resumeRecording();

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: 'Recording resumed.',
        is_paused: this.allianceClient.isRecordingPaused(),
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

      // The alliance SDK silently no-ops here, so distinguish the two cases.
      if (!this.allianceClient.isRecording()) {
        if (this.sessionEnded) {
          return {
            status_code: SDK_STATUS_CODE.SUCCESS,
            message: 'Recording already ended.',
            total_audio_files: this.endedAudioFiles,
          };
        }

        return {
          error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
          status_code: SDK_STATUS_CODE.TXN_ERROR,
          message: 'No active recording to end. Call startRecording() first.',
        };
      }

      const result: SDKResult<EndRecordingResult> = await this.allianceClient.endRecording();

      if (!result.success) {
        this.tracker.captureEvent('Session end failed', {
          txn_id: this.txnID,
          error: result.error.message,
        });

        return mapAllianceError(
          result.error,
          ERROR_CODE.END_RECORDING_FAILED,
          'Failed to end recording.'
        );
      }

      this.tracker.captureEvent('Session ended', {
        txn_id: this.txnID,
        total_files: result.data.totalFiles,
        failed_files: result.data.failedUploads.length,
        session_ended: result.data.sessionEnded,
      });

      if (result.data.failedUploads.length > 0) {
        return {
          error_code: ERROR_CODE.AUDIO_UPLOAD_FAILED,
          status_code: SDK_STATUS_CODE.AUDIO_ERROR,
          message: `Recording ended but ${result.data.failedUploads.length} audio file(s) failed to upload.`,
          failed_files: result.data.failedUploads,
          total_audio_files: result.data.endSessionResponse?.audio_files,
        };
      }

      // Uploads are in, but the server never confirmed the end — still needs finalizing.
      if (!result.data.sessionEnded) {
        return {
          error_code: ERROR_CODE.END_RECORDING_FAILED,
          status_code: result.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
          message: 'Recording stopped but the session could not be finalized.',
        };
      }

      // Clear session to prevent startRecording() on an ended session.
      // Keep txnID for getSessionStatus() / pollSessionOutput() / retryUploadRecording().
      this.storedSession = null;
      this.sessionEnded = true;
      this.endedAudioFiles = result.data.endSessionResponse?.audio_files;

      return {
        status_code: confirmedSuccessStatus(result),
        message: 'Recording ended successfully.',
        total_audio_files: this.endedAudioFiles,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to end recording. ${error}`,
      };
    }
  }

  async getSessionStatus(
    sessionId?: string,
    options?: { poll?: PollOptions; templateId?: string; version?: string }
  ): Promise<SDKResult<GetSessionStatusResponse> & { status_code: number }> {
    const targetId = sessionId || this.txnID;

    if (!targetId) {
      return {
        success: false,
        status_code: SDK_STATUS_CODE.TXN_ERROR,
        error: new ScribeError(
          'No session ID available. Call initTransaction() first or pass a sessionId.',
          ERROR_CODE.TXN_STATUS_MISMATCH
        ),
      };
    }

    const result = await this.allianceClient.getSessionStatus(targetId, options);
    return {
      ...result,
      status_code: allianceResultStatus(result),
    };
  }

  async retryUploadRecording(): Promise<TEndRecordingResponse> {
    try {
      const result: SDKResult<RetryUploadResult> = await this.allianceClient.retryFailedUploads();

      if (!result.success) {
        return mapAllianceError(
          result.error,
          ERROR_CODE.AUDIO_UPLOAD_FAILED,
          'Retry upload failed.'
        );
      }

      const { retried, succeeded, stillFailed } = result.data;

      // No single HTTP call here, so success is decided by what still failed.
      if (stillFailed.length > 0) {
        return {
          error_code: ERROR_CODE.AUDIO_UPLOAD_FAILED,
          status_code: SDK_STATUS_CODE.AUDIO_ERROR,
          message: `Retried ${retried} files. ${succeeded} succeeded, ${stillFailed.length} still failed.`,
          failed_files: stillFailed,
        };
      }

      return {
        status_code: SDK_STATUS_CODE.SUCCESS,
        message: `Retried ${retried} files. ${succeeded} succeeded.`,
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to retry upload. ${error}`,
      };
    }
  }

  async cancelSession(
    sessionId?: string
  ): Promise<SDKResult<PatchSessionResponse> & { status_code: number }> {
    const targetId = sessionId || this.txnID;

    if (!targetId) {
      return {
        success: false,
        status_code: SDK_STATUS_CODE.TXN_ERROR,
        error: new ScribeError(
          'No session ID available. Call initTransaction() first or pass a sessionId.',
          ERROR_CODE.TXN_STATUS_MISMATCH
        ),
      };
    }

    // Alliance SDK's cancelSession handles: forceStop() → reset() → clearSession → PATCH cancel on server
    const result = await this.allianceClient.cancelSession(targetId);
    this.storedSession = null;
    this.txnID = '';
    this.sessionEnded = false;
    this.endedAudioFiles = undefined;

    return {
      ...result,
      status_code: allianceResultStatus(result),
    };
  }

  async processPreRecordedAudio({
    upload,
    audioFile,
    audioFileName = 'audio_1.mp3',
  }: {
    upload: SessionUploadInfo;
    audioFile: File | Blob;
    audioFileName?: string;
  }): Promise<TStartRecordingResponse> {
    try {
      const result = await this.allianceClient.uploadAudioFile(audioFile, audioFileName, upload);

      if (!result.success) {
        return mapAllianceError(
          result.error,
          ERROR_CODE.AUDIO_UPLOAD_FAILED,
          'Audio upload failed.'
        );
      }

      return {
        status_code: confirmedSuccessStatus(result),
        message: 'Audio file uploaded successfully.',
      };
    } catch (error) {
      return {
        error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to upload audio file. ${error}`,
      };
    }
  }

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

      // Non-2xx responses reject in the transport and land in the catch below.
      return {
        status_code: response.status,
        message: response.data.message || 'Transaction committed successfully.',
      };
    } catch (error) {
      return mapTransportError(error, 'Failed to commit transaction,');
    }
  }

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

      // Non-2xx responses reject in the transport and land in the catch below.
      return {
        status_code: response.status,
        message: response.data.message || 'Transaction stopped.',
      };
    } catch (error) {
      return mapTransportError(error, 'Failed to stop transaction,');
    }
  }

  async reset(): Promise<void> {
    await this.allianceClient.reset();
    this.txnID = '';
    this.storedSession = null;
    this.sessionEnded = false;
    this.endedAudioFiles = undefined;
  }
}
