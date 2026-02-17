import { Injectable } from '@angular/core';
import { getEkaScribeInstance } from '@eka-care/ekascribe-ts-sdk-legacy';

@Injectable({ providedIn: 'root' })
export class EkaScribeService {
  private sdk: ReturnType<typeof getEkaScribeInstance> | null = null;
  private txnId = '';

  /** Initialise the singleton SDK instance */
  init(accessToken: string, env: 'DEV' | 'PROD' = 'DEV'): void {
    this.sdk = getEkaScribeInstance({
      access_token: accessToken,
      env,
      clientId: 'angular11-demo',
    });
  }

  /** Create a transaction, optionally start the shared-worker */
  async initTransaction(txnId: string): Promise<any> {
    if (!this.sdk) throw new Error('SDK not initialised — call init() first');

    this.txnId = txnId;

    // Point the SDK at the worker bundle served from /assets
    const workerUrl = `${window.location.origin}/assets/worker.bundle.js`;

    return this.sdk.initTransaction(
      {
        mode: 'consultation',
        txn_id: txnId,
        input_language: ['en'],
        output_format_template: [
          {
            template_id: 'eka_emr_template',
            template_name: 'Default Template',
          },
        ],
        transfer: 'vaded',
        model_type: 'pro',
      },
      workerUrl
    );
  }

  /** Request microphone permission and begin capturing audio */
  async startRecording(): Promise<any> {
    if (!this.sdk) throw new Error('SDK not initialised');

    // Prompt for microphone permission before handing off to the SDK
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop the tracks immediately — the SDK will open its own stream
    stream.getTracks().forEach((track) => track.stop());

    return this.sdk.startRecording();
  }

  /** Stop recording and finalise uploads */
  async stopRecording(): Promise<any> {
    if (!this.sdk) throw new Error('SDK not initialised');
    return this.sdk.endRecording();
  }

  /** Fetch the generated output for the current transaction */
  async getOutput(): Promise<any> {
    if (!this.sdk) throw new Error('SDK not initialised');
    return this.sdk.getTemplateOutput({ txn_id: this.txnId });
  }

  /** Register a callback for SDK events (uploads, errors, etc.) */
  onEvent(cb: (event: any) => void): void {
    if (!this.sdk) throw new Error('SDK not initialised');
    this.sdk.onEventCallback(cb);
  }

  /** Register a callback for speech detection */
  onSpeech(cb: (isSpeaking: boolean) => void): void {
    if (!this.sdk) throw new Error('SDK not initialised');
    this.sdk.onUserSpeechCallback(cb);
  }

  /** Tear-down */
  reset(): void {
    if (this.sdk) {
      this.sdk.resetEkaScribe();
    }
    this.sdk = null;
    this.txnId = '';
  }
}
