import { TStartV2RxResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const startVoiceRecording = async (): Promise<TStartV2RxResponse> => {
  try {
    const vadInstance = EkaScribeStore.vadInstance;
    const audioBufferInstance = EkaScribeStore.audioBufferInstance;

    if (!audioBufferInstance) {
      return {
        error: 'Something went wrong',
      };
    }

    // TODO: test this microphone permission check via sdk is working or not?
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const navigatorPermissionResponse = await navigator.permissions.query({
      // @ts-ignore
      name: 'microphone',
    });

    if (
      navigatorPermissionResponse.state === 'denied' ||
      navigatorPermissionResponse.state === 'prompt'
    ) {
      return {
        microphone_error:
          'Microphone access not granted. Please go to your browser or site settings to provide access.',
      };
    }

    // TODO: handle vad errors
    // if (micVad.errored) {
    //   return {
    //     vad_error: 'Microphone access not granted. Please check access in your system settings.',
    //   };
    // }

    vadInstance?.startVad();

    // return error if no chunks are being recorded
    setTimeout(() => {
      if (audioBufferInstance.getCurrentSampleLength() <= 0) {
        return {
          recording_error:
            'Oops! We’ve encountered an error while recording, please restart the recording.',
        };
      }
    }, 2000);

    return {
      success: true,
    };
  } catch (err) {
    console.error('Error starting recording: ', err);
    return {
      error: err as string,
    };
  }
};

export default startVoiceRecording;
