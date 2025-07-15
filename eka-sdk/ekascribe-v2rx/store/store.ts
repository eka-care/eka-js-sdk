import AudioBufferManager from '../audio-chunker/audio-buffer-manager';
import AudioFileManager from '../audio-chunker/audio-file-manager';
import VadWebClient from '../audio-chunker/vad-web';
import { TErrorCallback, TSessionStatus } from '../constants/types';

class EkaScribeStore {
  private static instance: EkaScribeStore;
  private _txnID: string = '';
  private _sessionBucketPath: string = '';
  private _vadInstance: VadWebClient | null = null; // vadWebClient Instance
  private _audioFileManagerInstance: AudioFileManager | null = null; // AudioFileManager Instance
  private _audioBufferInstance: AudioBufferManager | null = null; // AudioBuffer Instance
  private _sessionStatus: TSessionStatus = {};
  private _errorCallback: TErrorCallback | null = null;
  private _sharedWorkerInstance: SharedWorker | null = null; // SharedWorker Instance

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

  // Error Callback
  get errorCallback(): TErrorCallback | null {
    return this._errorCallback;
  }
  set errorCallback(callback: TErrorCallback | null) {
    this._errorCallback = callback;
  }

  // SharedWorker Instance
  get sharedWorkerInstance(): SharedWorker | null {
    return this._sharedWorkerInstance;
  }

  set sharedWorkerInstance(value: SharedWorker) {
    this._sharedWorkerInstance = value;
  }

  // Reset store to initial state
  resetStore(): void {
    this._txnID = '';
    this._sessionBucketPath = '';
    this._sessionStatus = {};
  }
}

export default EkaScribeStore.getInstance();
