import {
  TPostTransactionInitRequest,
  TStartRecordingResponse,
  TPauseRecordingResponse,
  TEndRecordingResponse,
  TPartialResultCallback,
  TCompatibilityCallback,
  TCompatibilityTestSummary,
  TStartRecordingForExistingSessionRequest,
  TPollingResponse,
  TGetStatusResponse,
  TFetchChunkTranscriptResult,
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
import { WidgetManager, type WidgetConfig, type StartForPatientConfig } from './widget';
import {
  ScribeClient,
  type TokenRequiredEvent,
  type CallbackMap,
  type CallbackName as AllianceCallbackName,
  type IpcBridge as AllianceIpcBridge,
  type SDKResult,
  type GetSessionStatusResponse,
  type PollOptions,
  type PatchSessionResponse,
  TransportMode,
} from 'med-scribe-alliance-ts-sdk';

export interface EkaScribeConfig {
  access_token?: string;
  env: 'PROD' | 'DEV';
  clientId?: string;
  mode?: 'http' | 'ipc';
  ipcBridge?: AllianceIpcBridge;
  enableTracking?: boolean;
  flavour?: string;
  sharedWorkerUrl?: string;
  allianceConfig?: {
    baseUrl?: string;
    useWorker?: boolean | 'auto';
    debug?: boolean;
  };
  widget?: WidgetConfig;
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
  private widgetManager: WidgetManager | null = null;

  readonly documents: DocumentManager;
  readonly sessions: SessionUtils;

  private constructor(config: EkaScribeConfig) {
    this.config = config;
    this.hosts = getHosts(config.env);
    this.callbackRegistry = new CallbackRegistry();
    this.tracker = new Tracker(config.enableTracking ?? false);

    // Initialize eka transport (for eka-specific API calls)
    const transportConfig: TransportConfig = {
      access_token: config.access_token,
      clientId: config.clientId,
      flavour: config.flavour,
      onUnauthorized: () => this.handleUnauthorized(),
    };

    if (config.mode === 'ipc' && config.ipcBridge) {
      this.transport = new IpcTransport(transportConfig, config.ipcBridge as any);
    } else {
      this.transport = new HttpTransport(transportConfig);
    }

    // Initialize tracker
    if (config.enableTracking) {
      this.tracker.init(config.env);
      if (config.flavour) {
        this.tracker.setUser(config.flavour);
      }
    }

    // Initialize Alliance SDK (handles recording, audio, VAD, uploads)
    // baseUrl is required — Alliance SDK fetches well-known discovery from it
    if (!config.allianceConfig?.baseUrl) {
      throw new Error('[EkaScribe] allianceConfig.baseUrl is required.');
    }

    this.allianceClient = new ScribeClient({
      baseUrl: config.allianceConfig.baseUrl,
      accessToken: config.access_token,
      mode: config.mode === 'ipc' ? TransportMode.IPC : TransportMode.DIRECT,
      ipcTransport: config.ipcBridge,
      useWorker: config.allianceConfig?.useWorker ?? 'auto',
      workerScriptUrl: config.sharedWorkerUrl,
      debug: config.allianceConfig?.debug ?? false,
      autoDiscovery: true,
      flavour: config.flavour,
    });

    // Fetch well-known discovery document
    this.allianceClient.init().catch((err) => {
      console.error('[EkaScribe] Alliance SDK init failed:', err);
    });

    // Initialize sub-managers
    this.documents = new DocumentManager(this.transport, this.hosts, this.allianceClient);
    this.sessions = new SessionUtils(this.transport, this.hosts, this.allianceClient);
    this.output = new OutputManager(this.transport, this.hosts);

    // Initialize recording manager
    this.recording = new RecordingManager(
      this.allianceClient,
      this.transport,
      this.hosts,
      this.tracker
    );

    // Initialize widget if enabled
    if (config.widget?.enabled) {
      this.widgetManager = new WidgetManager(this, config.widget);
    }

    // Wire Alliance 401 bridge
    this.allianceClient.registerCallback('onTokenRequired', (event: TokenRequiredEvent) => {
      this.handleUnauthorized()
        .then((newToken) => {
          if (newToken) {
            event.resolve(newToken);
          } else {
            console.error('[EkaScribe] Token refresh returned empty token.');
            event.resolve('');
          }
        })
        .catch((err) => {
          console.error('[EkaScribe] Token refresh failed:', err);
          event.resolve('');
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
        void EkaScribe.instance.resetInstance().catch((err) => {
          console.error('[EkaScribe] Error during instance reset:', err);
        });
      } else {
        // Update mutable config (token, flavour)
        if (config.access_token) {
          EkaScribe.instance.updateAuthTokens({ access_token: config.access_token });
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

  /** @deprecated Backward compatible */
  initTransaction(request: TPostTransactionInitRequest): Promise<TStartRecordingResponse> {
    return this.recording.initTransaction(request);
  }

  // TODO: change to createSession with startRecording
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

  // TODO: change to endSession
  endRecording(): Promise<TEndRecordingResponse> {
    return this.recording.endRecording();
  }

  getSessionStatus(
    sessionId?: string,
    options?: { poll?: PollOptions }
  ): Promise<SDKResult<GetSessionStatusResponse>> {
    return this.recording.getSessionStatus(sessionId, options);
  }

  retryUploadRecording(): Promise<TEndRecordingResponse> {
    return this.recording.retryUploadRecording();
  }

  cancelSession(sessionId?: string): Promise<SDKResult<PatchSessionResponse>> {
    return this.recording.cancelSession(sessionId);
  }

  /**
   * Upload a pre-recorded audio file to an existing session's upload URL.
   *
   * Client flow:
   * 1. createSession() — via sessions.createSession()
   * 2. processPreRecordedAudio(uploadUrl, audioFile, audioFileName) — this method
   * 3. endSession — via sessions.endSession()
   */
  processPreRecordedAudio(request: {
    uploadUrl: string;
    audioFile: File | Blob;
  }): Promise<TStartRecordingResponse> {
    return this.recording.processPreRecordedAudio(request);
  }

  /** @deprecated Backward compatible */
  commitTransactionCall(): Promise<TEndRecordingResponse> {
    return this.recording.commitTransactionCall();
  }

  /** @deprecated Backward compatible */
  stopTransactionCall(): Promise<TEndRecordingResponse> {
    return this.recording.stopTransactionCall();
  }

  // ─── Widget ───────────────────────────────────────────────────────────────

  startForPatient(config: StartForPatientConfig): Promise<void> {
    if (!this.widgetManager) {
      return Promise.reject(
        new Error('[EkaScribe] Widget is not enabled. Set widget.enabled: true in config.')
      );
    }
    return this.widgetManager.startForPatient(config);
  }

  // ─── Output ────────────────────────────────────────────────────────────────

  /** @deprecated Backward compatible */
  getTemplateOutput(request: { txn_id: string }): Promise<TGetStatusResponse> {
    return this.output.getTemplateOutput(request);
  }

  /** @deprecated Backward compatible */
  getOutputTranscription(request: { txn_id: string }): Promise<TGetStatusResponse> {
    return this.output.getOutputTranscription(request);
  }

  getChunkTranscript(txnId: string, chunkNumber: string): Promise<TFetchChunkTranscriptResult> {
    return this.output.getChunkTranscript(txnId, chunkNumber);
  }

  /** @deprecated Backward compatible */
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

  /** @future Rename to setAccessToken(token: string) once existing clients migrate */
  updateAuthTokens({ access_token }: { access_token: string }): void {
    this.config.access_token = access_token;
    this.transport.setAuthToken(access_token);
    this.allianceClient.setAccessToken(access_token);
  }

  // ─── Compatibility ─────────────────────────────────────────────────────────

  async runSystemCompatibilityTest(
    callback: TCompatibilityCallback
  ): Promise<TCompatibilityTestSummary> {
    const manager = new SystemCompatibilityManager(this.transport, this.hosts);
    return manager.runCompatibilityTest(callback);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async resetInstance(): Promise<void> {
    if (this.widgetManager) {
      this.widgetManager.destroy();
      this.widgetManager = null;
    }
    await this.recording.reset();
    this.callbackRegistry.removeAll();
    EkaScribe.instance = null;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async handleUnauthorized(): Promise<string> {
    const TOKEN_REFRESH_TIMEOUT = 10000;

    const tokenPromise = this.callbackRegistry.dispatch('onTokenRequired') as Promise<string>;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('[EkaScribe] Token refresh timed out after 10s.')),
        TOKEN_REFRESH_TIMEOUT
      )
    );

    const newToken = await Promise.race([tokenPromise, timeoutPromise]);

    if (newToken) {
      this.updateAuthTokens({ access_token: newToken });
    }

    return newToken;
  }
}

export default EkaScribe;
