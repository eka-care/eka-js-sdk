import AudioBufferManager from '../audio-chunker/audio-buffer-manager';
import AudioFileManager from '../audio-chunker/audio-file-manager';
import VadWebClient from '../audio-chunker/vad-web';
import {
  TEventCallback,
  TSessionStatus,
  TVadFrameProcessedCallback,
  TVadFramesCallback,
} from '../constants/types';

class EkaScribeStore {
  private static instance: EkaScribeStore;
  private _txnID: string = '';
  private _sessionBucketPath: string = '';
  private _vadInstance: VadWebClient | null = null; // vadWebClient Instance
  private _audioFileManagerInstance: AudioFileManager | null = null; // AudioFileManager Instance
  private _audioBufferInstance: AudioBufferManager | null = null; // AudioBuffer Instance
  private _sessionStatus: TSessionStatus = {};
  private _userSpeechCallback: ((isSpeech: boolean) => void) | null = null;
  private _eventCallback: TEventCallback | null = null;
  private _vadFramesCallback: TVadFramesCallback | null = null;
  private _vadFrameProcessedCallback: TVadFrameProcessedCallback | null = null;

  static getInstance(): EkaScribeStore {
    if (!EkaScribeStore.instance) {
      EkaScribeStore.instance = new EkaScribeStore();
    }
    return EkaScribeStore.instance;
  }

  // VadWebClient Instance
  get vadInstance(): VadWebClient | null {
    return this._vadInstance;
  }
  set vadInstance(value: VadWebClient) {
    this._vadInstance = value;
  }

  // AudioFileManager Instance
  get audioFileManagerInstance(): AudioFileManager | null {
    return this._audioFileManagerInstance;
  }
  set audioFileManagerInstance(value: AudioFileManager) {
    this._audioFileManagerInstance = value;
  }

  // AudioBuffer Instance
  get audioBufferInstance(): AudioBufferManager | null {
    return this._audioBufferInstance;
  }
  set audioBufferInstance(value: AudioBufferManager) {
    this._audioBufferInstance = value;
  }

  // Transaction ID
  get txnID(): string {
    return this._txnID;
  }

  set txnID(value: string) {
    this._txnID = value;
  }

  // session file Path - date/txnID
  get sessionBucketPath(): string {
    return this._sessionBucketPath;
  }

  set sessionBucketPath(value: string) {
    this._sessionBucketPath = value;
  }

  // Session Status
  get sessionStatus(): TSessionStatus {
    return this._sessionStatus;
  }

  set sessionStatus(value: TSessionStatus) {
    this._sessionStatus = value;
  }

  // User Speech Callback
  get userSpeechCallback(): ((isSpeech: boolean) => void) | null {
    return this._userSpeechCallback;
  }
  set userSpeechCallback(callback: ((isSpeech: boolean) => void) | null) {
    this._userSpeechCallback = callback;
  }

  // Event Callback
  get eventCallback(): TEventCallback | null {
    return this._eventCallback;
  }
  set eventCallback(callback: TEventCallback | null) {
    this._eventCallback = callback;
  }

  // Vad Frames Callback
  get vadFramesCallback(): TVadFramesCallback | null {
    return this._vadFramesCallback;
  }
  set vadFramesCallback(callback: TVadFramesCallback | null) {
    this._vadFramesCallback = callback;
  }

  // Vad Frame Processed Callback
  get vadFrameProcessedCallback(): TVadFrameProcessedCallback | null {
    return this._vadFrameProcessedCallback;
  }
  set vadFrameProcessedCallback(callback: TVadFrameProcessedCallback | null) {
    this._vadFrameProcessedCallback = callback;
  }

  // Reset store to initial state
  resetStore(): void {
    this._txnID = '';
    this._sessionBucketPath = '';
    this._sessionStatus = {};
    // Clear instance references
    this._vadInstance = null;
    this._audioFileManagerInstance = null;
    this._audioBufferInstance = null;
    // Clear callbacks
    this._userSpeechCallback = null;
    this._eventCallback = null;
    this._vadFramesCallback = null;
    this._vadFrameProcessedCallback = null;
  }
}

export default EkaScribeStore.getInstance();
