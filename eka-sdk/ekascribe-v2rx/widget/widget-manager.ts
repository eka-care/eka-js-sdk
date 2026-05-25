import {
  WidgetState,
  type WidgetConfig,
  type StartForPatientConfig,
  type WidgetCallbacks,
  type WidgetSDKBridge,
} from './types';
import { WidgetStateMachine } from './state-machine';
import { WidgetTimer } from './timer';
import { WidgetRenderer } from './renderer';

export class WidgetManager {
  private stateMachine: WidgetStateMachine;
  private timer: WidgetTimer;
  private renderer: WidgetRenderer;
  private config: WidgetConfig;
  private sdk: WidgetSDKBridge;
  private callbacks: WidgetCallbacks;
  private currentTxnId = '';
  private isProcessing = false;
  private isStarting = false;

  constructor(sdk: WidgetSDKBridge, config: WidgetConfig) {
    this.sdk = sdk;
    this.config = config;
    this.callbacks = config.callbacks || {};

    this.stateMachine = new WidgetStateMachine();
    this.timer = new WidgetTimer((time) => this.renderer.updateTimer(time));
    this.renderer = new WidgetRenderer(
      config.theme || 'dark',
      config.zIndex ?? 9999,
      config.primaryColor,
      config.position,
      {
        onPause: () => this.handlePause(),
        onResume: () => this.handleResume(),
        onStop: () => void this.handleStop(),
        onClose: () => this.handleClose(),
        onRetry: () => this.handleRetry(),
      }
    );

    this.renderer.renderState(WidgetState.COLLAPSED);
  }

  async startForPatient(patientConfig: StartForPatientConfig): Promise<void> {
    if (this.isStarting) {
      this.callbacks.onError?.({ error_code: 'session_starting', message: 'A session is already being started.' });
      return;
    }

    const current = this.stateMachine.current;

    // Auto-reset from terminal states so the next patient can start immediately
    if (current === WidgetState.DONE || current === WidgetState.ERROR) {
      this.resetWidget();
    }

    if (this.stateMachine.current !== WidgetState.COLLAPSED) {
      const msg = `Cannot start: a recording session is already active (txn_id: ${this.currentTxnId}).`;
      this.callbacks.onError?.({ error_code: 'session_active', message: msg });
      return;
    }

    this.isStarting = true;
    try {
      const defaults = this.config.sessionDefaults;

      const initResult = await this.sdk.initTransaction({
        txn_id: patientConfig.txn_id,
        mode: defaults.mode,
        input_language: defaults.input_language,
        output_format_template: defaults.output_format_template,
        model_type: defaults.model_type,
        patient_details: patientConfig.patient_details,
        additional_data: patientConfig.additional_data,
      });

      if (initResult.error_code) {
        this.showError(initResult.error_code, initResult.message);
        return;
      }

      this.currentTxnId = initResult.txn_id || patientConfig.txn_id;

      const startResult = await this.sdk.startRecording();
      if (startResult.error_code) {
        this.showError(startResult.error_code, startResult.message);
        return;
      }

      this.stateMachine.transition(WidgetState.RECORDING);
      this.renderer.renderState(WidgetState.RECORDING);
      this.timer.start();
      this.callbacks.onRecordingStart?.({ txn_id: this.currentTxnId });
    } catch (err) {
      this.showError(
        'unexpected_error',
        err instanceof Error ? err.message : 'Failed to start recording'
      );
    } finally {
      this.isStarting = false;
    }
  }

  destroy(): void {
    this.timer.stop();
    this.renderer.destroy();
    this.stateMachine.reset();
    this.currentTxnId = '';
    this.isProcessing = false;
  }

  // ─── Private action handlers ────────────────────────────────────────────────

  private handlePause(): void {
    if (!this.stateMachine.canTransition(WidgetState.PAUSED)) return;

    const result = this.sdk.pauseRecording();
    if (result.error_code) {
      this.showError(result.error_code, result.message);
      return;
    }

    this.timer.pause();
    this.stateMachine.transition(WidgetState.PAUSED);
    this.renderer.renderState(WidgetState.PAUSED, {
      time: this.timer.getFormatted(),
    });
    this.callbacks.onRecordingPause?.({
      txn_id: this.currentTxnId,
      duration: this.timer.getDurationSeconds(),
    });
  }

  private handleResume(): void {
    if (!this.stateMachine.canTransition(WidgetState.RECORDING)) return;

    const result = this.sdk.resumeRecording();
    if (result.error_code) {
      this.showError(result.error_code, result.message);
      return;
    }

    this.timer.resume();
    this.stateMachine.transition(WidgetState.RECORDING);
    this.renderer.renderState(WidgetState.RECORDING, {
      time: this.timer.getFormatted(),
    });
    this.callbacks.onRecordingResume?.({ txn_id: this.currentTxnId });
  }

  private async handleStop(): Promise<void> {
    if (!this.stateMachine.canTransition(WidgetState.PROCESSING) || this.isProcessing) return;

    this.isProcessing = true;
    const duration = this.timer.stop();

    this.stateMachine.transition(WidgetState.PROCESSING);
    this.renderer.renderState(WidgetState.PROCESSING);
    this.callbacks.onRecordingStop?.({
      txn_id: this.currentTxnId,
      duration,
    });

    try {
      const endResult = await this.sdk.endRecording();
      if (endResult.error_code) {
        this.isProcessing = false;
        this.showError(endResult.error_code, endResult.message);
        return;
      }

      this.callbacks.onProcessingStart?.({ txn_id: this.currentTxnId });

      const statusResult = await this.sdk.getSessionStatus(this.currentTxnId, {
        poll: { intervalMs: 3000, timeoutMs: 120_000 },
      });

      this.isProcessing = false;

      if (statusResult.success) {
        this.stateMachine.transition(WidgetState.DONE);
        this.renderer.renderState(WidgetState.DONE);
        this.callbacks.onProcessingComplete?.({
          txn_id: this.currentTxnId,
          sessionData: statusResult.data,
        });
      } else {
        const err = statusResult.error;
        this.showError(err.code || 'processing_failed', err.message || 'Processing failed');
      }
    } catch (err) {
      this.isProcessing = false;
      this.showError('processing_error', err instanceof Error ? err.message : 'Processing failed');
    }
  }

  private handleClose(): void {
    if (!this.stateMachine.canTransition(WidgetState.COLLAPSED)) return;
    const txnId = this.currentTxnId;
    this.resetWidget();
    this.callbacks.onWidgetClose?.({ txn_id: txnId });
  }

  private handleRetry(): void {
    if (this.stateMachine.canTransition(WidgetState.COLLAPSED)) {
      this.resetWidget();
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private resetWidget(): void {
    this.timer.stop();
    this.stateMachine.transition(WidgetState.COLLAPSED);
    this.renderer.renderState(WidgetState.COLLAPSED);
    this.currentTxnId = '';
    this.isProcessing = false;
    this.isStarting = false;
  }

  private showError(code: string, message: string): void {
    if (this.stateMachine.canTransition(WidgetState.ERROR)) {
      this.stateMachine.transition(WidgetState.ERROR);
    } else {
      this.stateMachine.reset();
    }
    this.renderer.renderState(WidgetState.ERROR, { error: message });
    this.callbacks.onError?.({ error_code: code, message });
  }

}
