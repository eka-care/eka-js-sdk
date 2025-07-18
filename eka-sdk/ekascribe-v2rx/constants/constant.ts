export const PREF_CHUNK_LENGTH = 10;
export const DESP_CHUNK_LENGTH = 20;
export const MAX_CHUNK_LENGTH = 25;
export const FRAME_SIZE = 1024;
export const SAMPLING_RATE = 16000;
export const DURATION_PER_FRAME = FRAME_SIZE / SAMPLING_RATE;
export const SILENCE_THRESHOLD = 0.01;
export const FRAME_RATE = SAMPLING_RATE / FRAME_SIZE;
export const SHORT_SILENCE_THRESHOLD = 0.1;
export const LONG_SILENCE_THRESHOLD = 0.5;
export const SPEECH_DETECTION_THRESHOLD = 0.5;
// export const REDEMPTION_FRAMES = 10;
export const PRE_SPEECH_PAD_FRAMES = 20;
// export const MIN_SPEECH_FRAMES = 80;
export const BITRATE = 128;
export const QUALITY = 0;
export const CHANNELS = 1;
export const AUDIO_BUFFER_SIZE_IN_S = DESP_CHUNK_LENGTH + 5;
export const OUTPUT_FORMAT = 'mp3';
export const AUDIO_EXTENSION_TYPE_MAP: Record<string, string> = {
  m4a: 'audio/m4a',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};
export const S3_BUCKET_NAME = 'm-prod-voice-record';

export const SDK_STATUS_CODE = {
  AUDIO_ERROR: 1001,
  SUCCESS: 1002,
  TXN_ERROR: 1003,
  BAD_REQUEST: 1004,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};
