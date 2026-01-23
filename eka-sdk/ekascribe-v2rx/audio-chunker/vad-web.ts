import { MicVAD } from '@ricky0123/vad-web';
import {
  FRAME_SIZE,
  LONG_SILENCE_THRESHOLD,
  OUTPUT_FORMAT,
  PRE_SPEECH_PAD_FRAMES,
  SDK_STATUS_CODE,
  SHORT_SILENCE_THRESHOLD,
} from '../constants/constant';
import EkaScribeStore from '../store/store';
import { ERROR_CODE } from '../constants/enums';
import { TAudioChunksInfo } from '../constants/types';

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
  private micStream: MediaStream | null = null;
  private is_vad_loading: boolean = true;
  private noSpeechStartTime: number | null = null;
  private recording_started: boolean = false;
  private lastWarningTime: number | null = null;
  private warningCooldownPeriod: number = 2000; // 2 seconds cooldown after warning

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
  }

  private stopMicStream() {
    try {
      this.micStream?.getTracks?.().forEach((t) => t.stop());
    } catch {
      // ignore
    } finally {
      this.micStream = null;
    }
  }

  /**
   * Check for continuous silence and trigger periodic warnings
   * @param isSpeech - vad probability (0 or 1)
   */
  checkNoSpeech(isSpeech: number) {
    if (!this.recording_started) return;

    const now = Date.now();
    const onVadCallback = EkaScribeStore.vadFramesCallback;
    const silenceThreshold = 10000; // 10 seconds

    if (isSpeech === 0) {
      if (this.noSpeechStartTime === null) {
        this.noSpeechStartTime = now;
      } else {
        const silenceDuration = now - this.noSpeechStartTime;

        // Check if we should show a warning (every 10 seconds of silence)
        if (silenceDuration >= silenceThreshold) {
          // Check if enough time has passed since the last warning (cooldown period)
          if (
            this.lastWarningTime === null ||
            now - this.lastWarningTime >= this.warningCooldownPeriod
          ) {
            if (onVadCallback) {
              onVadCallback({
                message:
                  'No audio detected for a while. Please talk or stop the recording if done.',
                error_code: ERROR_CODE.NO_AUDIO_CAPTURE,
                status_code: SDK_STATUS_CODE.AUDIO_ERROR,
              });
            }
            this.lastWarningTime = now;
            // Reset the silence timer to start counting the next 10 seconds
            this.noSpeechStartTime = now;
          }
        }
      }
    } else {
      // Reset timers when speech is detected
      this.noSpeechStartTime = null;
      this.lastWarningTime = null;
      if (onVadCallback) {
        onVadCallback({
          message: 'Audio captured. Recording continues.',
          error_code: ERROR_CODE.SPEECH_DETECTED,
          status_code: SDK_STATUS_CODE.SUCCESS,
        });
      }
    }
  }

  /**
   * Get the micVad instance
   */
  getMicVad(): MicVAD {
    return this.micVad;
  }

  /**
   * Check if VAD is loading
   */
  isVadLoading(): boolean {
    return this.is_vad_loading;
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
  async initVad(deviceId?: string) {
    const audioFileManager = EkaScribeStore.audioFileManagerInstance;
    const audioBuffer = EkaScribeStore.audioBufferInstance;
    this.is_vad_loading = true;

    // If we're re-initializing, make sure we don't leak an existing stream.
    this.stopMicStream();

    let selectedMicrophoneStream: MediaStream;
    try {
      selectedMicrophoneStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
    } catch (e: any) {
      // If the deviceId is invalid/unavailable, fall back to default mic.
      if (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError') {
        selectedMicrophoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        throw e;
      }
    }

    this.micStream = selectedMicrophoneStream;

    try {
      const vad = await MicVAD.new({
        stream: selectedMicrophoneStream,
        frameSamples: this.frame_size,
        preSpeechPadFrames: this.speech_pad_frames,
        onFrameProcessed: (prob, frames) => {
          // Get callback dynamically to ensure it's always up to date
          const vadFrameProcessedCallback = EkaScribeStore.vadFrameProcessedCallback;
          if (vadFrameProcessedCallback) {
            vadFrameProcessedCallback({ probabilities: prob, frame: frames });
          }

          // Only process frames internally when recording is active
          if (!this.recording_started) {
            return;
          }

          audioFileManager?.incrementTotalRawSamples(frames);

          audioBuffer?.append(frames);

          // Check if audio chunk needs to be clipped
          const { isSpeech } = prob;
          let vad_dec = 0;
          if (isSpeech >= 0.5) {
            vad_dec = 1;
          }

          // Call the new checkNoSpeech function
          this.checkNoSpeech(vad_dec);

          const vadResponse = this.processVadFrame(vad_dec);
          const is_clip_point = vadResponse[0];

          if (is_clip_point) {
            // audio chunk is of float32 Array <ArrayBuffer>
            const activeAudioChunk = audioBuffer?.getAudioData();
            this.processAudioChunk({ audioFrames: activeAudioChunk });
          }
        },
        onSpeechStart: () => {
          EkaScribeStore.userSpeechCallback?.(true);
        },
        onSpeechEnd: () => {
          EkaScribeStore.userSpeechCallback?.(false);
        },
      });

      this.is_vad_loading = false;
      this.micVad = vad;
      return this.is_vad_loading;
    } catch (e) {
      // If MicVAD initialization fails, release the microphone.
      this.stopMicStream();
      this.is_vad_loading = false;
      throw e;
    }
  }

  /**
   * reinitialize the vad instance
   */
  async reinitializeVad(deviceId?: string) {
    const response = await this.initVad(deviceId);
    return response;
  }

  /**
   * process and upload audio chunk to s3
   */
  async processAudioChunk({ audioFrames }: { audioFrames?: Float32Array }) {
    const audioFileManager = EkaScribeStore.audioFileManagerInstance;
    const audioBuffer = EkaScribeStore.audioBufferInstance;
    if (!audioFrames || !audioFileManager || !audioBuffer) return;

    // get the number of chunks already processed
    const filenumber = (audioFileManager.audioChunks.length || 0) + 1;
    const fileName = `${filenumber}.${OUTPUT_FORMAT}`;

    const rawSampleDetails = audioFileManager.getRawSampleDetails();
    const chunkTimestamps = audioBuffer?.calculateChunkTimestamps(rawSampleDetails.totalRawSamples);

    try {
      const chunkInfo: TAudioChunksInfo = {
        fileName,
        timestamp: {
          st: chunkTimestamps.start,
          et: chunkTimestamps.end,
        },
        status: 'pending',
        audioFrames,
      };

      const audioChunkLength = audioFileManager.updateAudioInfo(chunkInfo);

      audioFileManager?.incrementInsertedSamples(
        audioBuffer.getCurrentSampleLength(),
        audioBuffer.getCurrentFrameLength()
      );
      audioBuffer.resetBufferState();

      await audioFileManager.uploadAudioToS3({
        audioFrames,
        fileName,
        chunkIndex: audioChunkLength - 1,
      });
    } catch (error) {
      console.error('Error uploading audio chunk:', error);
    }
  }

  /**
   * Start VAD
   */
  startVad() {
    if (this.micVad && typeof this.micVad.start === 'function') {
      this.micVad.start();
    }
    this.recording_started = true;

    // this.monitorAudioCapture();
  }

  /**
   * Pause VAD
   */
  pauseVad() {
    if (this.micVad && typeof this.micVad.pause === 'function') {
      this.micVad.pause();
    }
    this.recording_started = false;
  }

  /**
   * End VAD
   */
  destroyVad() {
    // Properly destroy MicVAD instance
    if (this.micVad && typeof this.micVad.destroy === 'function') {
      this.micVad.destroy();
    }
    this.stopMicStream();
    this.recording_started = false;
  }

  /**
   * reset vadWeb instance
   */
  resetVadWebInstance() {
    // First, stop any ongoing operations
    // if (this.micVad && typeof this.micVad.pause === 'function') {
    //   this.micVad.pause(); // Stop recording first
    // }

    // Properly destroy MicVAD instance
    if (this.micVad && typeof this.micVad.destroy === 'function') {
      this.micVad.destroy();
    }
    this.stopMicStream();

    // Reset VAD state
    this.vad_past = [];
    this.last_clip_index = 0;
    this.clip_points = [0];
    this.sil_duration_acc = 0;
    this.noSpeechStartTime = null;
    this.lastWarningTime = null;
    this.recording_started = false;
    this.is_vad_loading = true; // Reset to initial state
    // this.micVad = {} as MicVAD; // Clear the instance
  }

  /**
   * monitor initial audio capture within starting 4 seconds
   */

  monitorAudioCapture() {
    const audioBuffer = EkaScribeStore.audioBufferInstance;
    const onVadCallback = EkaScribeStore.vadFramesCallback;

    setTimeout(() => {
      if (audioBuffer && audioBuffer.getCurrentSampleLength() <= 0) {
        this.micVad.pause();
        if (onVadCallback) {
          onVadCallback({
            message: 'No audio is being captured. Please check your microphone.',
            error_code: ERROR_CODE.NO_AUDIO_CAPTURE,
            status_code: SDK_STATUS_CODE.AUDIO_ERROR,
          });
        }
        return false;
      }

      return true;
    }, 5000);
  }

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
