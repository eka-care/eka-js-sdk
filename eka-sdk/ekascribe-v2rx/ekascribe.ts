import {
  TPostTransactionInitRequest,
  TPostTransactionResponse,
  TStartRecordingResponse,
  TPauseRecordingResponse,
  TEndRecordingResponse,
  TPatchTransactionRequest,
  TPartialResultCallback,
  TCompatibilityCallback,
  TCompatibilityTestSummary,
  TStartRecordingForExistingSessionRequest,
  TPollingResponse,
} from './constants/types';
import { ITransport as EkaITransport, TransportConfig } from './transport/transport.interface';
import { HttpTransport } from './transport/http-transport';
import { IpcTransport } from './transport/ipc-transport';
import { EkaHosts, getHosts } from './transport/hosts';
import { CallbackRegistry } from './callbacks/callback-registry';
import { Tracker } from './tracker/tracker';
import { DocumentManager } from './managers/document-manager';
import { SessionUtils } from './managers/session-utils';
import { RecordingManager } from './managers/recording-manager';
import { OutputManager } from './managers/output-manager';
import SystemCompatibilityManager from './compatibility/system-compatibility-manager';
import { TGetStatusResponse } from './api/transaction/get-voice-api-v3-status';
import { TFetchChunkTranscriptResult } from './api/transaction/get-chunk-transcript';
import {
  ScribeClient,
  type TokenRequiredEvent,
  type CallbackMap,
  type CallbackName as AllianceCallbackName,
  type IpcBridge as AllianceIpcBridge,
  TransportMode,
} from 'med-scribe-alliance-ts-sdk';

export interface EkaScribeConfig {
  accessToken: string;
  env: 'PROD' | 'DEV';
  clientId?: string;
  mode?: 'http' | 'ipc';
  ipcBridge?: AllianceIpcBridge;
  enableTracking?: boolean;
  flavour?: string;
  allianceConfig?: {
    baseUrl?: string;
    useWorker?: boolean | 'auto';
    workerScriptUrl?: string;
    debug?: boolean;
  };
}

// Re-export types for consumers
export type { TStartRecordingForExistingSessionRequest, TPollingResponse };
export type { AllianceCallbackName as CallbackName };

class EkaScribe {
  private static instance: EkaScribe | null = null;

  private transport: EkaITransport;
  private hosts: EkaHosts;
  private callbackRegistry: CallbackRegistry;
  private tracker: Tracker;
  private config: EkaScribeConfig;
  private allianceClient: ScribeClient;
  private recording: RecordingManager;
  private output: OutputManager;

  readonly documents: DocumentManager;
  readonly sessions: SessionUtils;

  private constructor(config: EkaScribeConfig) {
    this.config = config;
    this.hosts = getHosts(config.env);
    this.callbackRegistry = new CallbackRegistry();
    this.tracker = new Tracker(config.enableTracking ?? false);

    // Initialize eka transport (for eka-specific API calls)
    const transportConfig: TransportConfig = {
      accessToken: config.accessToken,
      clientId: config.clientId,
      flavour: config.flavour,
      onUnauthorized: () => this.handleUnauthorized(),
    };

    if (config.mode === 'ipc' && config.ipcBridge) {
      this.transport = new IpcTransport(transportConfig, config.ipcBridge as any);
    } else {
      this.transport = new HttpTransport(transportConfig);
    }

    // Initialize sub-managers
    this.documents = new DocumentManager(this.transport, this.hosts);
    this.sessions = new SessionUtils(this.transport, this.hosts);
    this.output = new OutputManager(this.transport, this.hosts);

    // Initialize tracker
    if (config.enableTracking) {
      this.tracker.init(config.env);
      if (config.flavour) {
        this.tracker.setUser(config.flavour);
      }
    }

    // Initialize Alliance SDK (handles recording, audio, VAD, uploads)
    this.allianceClient = new ScribeClient({
      baseUrl: config.allianceConfig?.baseUrl ?? this.hosts.voiceV2,
      accessToken: config.accessToken,
      mode: config.mode === 'ipc' ? TransportMode.IPC : TransportMode.DIRECT,
      ipcTransport: config.ipcBridge,
      useWorker: config.allianceConfig?.useWorker ?? 'auto',
      workerScriptUrl: config.allianceConfig?.workerScriptUrl,
      debug: config.allianceConfig?.debug ?? false,
      autoDiscovery: false,
    });

    // Initialize recording manager
    this.recording = new RecordingManager(
      this.allianceClient,
      this.transport,
      this.hosts,
      this.tracker,
      this.sessions,
      this.callbackRegistry
    );

    // Wire Alliance 401 bridge
    this.allianceClient.registerCallback('onTokenRequired', (event: TokenRequiredEvent) => {
      this.handleUnauthorized().then((newToken) => {
        if (newToken) {
          event.resolve(newToken);
        }
      });
    });
  }

  static getInstance(config: EkaScribeConfig): EkaScribe {
    if (EkaScribe.instance) {
      const current = EkaScribe.instance.config;
      const envChanging = config.env && current.env !== config.env;
      const clientChanging = config.clientId && current.clientId !== config.clientId;

      if (envChanging || clientChanging) {
        console.warn(
          `[EkaScribe] Configuration changed` +
            `${envChanging ? ` (env: ${current.env} → ${config.env})` : ''}` +
            `${clientChanging ? ` (clientId: ${current.clientId} → ${config.clientId})` : ''}` +
            `. Resetting instance.`
        );
        EkaScribe.instance.resetInstance();
      } else {
        // Update mutable config (token, flavour)
        if (config.accessToken) {
          EkaScribe.instance.setAccessToken(config.accessToken);
        }
        if (config.flavour && config.flavour !== current.flavour) {
          current.flavour = config.flavour;
          if (config.enableTracking) {
            EkaScribe.instance.tracker.setUser(config.flavour);
          }
        }
        return EkaScribe.instance;
      }
    }

    EkaScribe.instance = new EkaScribe(config);
    return EkaScribe.instance;
  }

  // ─── Recording ─────────────────────────────────────────────────────────────

  initTransaction(request: TPostTransactionInitRequest): Promise<TStartRecordingResponse> {
    return this.recording.initTransaction(request);
  }

  startRecording(microphoneID?: string): Promise<TStartRecordingResponse> {
    return this.recording.startRecording(microphoneID);
  }

  startRecordingForExistingSession(
    request: TStartRecordingForExistingSessionRequest
  ): Promise<TStartRecordingResponse> {
    return this.recording.startRecordingForExistingSession(request);
  }

  pauseRecording(): TPauseRecordingResponse {
    return this.recording.pauseRecording();
  }

  resumeRecording(): TPauseRecordingResponse {
    return this.recording.resumeRecording();
  }

  endRecording(): Promise<TEndRecordingResponse> {
    return this.recording.endRecording();
  }

  retryUploadRecording(): Promise<TEndRecordingResponse> {
    return this.recording.retryUploadRecording();
  }

  discardSession(request: TPatchTransactionRequest): Promise<TPostTransactionResponse> {
    return this.recording.discardSession(request);
  }

  /** @deprecated Backward compatible */
  commitTransactionCall(): Promise<TEndRecordingResponse> {
    return this.recording.commitTransactionCall();
  }

  /** @deprecated Backward compatible */
  stopTransactionCall(): Promise<TEndRecordingResponse> {
    return this.recording.stopTransactionCall();
  }

  // ─── Output ────────────────────────────────────────────────────────────────

  getTemplateOutput(request: { txn_id: string }): Promise<TGetStatusResponse> {
    return this.output.getTemplateOutput(request);
  }

  getOutputTranscription(request: { txn_id: string }): Promise<TGetStatusResponse> {
    return this.output.getOutputTranscription(request);
  }

  getChunkTranscript(txnId: string, chunkNumber: string): Promise<TFetchChunkTranscriptResult> {
    return this.output.getChunkTranscript(txnId, chunkNumber);
  }

  pollSessionOutput(request: {
    txn_id: string;
    max_polling_time?: number;
    template_id?: string;
    document_id?: string;
    dlp?: boolean;
    onPartialResultCb?: TPartialResultCallback;
  }): Promise<TPollingResponse> {
    return this.output.pollSessionOutput(request);
  }

  // ─── Callbacks ─────────────────────────────────────────────────────────────

  registerCallback<K extends AllianceCallbackName>(name: K, handler: CallbackMap[K]): void {
    this.callbackRegistry.register(name, handler as any);

    if (name !== 'onTokenRequired') {
      this.allianceClient.registerCallback(name, handler);
    }
  }

  removeCallback<K extends AllianceCallbackName>(name: K, handler: CallbackMap[K]): void {
    this.callbackRegistry.remove(name, handler as any);

    if (name !== 'onTokenRequired') {
      this.allianceClient.removeCallback(name, handler);
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  setAccessToken(token: string): void {
    this.config.accessToken = token;
    this.transport.setAuthToken(token);
    this.allianceClient.setAccessToken(token);
  }

  // ─── Compatibility ─────────────────────────────────────────────────────────

  async runSystemCompatibilityTest(
    callback: TCompatibilityCallback,
    sharedWorker?: SharedWorker
  ): Promise<TCompatibilityTestSummary> {
    const manager = new SystemCompatibilityManager(this.transport, this.hosts);

    if (sharedWorker) {
      manager.setCompatiblityTestSharedWorker(sharedWorker);
    }

    return manager.runCompatibilityTest(callback);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async resetInstance(): Promise<void> {
    await this.recording.reset();
    this.callbackRegistry.removeAll();
    EkaScribe.instance = null;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async handleUnauthorized(): Promise<string> {
    const newToken = (await this.callbackRegistry.dispatch('onTokenRequired')) as string;

    if (newToken) {
      this.transport.setAuthToken(newToken);
      this.allianceClient.setAccessToken(newToken);
    }

    return newToken;
  }
}

export default EkaScribe;
