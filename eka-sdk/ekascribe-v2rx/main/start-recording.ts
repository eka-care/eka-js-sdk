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
        message: 'Microphone access is required to start recording. Please recheck access.',
      };
    }

    await vadInstance?.initVad();

    console.log(vadInstance, 'vad in start recording');

    const micVad = vadInstance?.getMicVad();
    console.log(micVad, 'mic vad in start recording');
    const isVadLoading = vadInstance?.isVadLoading();
    console.log(isVadLoading, 'is vad loading in start recording');

    if (isVadLoading || !micVad || Object.keys(micVad).length === 0) {
      // retry initiating vad once and if still is in loading return error
      const reinitializeVadResponse = await vadInstance?.reinitializeVad();
      console.log(reinitializeVadResponse, 'reinitialize vad response');
      if (reinitializeVadResponse) {
        return {
          error_code: ERROR_CODE.VAD_NOT_INITIALIZED,
          status_code: SDK_STATUS_CODE.FORBIDDEN,
          message: 'VAD instance is not initialized. Please try again later.',
        };
      }
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
