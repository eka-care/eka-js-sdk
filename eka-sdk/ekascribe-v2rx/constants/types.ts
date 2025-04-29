export type TInitResponse = {
  success?: boolean;
  error?: string;
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

export type TPostTransactionResponse = {
  status: string;
  message: string;
  txn_id: string;
};

export type TStartV2RxResponse = {
  microphone_error?: string;
  vad_error?: string;
  error?: string;
  success?: boolean;
  recording_error?: string;
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
