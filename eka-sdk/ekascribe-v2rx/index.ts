// EkaScribe SDK v3 - Entry Point

import EkaScribe from './ekascribe';
import type { EkaScribeConfig } from './ekascribe';

// Factory function — the only way to get an EkaScribe instance
export const getEkaScribeInstance = (config: EkaScribeConfig) => EkaScribe.getInstance(config);

// Re-export config and class types
export type {
  EkaScribeConfig,
  TStartRecordingForExistingSessionRequest,
  TPollingResponse,
} from './ekascribe';

// Re-export Alliance SDK types for consumers
export type {
  SDKResult,
  GetSessionStatusResponse,
  PollOptions,
  PatchSessionRequest,
  PatchSessionResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  ProcessTemplateResponse,
  EndSessionRequest,
  EndSessionResponse,
  DiscoveryDocument,
  ResolvedConfig,
} from 'med-scribe-alliance-ts-sdk';

// Re-export Alliance SDK worker utilities
export { getWorkerUrl, createWorkerBlobUrl } from 'med-scribe-alliance-ts-sdk';

// Re-export callback types
export type { CallbackName } from './callbacks/callback-registry';

// Re-export transport types (for IPC mode consumers)
export type { IpcBridge } from './transport/transport.interface';

// Re-export types for consumers
export type {
  TGetConfigV2Response,
  TSelectedPreferences,
  TGetConfigItem,
  TConfigSettings,
  TPatientDetails,
  TSystemInfo,
  TStartRecordingResponse,
  TPauseRecordingResponse,
  TEndRecordingResponse,
  TPostTransactionInitRequest,
  TPostTransactionResponse,
  TPatchTransactionRequest,
  TPostCogResponse,
  TGetTransactionHistoryResponse,
  TSessionHistoryData,
  TSessionStatus,
  TEventCallback,
  TEventCallbackData,
  TVadFramesCallback,
  TVadFrameProcessedCallback,
  TPartialResultCallback,
  TPostV1TemplateRequest,
  TPostV1TemplateResponse,
  TGetV1TemplatesResponse,
  TTemplate,
  TPostV1TemplateSectionRequest,
  TPostV1TemplateSectionResponse,
  TSection,
  TGetV1TemplateSectionsResponse,
  TPatchVoiceApiV2ConfigRequest,
  TPatchVoiceApiV2ConfigResponse,
  TPostV1ConvertToTemplateRequest,
  TPostV1ConvertToTemplateResponse,
  TPatchVoiceApiV3StatusRequest,
  TPatchVoiceApiV3StatusResponse,
  TPostV1UploadAudioFilesRequest,
  TCompatibilityTestResult,
  TCompatibilityTestSummary,
  TCompatibilityCallback,
  TGetDoctorHeaderFooterRequest,
  TGetDoctorHeaderFooterResponse,
  TGetDoctorClinicsRequest,
  TGetDoctorClinicsResponse,
  TSuggestedMedication,
  TPostV1DocumentRequest,
  TPostV1DocumentResponse,
  TDeleteV1DocumentResponse,
  TPatchSessionContextRequest,
  TPatchSessionContextResponse,
  TGetV1SessionDetailsRequest,
  TGetV1SessionDetailsResponse,
  TGetV1SessionDetailsData,
  TSessionDocument,
  TDocumentError,
  TSessionDetailsAdditionalData,
  TGetConfigV2TimezoneResponse,
  TChunkTranscriptResponse,
  TFetchChunkTranscriptResult,
  TGetStatusResponse,
  TGetStatusApiResponse,
  TOutputSummary,
  TTemplateMessage,
  TTemplateStatus,
} from './constants/types';

// Re-export enums for consumers
export {
  ERROR_CODE,
  CALLBACK_TYPE,
  TEMPLATE_ID,
  RESULT_STATUS,
  PROCESSING_STATUS,
  TEMPLATE_TYPE,
  API_STATUS,
  VAD_STATUS,
  COMPATIBILITY_TEST_TYPE,
  COMPATIBILITY_TEST_STATUS,
} from './constants/enums';

// Re-export widget types
export { WidgetState } from './widget';
export type {
  WidgetConfig,
  WidgetTheme,
  WidgetPosition,
  WidgetCallbacks,
  StartForPatientConfig,
} from './widget';
