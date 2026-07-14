// --- Status API types (moved from api/transaction/) ---

export type TTemplateMessage = {
  type: 'warning' | 'error';
  code?: string;
  msg: string;
};

export type TTemplateStatus = 'success' | 'partial_success' | 'failure';

export type TOutputSummary = {
  template_id: string;
  value?: any;
  type: string;
  name: string;
  lang?: string;
  status: TTemplateStatus;
  errors?: TTemplateMessage[];
  warnings?: TTemplateMessage[];
  document_id: string;
  document_type: string;
  document_path: {
    bucket: string;
    folder: string;
    filename: string;
  };
};

export type TGetStatusApiResponse = {
  data: {
    output: TOutputSummary[];
    audio_matrix?: {
      quality: string;
    };
    meta_data?: {
      total_resources?: number;
      total_parsed_resources?: number;
    };
    created_at?: string;
    template_results: {
      integration: TOutputSummary[];
      custom: TOutputSummary[];
      transcript: TOutputSummary[];
    };
    additional_data?: any;
  };
  error?: {
    code: string;
    message: string;
    display_message: string;
  };
  status: string;
};

export type TGetStatusResponse = {
  response?: TGetStatusApiResponse | null;
  status_code: number;
  message?: string;
};

// --- Chunk transcript types (moved from api/transaction/) ---

export type TChunkTranscriptResponse = {
  text: string;
  confidence: number;
  segments: unknown[];
  audio_length: number;
  audio_quality: string;
  metadata: {
    model_id: string;
    commit_id: string;
    context_used: unknown[];
    lang_input: string[];
    lang_output: string;
    task: string | null;
  };
};

export type TFetchChunkTranscriptResult =
  | { success: true; data: TChunkTranscriptResponse }
  | { success: false; error: string };
import {
  ERROR_CODE,
  CALLBACK_TYPE,
  COMPATIBILITY_TEST_STATUS,
  API_STATUS,
  VAD_STATUS,
} from './enums';
import type { SessionUploadInfo } from 'med-scribe-alliance-ts-sdk';

export type TGetConfigV2Response = {
  data?: {
    supported_languages: TGetConfigItem[];
    supported_output_formats: TGetConfigItem[];
    consultation_modes: TGetConfigItem[];
    max_selection: {
      supported_languages: number;
      supported_output_formats: number;
      consultation_modes: number;
    };
    settings: TConfigSettings;
    my_templates: [
      {
        id: string;
        name: string;
      }
    ];
    user_details: {
      uuid: string;
      fn: string;
      mn: string;
      ln: string;
      dob: string;
      gen: 'F' | 'M' | 'O';
      s: string;
      'w-id': string;
      'w-n': string;
      'b-id': string;
      is_paid_doc: boolean;
      is_eka_doc: boolean;
      oid: string;
    };
    selected_preferences?: TSelectedPreferences;
    clinic_name?: string;
    specialization?: string;
    emr_name?: string;
    microphone_permission_check?: boolean;
    consult_language?: string[];
    contact_number?: string;
    onboarding_step?: string;
    header?: TConfigHeaderFooter;
    footer?: TConfigHeaderFooter;
  };
  message?: string;
  status_code: number;
};

export type TGetConfigV2TimezoneResponse = {
  timezone: string;
  current_time_utc: string;
  timestamp: number;
  status_code: number;
  message?: string;
};

export type TSelectedPreferences = {
  languages?: TGetConfigItem[];
  output_formats?: TGetConfigItem[];
  consultation_mode?: string;
  use_audio_cues?: boolean;
  auto_download?: boolean;
  model_type?: string;
  copy_overlay?: boolean;
  auto_detect_language?: boolean;
};

export type TGetConfigItem = {
  id: string;
  name: string;
  desc?: string;
};

export type TConfigSettings = {
  model_training_consent: {
    value: boolean;
    editable: boolean;
  };
};

export type Gender = 'M' | 'F' | 'O';

export type TPatientDetails = {
  username: string;
  oid?: string;
  age: number;
  biologicalSex: Gender;
  mobile?: string;
  email?: string;
};

export type TSystemInfo = {
  platform: string;
  language: string;
  hardware_concurrency?: number; // Optional, as support might vary
  device_memory?: number; // Optional, as support might vary
  time_zone: string;
  network_info?: TNetworkInfo;
};

export type TNetworkInfo = {
  effective_type: string;
  latency: number;
  download_speed: number;
  connection_type: string;
};

export type TStartRecordingResponse = {
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  business_id?: string;
  txn_id?: string;
  oid?: string;
  uuid?: string;
};

export type TPauseRecordingResponse = {
  status_code: number;
  message: string;
  error_code?: ERROR_CODE;
  is_paused?: boolean;
};

export type TEndRecordingResponse = {
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  failed_files?: string[];
  total_audio_files?: string[];
};

export type TPostTransactionInitRequest = {
  mode: string;
  s3Url?: string;
  txn_id: string;
  input_language: string[];
  output_language?: string;
  output_format_template: {
    template_id: string;
    template_name?: string;
    template_type?: string;
    codification_needed?: boolean;
  }[];
  transfer: string;
  auto_download?: boolean;
  model_training_consent?: boolean;
  system_info?: TSystemInfo;
  patient_details?: TPatientDetails;
  model_type: string;
  version?: string;
  api_version?: string;
  flavour?: string;
  batch_s3_url?: string;
  audio_file_names?: string[];
  additional_data?: Record<string, unknown>;
  encounter_id?: string;
};

export interface TPostV1UploadAudioFilesRequest extends TPostTransactionInitRequest {
  audioFile: File | Blob;
  audioFileName: string;
}

export type TPostTransactionCommitRequest = {
  audioFiles: string[];
  txnId: string;
};

export type TPostTransactionResponse = {
  status: string;
  message: string;
  txn_id: string;
  b_id: string;
  oid: string;
  uuid: string;
  data: unknown;
  status_code: number;
  error?: { code: string; message: string; display_message: string };
};

export type TPatchTransactionError = {
  error: {
    type: string;
    code: string;
    msg: string;
  };
};

export type TPatchTransactionRequest = {
  sessionId: string;
  processing_status?: string;
  processing_error?: TPatchTransactionError;
  patient_details?: TPatientDetails;
  user_status?: string;
};

export type TPostCogResponse = {
  credentials?: {
    AccessKeyId: string;
    SecretKey: string;
    SessionToken: string;
    Expiration: string;
  };
  message?: string;
  token?: string;
  identity_id?: string;
  is_session_expired?: boolean;
};

export type TEndV2RxResponse = {
  error?: string;
  success?: boolean;
  is_upload_failed?: boolean;
  stop_txn_error?: string;
  commit_txn_error?: string;
};

export type TGetTransactionHistoryResponse = {
  data?: TSessionHistoryData[];
  status?: string;
  status_code: number;
  message: string;
  retrieved_count?: number;
};

export type TSessionHistoryData = {
  created_at: string;
  b_id: string;
  user_status: string;
  processing_status: string;
  txn_id: string;
  mode: string;
  uuid: string;
  oid: string;
  patient_details?: TPatientDetails;
};

export type TAudioChunksInfo = {
  fileName: string;
  timestamp: { st: string; et: string };
  response?: string;
} & (
  | {
      status: 'pending';
      audioFrames: Float32Array;
      fileBlob?: undefined;
    }
  | {
      status: 'success';
      audioFrames?: undefined;
      fileBlob?: undefined;
    }
  | {
      status: 'failure';
      fileBlob: Blob;
      audioFrames?: undefined;
    }
);

export type UploadProgressCallback = (success: string[], total: number) => void;

export type TVadFramesCallback = (args: {
  error_code?: ERROR_CODE;
  status_code: number;
  message?: string;
  request?: string;
}) => void;

export type TSessionStatus = {
  [key: string]: {
    api?: {
      status: API_STATUS;
      error?: string;
      response?: string;
      code: number;
    };
    vad?: {
      status: VAD_STATUS;
    };
  };
};

// Generic callback type that can handle any data structure
export type TEventCallback = (args: {
  callback_type: CALLBACK_TYPE;
  status: 'success' | 'error' | 'progress' | 'info';
  message: string;
  error?: {
    code: number;
    msg: string;
    details?: unknown;
  };
  data?: TEventCallbackData;
  timestamp: string;
  metadata?: Record<string, unknown>;
}) => void;

export type TEventCallbackData = {
  success?: number;
  total?: number;
  is_uploaded?: boolean;
  fileName?: string;
  chunkData?: Uint8Array[];
  request?: unknown;
  response?: unknown;
  status_code?: number;
  error_code?: ERROR_CODE;
};

export interface TPostV1TemplateRequest {
  title: string;
  desc?: string;
  section_ids: string[];
  template_id?: string;
}

export interface TPostV1TemplateResponse {
  status_code: number;
  msg: string;
  template_id?: string;
  message?: string;
  error?: { code: string; message: string };
}

export interface TTemplate {
  id: string;
  title: string;
  desc: string;
  section_ids: string[];
  is_editable: boolean;
  is_favorite?: boolean;
}

export interface TGetV1TemplatesResponse {
  items: TTemplate[];
  status_code: number;
  error?: { code: string; message: string };
}

export interface TPostV1AiCreateTemplateRequest {
  file?: File;
  instruction?: string;
}

export type TPostV1AiCreateTemplateResponse = {
  title: string;
  template_instructions: string;
  status_code: number;
  message: string;
};
export interface TPostV1TemplateSectionRequest {
  title: string;
  desc?: string;
  format?: 'P' | 'B';
  example?: string;
  section_id?: string;
}

export interface TPostV1TemplateSectionResponse {
  msg: string;
  section_id: string;
  status_code: number;
  action: 'updated' | 'created_custom';
  error?: { code: string; message: string };
}

export interface TSection {
  id: string;
  title: string;
  desc: string;
  format: 'P' | 'B';
  example: string;
  default?: boolean;
  parent_section_id?: string;
}

export interface TGetV1TemplateSectionsResponse {
  items: TSection[];
  status_code: number;
  error?: { code: string; message: string };
}

export type TConfigHeaderFooter = {
  type: 'image' | 'margin';
  data?: string;
  content_type?: string;
  width: number;
  height: number;
  unit: 'cm' | 'mm';
};

export type TPatchVoiceApiV2ConfigRequest = {
  request_type: string;
  data: {
    auto_download?: boolean;
    auto_detect_language?: boolean;
    input_languages?: TGetConfigItem[];
    consultation_mode?: string;
    model_type?: string;
    output_format_template?: TGetConfigItem[];
    my_templates?: string[];
    scribe_enabled?: boolean;
    clinic_name?: string;
    specialization?: string;
    emr_name?: string;
    microphone_permission_check?: boolean;
    consult_language?: string[];
    contact_number?: string;
    onboarding_step?: string;
    sys_info?: TSystemInfo;
    copy_overlay?: boolean;
    header?: TConfigHeaderFooter;
    footer?: TConfigHeaderFooter;
  };
  query_params?: string;
};

export interface TPatchVoiceApiV2ConfigResponse extends TPatchVoiceApiV2ConfigRequest {
  msg: string;
  status_code: number;
  error?: { code: string; message: string };
}

export type TPostV1ConvertToTemplateRequest = {
  txn_id: string;
  template_id?: string;
  transcript?: string;
  target_language?: string;
};

export type TPostV1ConvertToTemplateResponse = {
  status: 'success' | 'failed';
  message: string;
  txn_id: string;
  template_id: string;
  document_id: string;
  b_id: string;
  status_code: number;
  msg: string;
  error?: { code: string; message: string; display_message: string };
};

export type TV1FileUploadFields = {
  'x-amz-meta-mode': string;
  key: string;
  'x-amz-algorithm': string;
  'x-amz-credential': string;
  'x-amz-date': string;
  policy: string;
  'x-amz-signature': string;
};

export type TPostV1FileUploadResponse = {
  uploadData: {
    url: string;
    fields: TV1FileUploadFields;
  };
  folderPath: string;
  txn_id: string;
  code?: number;
  message?: string;
  error?: { code: string; message: string };
};

export type TPatchVoiceApiV3StatusResponse = {
  status: string;
  message: string;
  txn_id: string;
  b_id: string;
  status_code: number;
  error?: { code: string; message: string; display_message: string };
};

export type TPatchVoiceApiV3StatusRequest = {
  txnId: string;
  data: {
    'document-id': string;
    data: string;
  }[];
};

export type TVadFrameProcessedCallback = (args: {
  probabilities: {
    notSpeech: number;
    isSpeech: number;
  };
  frame: Float32Array;
  duration: number;
}) => void;

export type TCompatibilityTestResult = {
  test_type: string;
  status: COMPATIBILITY_TEST_STATUS;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  error?: string;
};

export type TCompatibilityTestSummary = {
  allPassed: boolean;
  results: TCompatibilityTestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warningTests: number;
};

export type TCompatibilityCallback = (result: TCompatibilityTestResult) => void;

export type TPartialResultCallback = (data: {
  txn_id: string;
  response: TGetStatusApiResponse | null;
  status_code: number;
  message: string;
  poll_status: 'in-progress' | 'success' | 'failed' | 'timeout';
}) => void;

export type TGetDoctorHeaderFooterRequest = {
  doctor_oid: string;
  clinic_id?: string;
};

export type TDoctorHeaderFooterInfo = {
  _id: string | null;
  clinic_id: string | null;
  doctor_id: string | null;
  type: string | null;
  header_img: string | null;
  header_height: string | null;
  header_top_margin: string | null;
  footer_img: string | null;
  footer_height: string | null;
  margin_left: string | null;
  margin_right: string | null;
  page_size: string | null;
  show_eka_logo: boolean | null;
  show_name_in_signature: boolean | null;
  show_not_valid_for_medical_legal_purpose_message: boolean | null;
  show_page_number: boolean | null;
  show_prescription_id: boolean | null;
  show_signature: boolean | null;
};

export type TGetDoctorHeaderFooterResponse = {
  data: TDoctorHeaderFooterInfo;
  status_code: number;
  message?: string;
};

export type TGetDoctorClinicsRequest = {
  doctor_id: string;
};

export type TClinicInfo = {
  clinic_id: string;
  name: string;
};

export type TGetDoctorClinicsResponse = {
  data: TClinicInfo[] | null;
  status_code: number;
  message?: string;
};

export type TDeleteTransactionResponse = {
  status_code: number;
  message?: string;
  status?: string;
  txn_id?: string;
  error?: { code: string; message: string; display_message?: string };
};

export type TSuggestedMedication = {
  extracted: {
    name: string;
    dose: string | null;
    frequency: string | null;
    duration: string | null;
    route: string | null;
  };
  suggestions: Array<{
    coded_name: string;
    coded_generic_name: string | null;
    coded_dose_unit: string | null;
    coded_form: string | null;
    eka_id: string;
    locale_id: string;
    uncoded_name: string;
    source: string;
    is_fhir_confidence: boolean;
    is_brandname_matched: boolean;
    [key: string]: unknown;
  }>;
};

export type TSuggestedMedicationResponse = {
  status_code: number;
  message?: string;
  session_id?: string;
  medications?: TSuggestedMedication[];
};

export type TPostV1DocumentRequest = {
  session_id: string;
  document_name?: string;
  type?: string;
  document_id?: string;
  publish?: Record<string, unknown>;
  tiptap_json?: Record<string, unknown>;
  params?: string;
};

export type TPostV1DocumentResponse = {
  status_code: number;
  status?: string;
  message?: string;
  data?: {
    document_id: string;
    session_id: string;
    template_id: string;
    document_name: string;
    type: string;
    status: string;
    errors: unknown[];
    warnings: unknown[];
    usage_information: Record<string, unknown>;
    document_path: {
      bucket: string;
      folder: string;
      filename: string;
    };
    presigned_url: string;
    created_at: string;
    updated_at: number;
    publish: Record<string, unknown>;
    tiptap_json?: Record<string, unknown>;
  };
};

export type TDeleteV1DocumentResponse = {
  status_code: number;
  message?: string;
  [key: string]: unknown;
};

export type TPatchSessionContextRequest = {
  txn_id: string;
  context: {
    past_sessions?: string[];
    attachments?: {
      id: string;
      patient_oid?: string;
    }[];
  };
};

export type TPatchSessionContextResponse = {
  status_code: number;
  message?: string;
  [key: string]: unknown;
};

export type TGetV1SessionDetailsRequest = {
  session_id: string;
  presigned?: boolean;
  version?: string;
};

export type TDocumentError = {
  type: null | string;
  code: string;
  msg: string;
};

export type TSessionDocument = {
  document_id: string;
  session_id: string;
  template_id: string;
  document_name: string;
  document_type: 'notes' | 'context' | 'transcript' | 'integration';
  type: string;
  status: string;
  errors: TDocumentError[];
  warnings: TDocumentError[];
  publish: Record<string, unknown>;
  created_at: number;
  presigned_url: string | null;
  presigned_url_expires_at: number | null;
  vault_doc_id: string | null;
  lang?: string;
};

export type TSessionDetailsAdditionalData = {
  input_languages?: { id: string; name: string }[];
  output_format_template?: {
    id: string;
    name: string;
    template_type: string;
  }[];
  model_type?: string;
  consultation_mode?: string;
  [key: string]: unknown;
};

export type TGetV1SessionDetailsData = {
  schema_version: string;
  session_id: string;
  uuid: string;
  wid: string;
  created_at: number;
  expires_at: number;
  upload_url: SessionUploadInfo;
  status: string;
  user_status: 'init' | 'recording_started' | 'commit' | string;
  transfer: string;
  flavour: string;
  patient_details: TPatientDetails | Record<string, unknown>;
  audio_matrix: Record<string, unknown>;
  additional_data: TSessionDetailsAdditionalData;
  documents: TSessionDocument[];
  context: {
    past_sessions?: Array<{
      date_epoch: number;
      session_id: string;
    }>;
    documents?: string[];
    attachments?: Array<{
      id: string;
      patient_oid?: string;
    }>;
  };
  input_language: string[];
  request_templates: Record<string, []>;
  consultation_mode: string;
  model_type: string;
};

export type TGetV1SessionDetailsResponse = {
  data?: TGetV1SessionDetailsData;
  status_code: number;
  message?: string;
  [key: string]: unknown;
};

export type TStartRecordingForExistingSessionRequest = {
  txn_id: string;
  created_at: number;
  expires_at: string;
  upload_url: SessionUploadInfo;
  business_id?: string;
  microphoneID?: string;
  version?: string;
};

export type TPollingResponse = {
  response?: TGetStatusApiResponse | null;
  status_code: number;
  errorMessage?: string;
  errorCode?: string;
};
