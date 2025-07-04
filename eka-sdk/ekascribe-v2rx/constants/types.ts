import { ERROR_CODE } from './enums';

export type TGetConfigV2Response = {
  data: {
    supported_languages: TGetConfigItem[];
    supported_output_formats: TGetConfigItem[];
    consultation_modes: TGetConfigItem[];
    max_selection: {
      languages: number;
      output_formats: number;
      consultation_mode: number;
    };
  };
};

export type TGetConfigItem = {
  id: string;
  name: string;
  desc?: string;
};

export type TStartRecordingRequest = {
  mode: string;
  input_language: string[];
  output_format_template: { template_id: string }[];
};

export type TStartRecordingResponse = {
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  business_id?: string;
  txn_id?: string;
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

export type TPostTransactionApiResponse = {
  status: string;
  message: string;
  txn_id: string;
  b_id: string;
  code: number;
  error?: { code: string; message: string; display_message: string };
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

export type TAudioChunksInfo = {
  fileName: string;
  fileBlob?: Blob;
  timestamp: {
    st: string;
    et: string;
  };
};

export type UploadProgressCallback = (success: string[], total: number) => void;
