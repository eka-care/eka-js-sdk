import * as lamejs from '@breezystack/lamejs';
import { BITRATE, SAMPLING_RATE } from '../constants/constant';

const compressAudioToMp3 = (audio: Float32Array) => {
  try {
    const audioEncoder = new lamejs.Mp3Encoder(1, SAMPLING_RATE, BITRATE);
    console.log("%c Line:7 🥒 audioEncoder", "color:#33a5ff", audioEncoder);

    // convert Float32Array to Int16Array
    const samples = new Int16Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      const s = Math.max(-1, Math.min(1, audio[i]));
      samples[i] = s < 0 ? s * 32768 : s * 32767;
    }

    const mp3Data: Uint8Array[] = [];
    const encodedBuffer = audioEncoder.encodeBuffer(samples);

    mp3Data.push(encodedBuffer);
    const lastAudioBuffer = audioEncoder.flush();

    mp3Data.push(lastAudioBuffer);

    return mp3Data;
  } catch (error) {
    console.error('Error compressing audio to MP3: lamejs: ', error);
    return [];
  }
};

export default compressAudioToMp3;
