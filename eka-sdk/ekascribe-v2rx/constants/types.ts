import { ERROR_CODE } from './enums';

export type TGetConfigV2Response = {
  data?: {
    supported_languages: TGetConfigItem[];
    supported_output_formats: TGetConfigItem[];
    consultation_modes: TGetConfigItem[];
    max_selection: {
      languages: number;
      output_formats: number;
      consultation_mode: number;
    };
    selected_preferences?: TSelectedPreferences;
    settings?: TSystemSettings;
  };
  message?: string;
  code?: number;
};

export type TSelectedPreferences = {
  languages: TGetConfigItem[];
  outputFormats: TGetConfigItem[];
  consultationMode: TGetConfigItem[];
  useAudioCues: boolean;
  autoDownload: boolean;
  consultation_mode: string;
};

export type TGetConfigItem = {
  id: string;
  name: string;
  desc?: string;
};

export type TSystemSettings = {
  consentForModelTraining: {
    value: boolean;
    editable: boolean;
  };
};

export type TStartRecordingRequest = {
  mode: string;
  input_language: string[];
  output_format_template: { template_id: string }[];
  txn_id: string;
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
  code: number;
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
  fileName?: string;
  chunkData?: Uint8Array<ArrayBufferLike>[];
}) => void;
