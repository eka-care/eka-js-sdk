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
}
