import { ERROR_CODE, CALLBACK_TYPE } from './enums';

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
    };
    selected_preferences?: TSelectedPreferences;
    clinic_name?: string;
    specialization?: string;
    emr_name?: string;
    microphone_permission_check?: boolean;
    consult_language?: string[];
  };
  message?: string;
  code?: number;
};

export type TSelectedPreferences = {
  languages?: TGetConfigItem[];
  output_format?: TGetConfigItem[];
  consultation_mode?: string;
  use_audio_cues?: boolean;
  auto_download?: boolean;
  model_type?: string;
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
  s3Url?: string;
  txn_id: string;
  input_language: string[];
  output_language?: string;
  output_format_template: { template_id: string; template_name?: string; template_type?: string }[];
  transfer: string;
  auto_download?: boolean;
  model_training_consent?: boolean;
  system_info?: TSystemInfo;
  patient_details?: TPatientDetails;
  model_type: string;
  version?: string;
  flavour?: string;
  batch_s3_url?: string;
  audio_file_names?: string[];
  additional_data?: any;
};

export interface TPostV1UploadAudioFilesRequest extends TPostTransactionInitRequest {
  action: string;
  audioFiles: File[] | Blob[];
  audioFileNames: string[];
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
  is_favorite?: boolean;
}

export interface TGetV1TemplatesResponse {
  items: TTemplate[];
  code: number;
  error?: { code: string; message: string };
}

export type TPostCookV1MediaAiCreateTemplateResponse = {
  title: string;
  desc: string;
  sections: TSection[];
  code: number;
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
  default?: boolean;
  parent_section_id?: string;
}

export interface TGetV1TemplateSectionsResponse {
  items: TSection[];
  code: number;
  error?: { code: string; message: string };
}

export type TPatchVoiceApiV2ConfigRequest = {
  request_type: string;
  data: {
    auto_download?: boolean;
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
  };
};

export interface TPatchVoiceApiV2ConfigResponse extends TPatchVoiceApiV2ConfigRequest {
  msg: string;
  code: number;
  error?: { code: string; message: string };
}

export type TPostV1ConvertToTemplateRequest = {
  txn_id: string;
  template_id: string;
  transcript?: string;
};

export type TPostV1ConvertToTemplateResponse = {
  status: 'success' | 'failed';
  message: string;
  txn_id: string;
  template_id: string;
  b_id: string;
  code: number;
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
  code: number;
  error?: { code: string; message: string; display_message: string };
};

export type TPatchVoiceApiV3StatusRequest = {
  txnId: string;
  data: {
    'template-id': string;
    data: string;
  }[];
};

export type TVadFrameProcessedCallback = (args: {
  probabilities: {
    notSpeech: number;
    isSpeech: number;
  };
  frame: Float32Array;
}) => void;
