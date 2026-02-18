export enum TEMPLATE_ID {
  EKA_EMR_TEMPLATE = 'eka_emr_template',
  CLINICAL_NOTE_TEMPLATE = 'clinical_notes_template',
  TRANSCRIPT_TEMPLATE = 'transcript_template',
  EKA_EMR_TO_FHIR_TEMPLATE = 'eka_emr_to_fhir_template',
  NIC_TEMPLATE = 'nic_template',
}

export enum RESULT_STATUS {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL_COMPLETE = 'partial_complete',
  IN_PROGRESS = 'in-progress',
}

export enum ERROR_CODE {
  MICROPHONE = 'microphone',
  TXN_INIT_FAILED = 'txn_init_failed',
  TXN_LIMIT_EXCEEDED = 'txn_limit_exceeded',
  INTERNAL_SERVER_ERROR = 'internal_server_error',
  TXN_STOP_FAILED = 'txn_stop_failed',
  AUDIO_UPLOAD_FAILED = 'audio_upload_failed',
  TXN_COMMIT_FAILED = 'txn_commit_failed',
  INVALID_REQUEST = 'invalid_request',
  VAD_NOT_INITIALIZED = 'vad_not_initialized',
  NO_AUDIO_CAPTURE = 'no_audio_capture',
  SPEECH_DETECTED = 'speech_detected',
  TXN_STATUS_MISMATCH = 'txn_status_mismatch',
  LONG_SILENCE = 'long_silence',
  GET_PRESIGNED_URL_FAILED = 'get_presigned_url_failed',
  UPLOAD_FULL_AUDIO = 'upload_full_audio',
  FETCH_WRAPPER_RESPONSE = 'fetch_wrapper_response',
  FETCH_WRAPPER_ERROR = 'fetch_wrapper_error',
}

export enum PROCESSING_STATUS {
  SUCCESS = 'success',
  IN_PROGRESS = 'in-progress',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum SHARED_WORKER_ACTION {
  UPLOAD_FILE_WITH_WORKER = 'upload_file_with_worker',
  UPLOAD_FILE_WITH_WORKER_SUCCESS = 'upload_file_with_worker_success',
  UPLOAD_FILE_WITH_WORKER_ERROR = 'upload_file_with_worker_error',
  TEST_WORKER = 'test_worker',
  CONFIGURE_AWS = 'configure_aws',
  CONFIGURE_AWS_SUCCESS = 'configure_aws_success',
  CONFIGURE_AWS_ERROR = 'configure_aws_error',
  WAIT_FOR_ALL_UPLOADS = 'wait_for_all_uploads',
  WAIT_FOR_ALL_UPLOADS_SUCCESS = 'wait_for_all_uploads_success',
  WAIT_FOR_ALL_UPLOADS_ERROR = 'wait_for_all_uploads_error',
  REQUEST_TOKEN_REFRESH = 'request_token_refresh',
  TOKEN_REFRESH_SUCCESS = 'token_refresh_success',
  TOKEN_REFRESH_ERROR = 'token_refresh_error',
  RESET_UPLOAD_COUNTERS = 'reset_upload_counters',
}

export enum CALLBACK_TYPE {
  AWS_CONFIGURE_STATUS = 'aws_configure_status',
  FILE_UPLOAD_STATUS = 'file_upload_status',
  TRANSACTION_STATUS = 'transaction_status',
  TEMPLATE_OPERATION_STATUS = 'template_operation_status',
  AUTHENTICATION_STATUS = 'authentication_status',
  NETWORK_STATUS = 'network_status',
  STORAGE_STATUS = 'storage_status',
}

export enum TEMPLATE_TYPE {
  JSON = 'json',
  TRANSCRIPT = 'transcript',
  MARKDOWN = 'markdown',
}

export enum COMPATIBILITY_TEST_TYPE {
  INTERNET_CONNECTIVITY = 'INTERNET_CONNECTIVITY',
  SYSTEM_INFO = 'SYSTEM_INFO',
  MICROPHONE = 'MICROPHONE',
  SHARED_WORKER = 'SHARED_WORKER',
  NETWORK_API = 'NETWORK_API',
}

export enum COMPATIBILITY_TEST_STATUS {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
}
