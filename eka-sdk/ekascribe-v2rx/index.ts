// ekascribe main export file having all the methods

import AudioFileManager from './audio-chunker/audio-file-manager';
import VadWebClient from './audio-chunker/vad-web';
import {
  DESP_CHUNK_LENGTH,
  FRAME_RATE,
  MAX_CHUNK_LENGTH,
  PREF_CHUNK_LENGTH,
} from './constants/audio-constants';
import initEkaScribe from './main/init-ekascribe';
import startRecording from './main/start-recording';
import EkaScribeStore from './store/store';

class EkaScribe {
  private mode: string;
  private vadInstance; // vadWebClient Instance
  private audioFileManagerInstance; // AudioFileManager Instance

  constructor() {
    this.mode = 'dictation';
    EkaScribeStore.mode = this.mode;
    this.vadInstance = new VadWebClient(
      PREF_CHUNK_LENGTH,
      DESP_CHUNK_LENGTH,
      MAX_CHUNK_LENGTH,
      FRAME_RATE
    );
    EkaScribeStore.vadInstance = this.vadInstance;
    this.audioFileManagerInstance = new AudioFileManager();
    EkaScribeStore.audioFileManagerInstance = this.audioFileManagerInstance;
  }

  async init({ mode }: { mode: string }) {
    this.mode = mode;
    EkaScribeStore.mode = mode;
    const initResponse = await initEkaScribe();
    return initResponse;
  }

  async startRecording() {
    const startResponse = await startRecording();
    return startResponse;
  }

  pauseRecording() {
    this.vadInstance?.pauseVad();
    return;
  }

  resumeRecording() {
    this.vadInstance?.startVad();
    return;
  }

  endRecording() {}

  // end recording
  // upload failed
  // waiting for network
  // failed to fetch
  // recording too short

  // get summaries
  // apis - transaction api call

  // TODO things
}

export default EkaScribe;
