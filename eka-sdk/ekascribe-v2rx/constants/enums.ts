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
  UNKNOWN_ERROR = 'unknown_error',
  TXN_STOP_FAILED = 'txn_stop_failed',
  AUDIO_UPLOAD_FAILED = 'audio_upload_failed',
}

export enum PROCESSING_STATUS {
  SUCCESS = 'success',
  IN_PROGRESS = 'in-progress',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
