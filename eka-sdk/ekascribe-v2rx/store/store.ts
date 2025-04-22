import AudioBufferManager from '../audio-chunker/audio-buffer-manager';
import AudioFileManager from '../audio-chunker/audio-file-manager';
import VadWebClient from '../audio-chunker/vad-web';

class EkaScribeStore {
  private static instance: EkaScribeStore;
  private _txnID: string = '';
  private _s3FilePath: string = '';
  private _mode: string = 'dictation';
  private _date: string = '';
  private _vadInstance: VadWebClient | null = null; // vadWebClient Instance
  private _audioFileManagerInstance: AudioFileManager | null = null; // AudioFileManager Instance
  private _audioBufferInstance: AudioBufferManager | null = null; // AudioBuffer Instance

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

  // S3 File Path
  get s3FilePath(): string {
    return this._s3FilePath;
  }

  set s3FilePath(value: string) {
    this._s3FilePath = value;
  }

  // Mode (dictation, conversation, etc.)
  get mode(): string {
    return this._mode;
  }

  set mode(value: string) {
    this._mode = value;
  }

  // Date
  get date(): string {
    return this._date;
  }

  set date(value: string) {
    this._date = value;
  }

  // Reset store to initial state
  reset(): void {
    this._txnID = '';
    this._s3FilePath = '';
    this._mode = 'dictation';
    this._date = '';
  }
}

export default EkaScribeStore.getInstance();
