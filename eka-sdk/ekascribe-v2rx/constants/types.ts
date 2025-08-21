import { ERROR_CODE } from './enums';

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
    selected_preferences?: TSelectedPreferences;
    settings?: TConfigSettings;
    model?: string;
  };
  message?: string;
  code?: number;
};

export type TSelectedPreferences = {
  languages?: string[];
  output_formats?: string[];
  consultation_mode?: string;
  use_audio_cues?: boolean;
  auto_download?: boolean;
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

export type TStartRecordingRequest = {
  mode: string;
  input_language: string[];
  output_format_template: { template_id: string }[];
  txn_id: string;
  auto_download: boolean;
  model_training_consent: boolean;
  transfer: string;
  system_info: TSystemInfo;
  patient_details: TPatientDetails;
};

export type TPatientDetails = {
  username: string;
  oid: string;
  age: number;
  biologicalSex: string;
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
  effective_type: String;
  latency: Number;
  download_speed: Number;
  connection_type: String;
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
  s3Url: string;
  txnId: string;
  input_language: string[];
  output_format_template: { template_id: string }[];
  transfer: string;
  auto_download: boolean;
  model_training_consent: boolean;
  system_info: TSystemInfo;
  patient_details: TPatientDetails;
};

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
  code: number;
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
  processing_status: string;
  processing_error?: TPatchTransactionError;
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

export type TErrorCallback = (args: {
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
}) => void;

export type TSessionStatus = {
  [key: string]: {
    api?: {
      status: 'na' | 'init' | 'stop' | 'commit';
      error?: string;
      response?: string;
      code: number;
    };
    vad?: {
      status: 'start' | 'pause' | 'stop' | 'resume';
    };
  };
};

export type TFileUploadProgressCallback = (args: {
  success: number;
  total: number;
  is_uploaded?: boolean;
  fileName?: string;
  chunkData?: Uint8Array<ArrayBufferLike>[];
  error?: {
    code: number;
    msg: string;
  };
}) => void;

export interface TPostV1TemplateRequest {
  title: string;
  desc?: string;
  section_ids: string[];
  template_id?: string;
}

export interface TPostV1TemplateResponse {
  code: number;
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
}

export interface TGetV1TemplatesResponse {
  items: TTemplate[];
  code: number;
  error?: { code: string; message: string };
}
export interface TPostV1TemplateSectionRequest {
  title: string;
  desc?: string;
  format?: 'P' | 'B';
  example?: string;
  template_id?: string;
  section_id?: string;
}

export interface TPostV1TemplateSectionResponse {
  msg: string;
  section_id: string;
  code: number;
  action: 'updated' | 'created_custom';
  error?: { code: string; message: string };
}

export interface TSection {
  id: string;
  title: string;
  desc: string;
  format: 'P' | 'B';
  example: string;
  default: boolean;
  parent_section_id?: string;
}

export interface TGetV1TemplateSectionsResponse {
  items: TSection[];
  code: number;
  error?: { code: string; message: string };
}

export type TPatchVoiceApiV2ConfigRequest = {
  auto_download?: boolean;
  default_languages?: string[];
  my_templates?: string[];
  scribe_enabled?: boolean;
};

export interface TPatchVoiceApiV2ConfigResponse extends TPatchVoiceApiV2ConfigRequest {
  msg: string;
  code: number;
  error?: { code: string; message: string };
}
