import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';
import { TStartRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const startVoiceRecording = async (): Promise<TStartRecordingResponse> => {
  try {
    const vadInstance = EkaScribeStore.vadInstance;

    const navigatorPermissionResponse = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });

    if (navigatorPermissionResponse.state !== 'granted') {
      return {
        error_code: ERROR_CODE.MICROPHONE,
        status_code: SDK_STATUS_CODE.FORBIDDEN,
        message:
          'Microphone access not granted. Please go to your browser or site settings to provide access.',
      };
    }

    const micVad = vadInstance?.getMicVad();
    const isVadLoading = vadInstance?.isVadLoading();

    if (isVadLoading || !micVad || Object.keys(micVad).length === 0) {
      return {
        error_code: ERROR_CODE.VAD_NOT_INITIALIZED,
        status_code: SDK_STATUS_CODE.FORBIDDEN,
        message: 'VAD instance is not initialized. Please try again later.',
      };
    }

    vadInstance?.startVad();

    const txn_id = EkaScribeStore.txnID;
    EkaScribeStore.sessionStatus[txn_id] = {
      ...EkaScribeStore.sessionStatus[txn_id],
      vad: {
        status: 'start',
      },
    };

    return {
      message: 'Recording started successfully.',
      status_code: SDK_STATUS_CODE.SUCCESS,
      txn_id,
    };
  } catch (err) {
    console.log('%c Line:102 🍇 startRecording err', 'color:#b03734', err);
    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `An error occurred while starting the recording: ${err}`,
    };
  }
};

export default startVoiceRecording;
