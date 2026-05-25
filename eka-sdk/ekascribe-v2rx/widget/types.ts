import type { TPatientDetails } from '../constants/types';

export enum WidgetState {
  COLLAPSED = 'collapsed',
  RECORDING = 'recording',
  PAUSED = 'paused',
  PROCESSING = 'processing',
  DONE = 'done',
  ERROR = 'error',
}

export type WidgetTheme = 'dark' | 'light';

export interface WidgetConfig {
  enabled: boolean;
  theme?: WidgetTheme;
  zIndex?: number;
  primaryColor?: string;
  callbacks?: WidgetCallbacks;
  sessionDefaults: {
    input_language: string[];
    output_format_template: {
      template_id: string;
      template_name?: string;
      template_type?: string;
    }[];
    model_type: string;
    mode: string;
  };
}

export interface StartForPatientConfig {
  txn_id: string;
  patient_details?: Omit<TPatientDetails, 'oid'>;
  additional_data?: Record<string, unknown>;
}

export interface WidgetCallbacks {
  onRecordingStart?: (data: { txn_id: string }) => void;
  onRecordingPause?: (data: { txn_id: string; duration: number }) => void;
  onRecordingResume?: (data: { txn_id: string }) => void;
  onRecordingStop?: (data: { txn_id: string; duration: number }) => void;
  onProcessingStart?: (data: { txn_id: string }) => void;
  onProcessingComplete?: (data: { txn_id: string; sessionData: unknown }) => void;
  onError?: (data: { error_code: string; message: string }) => void;
  onWidgetClose?: (data: { txn_id: string }) => void;
}

/**
 * Bridge to EkaScribe SDK methods — avoids circular dependency.
 * EkaScribe passes `this` (which satisfies this interface) to WidgetManager.
 */
export interface WidgetSDKBridge {
  initTransaction(request: {
    txn_id: string;
    mode: string;
    input_language: string[];
    output_format_template: {
      template_id: string;
      template_name?: string;
      template_type?: string;
    }[];
    model_type: string;
    patient_details?: Omit<TPatientDetails, 'oid'>;
    encounter_id?: string;
    additional_data?: Record<string, unknown>;
  }): Promise<{
    status_code: number;
    message: string;
    error_code?: string;
    txn_id?: string;
  }>;
  startRecording(microphoneID?: string): Promise<{
    status_code: number;
    message: string;
    error_code?: string;
    txn_id?: string;
  }>;
  pauseRecording(): {
    status_code: number;
    message: string;
    error_code?: string;
  };
  resumeRecording(): {
    status_code: number;
    message: string;
    error_code?: string;
  };
  endRecording(): Promise<{
    status_code: number;
    message: string;
    error_code?: string;
  }>;
  getSessionStatus(
    sessionId?: string,
    options?: { poll?: unknown }
  ): Promise<
    | { success: true; data: unknown; httpStatus?: number }
    | { success: false; error: { message: string; code?: string }; httpStatus?: number }
  >;
}
