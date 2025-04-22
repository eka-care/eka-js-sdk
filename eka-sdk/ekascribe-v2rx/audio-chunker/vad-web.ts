import { MicVAD } from '@ricky0123/vad-web';
import {
  FRAME_SIZE,
  LONG_SILENCE_THRESHOLD,
  OUTPUT_FORMAT,
  PRE_SPEECH_PAD_FRAMES,
  SHORT_SILENCE_THRESHOLD,
} from '../constants/audio-constants';
import EkaScribeStore from '../store/store';

class VadWebClient {
  private vad_past: number[];
  private last_clip_index: number;
  private clip_points: number[];
  private sil_duration_acc: number;
  private pref_length_samples: number;
  private desp_length_samples: number;
  private max_length_samples: number;
  private shor_thsld: number;
  private long_thsld: number;
  private frame_size: number;
  private speech_pad_frames: number;
  private micVad: MicVAD; // MicVad Object

  /**
   * Class that handle Vad functions and manages audio chunk
   * @param pref_length Preferred length in seconds
   * @param desp_length Desperate length in seconds
   * @param max_length Maximum length in seconds
   * @param sr Sample rate in Hz
   */
  constructor(pref_length: number, desp_length: number, max_length: number, sr: number) {
    this.vad_past = [];
    this.last_clip_index = 0;
    this.clip_points = [0];
    this.sil_duration_acc = 0;
    this.pref_length_samples = pref_length * sr;
    this.desp_length_samples = desp_length * sr;
    this.max_length_samples = max_length * sr;
    this.shor_thsld = SHORT_SILENCE_THRESHOLD * sr;
    this.long_thsld = LONG_SILENCE_THRESHOLD * sr;
    this.frame_size = FRAME_SIZE;
    this.speech_pad_frames = PRE_SPEECH_PAD_FRAMES;
    this.micVad = {} as MicVAD;

    // instantiate MicVad
    this.initVad();
  }

  /**
   * Process a VAD frame and determine if it's a clip point
   * @param vad_frame Voice activity detection frame (0 for silence, 1 for speech)
   */
  processVadFrame(vad_frame: number): [boolean, number] {
    let is_clip_point_frame: boolean = false;

    if (this.vad_past.length > 0) {
      if (vad_frame === 0) {
        this.sil_duration_acc += 1;
      }
      if (vad_frame === 1) {
        this.sil_duration_acc = 0;
      }
    }

    const sample_passed: number = this.vad_past.length - this.last_clip_index;

    if (sample_passed > this.pref_length_samples) {
      if (this.sil_duration_acc > this.long_thsld) {
        this.last_clip_index =
          this.vad_past.length - Math.min(Math.floor(this.sil_duration_acc / 2), 5);
        this.clip_points.push(this.last_clip_index);
        this.sil_duration_acc = 0;
        is_clip_point_frame = true;
      }
    }

    if (sample_passed > this.desp_length_samples) {
      if (this.sil_duration_acc > this.shor_thsld) {
        this.last_clip_index =
          this.vad_past.length - Math.min(Math.floor(this.sil_duration_acc / 2), 5);
        this.clip_points.push(this.last_clip_index);
        this.sil_duration_acc = 0;
        is_clip_point_frame = true;
      }
    }

    if (sample_passed >= this.max_length_samples) {
      this.last_clip_index = this.vad_past.length;
      this.clip_points.push(this.last_clip_index);
      this.sil_duration_acc = 0;
      is_clip_point_frame = true;
    }

    this.vad_past.push(vad_frame);

    if (is_clip_point_frame) {
      return [true, this.clip_points[this.clip_points.length - 1]];
    }

    return [false, this.clip_points[this.clip_points.length - 1]];
  }

  /**
   * initialize the VAD instance
   */
  async initVad() {
    const audioFileManager = EkaScribeStore.audioFileManagerInstance;
    const audioBuffer = EkaScribeStore.audioBufferInstance;
    const vad = await MicVAD.new({
      frameSamples: this.frame_size,
      preSpeechPadFrames: this.speech_pad_frames,
      //   TODO: check this startOnLoad
      //   startOnLoad: false,
      onFrameProcessed: (prob, frames) => {
        audioFileManager?.incrementTotalRawSamples(frames);

        audioBuffer?.append(frames);

        // Check if audio chunk needs to be clipped
        const { isSpeech } = prob;
        let vad_dec = 0;
        if (isSpeech >= 0.5) {
          vad_dec = 1;
        }

        const vadResponse = this.processVadFrame(vad_dec);
        const is_clip_point = vadResponse[0];

        if (is_clip_point) {
          // audio chunk is of float32 Array <ArrayBuffer>
          const activeAudioChunk = audioBuffer?.getAudioData();
          this.processAudioChunk({ audio: activeAudioChunk });
        }
      },
    });

    this.micVad = vad;
  }

  /**
   * process and upload audio chunk to s3
   */
  async processAudioChunk({ audio }: { audio?: Float32Array }) {
    const audioFileManager = EkaScribeStore.audioFileManagerInstance;
    const audioBuffer = EkaScribeStore.audioBufferInstance;
    if (!audio || !audioFileManager || !audioBuffer) return;

    // get the number of chunks already processed
    const filenumber = audioFileManager.audioChunks.length || 1;
    const filename = `${filenumber}.${OUTPUT_FORMAT}`;

    const rawSampleDetails = audioFileManager.getRawSampleDetails();
    const chunkTimestamps = audioBuffer?.calculateChunkTimestamps(rawSampleDetails.totalRawSamples);

    try {
      const chunkInfo = {
        timestamp: {
          st: chunkTimestamps.start,
          et: chunkTimestamps.end,
        },
        fileName: filename,
      };

      const audioChunkLength = audioFileManager.updateAudioInfo(chunkInfo);

      audioFileManager?.incrementInsertedSamples(
        audioBuffer.getCurrentSampleLength(),
        audioBuffer.getCurrentFrameLength()
      );
      audioBuffer.reset();

      await audioFileManager.uploadAudioChunk(audio, filename, audioChunkLength - 1);
    } catch (error) {
      console.error('Error uploading audio chunk:', error);
    }
  }

  /**
   * Start VAD
   */
  startVad() {
    this.micVad.start();
  }

  /**
   * Pause VAD
   */
  pauseVad() {
    this.micVad.pause();
  }

  /**
   * Monitor audio capture after 2 seconds of recording starts
   */
  monitorAudioCapture() {}

  /**
   * Callback to configure constants
   */
  configureVadConstants({
    pref_length,
    desp_length,
    max_length,
    sr,
    frame_size,
    pre_speech_pad_frames,
    short_thsld,
    long_thsld,
  }: {
    pref_length: number;
    desp_length: number;
    max_length: number;
    sr: number;
    frame_size: number;
    pre_speech_pad_frames: number;
    short_thsld: number;
    long_thsld: number;
  }) {
    this.pref_length_samples = pref_length * sr;
    this.desp_length_samples = desp_length * sr;
    this.max_length_samples = max_length * sr;
    this.shor_thsld = short_thsld * sr;
    this.long_thsld = long_thsld * sr;
    this.frame_size = frame_size;
    this.speech_pad_frames = pre_speech_pad_frames;
  }
}

export default VadWebClient;
