import type { TPatientDetails } from '../constants/types';
import type { GetSessionStatusResponse } from 'med-scribe-alliance-ts-sdk';

export enum WidgetState {
  COLLAPSED = 'collapsed',
  RECORDING = 'recording',
  PAUSED = 'paused',
  PROCESSING = 'processing',
  DONE = 'done',
  ERROR = 'error',
}

export type WidgetTheme = 'dark' | 'light';

export interface WidgetPosition {
  bottom?: number;
  right?: number;
  top?: number;
  left?: number;
}

export interface WidgetConfig {
  enabled: boolean;
  theme?: WidgetTheme;
  zIndex?: number;
  primaryColor?: string;
  position?: WidgetPosition;
  orientation?: 'horizontal' | 'vertical';
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
  startRecordingV2(options: {
    templates: string[];
    sessionMode?: string;
    languageHint?: string[];
    model?: string;
    patientDetails?: {
      name?: string;
      age?: string;
      gender?: string;
    };
    additionalData?: Record<string, unknown>;
    sessionId?: string;
  }): Promise<{
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
    | { success: true; data: GetSessionStatusResponse; httpStatus?: number }
    | { success: false; error: { message: string; code?: string }; httpStatus?: number }
  >;
}
