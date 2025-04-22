import { TStartV2RxResponse } from '../constants/types';
import postTransactionInitV2 from '../api/post-transaction-init-v2';
import EkaScribeStore from '../store/store';
import { S3_BUCKET_NAME } from '../constants/audio-constants';

const startRecording = async (): Promise<TStartV2RxResponse> => {
  try {
    const vadInstance = EkaScribeStore.vadInstance;
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const navigatorPermissionResponse = await navigator.permissions.query({
      // @ts-ignore
      name: 'microphone',
    });
    if (navigatorPermissionResponse.state === 'denied') {
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

    // monitor if chunks are being recorded
    // TODO: return error if no chunks are being recorded
    vadInstance?.monitorAudioCapture();

    const initResponse = await postTransactionInitV2({
      mode: EkaScribeStore.mode,
      txnId: EkaScribeStore.txnID,
      s3Url: `s3://${S3_BUCKET_NAME}/${EkaScribeStore.s3FilePath}`,
    });

    if (initResponse.status === 'error') {
      return {
        error: initResponse.message,
      };
    }

    fileManagerInstance?.uploadSomToS3();

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

export default startRecording;
