import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE, VAD_STATUS } from '../constants/enums';
import { TStartRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const startVoiceRecording = async (microphoneID?: string): Promise<TStartRecordingResponse> => {
  try {
    const vadInstance = EkaScribeStore.vadInstance;

    if (!vadInstance) {
      return {
        error_code: ERROR_CODE.VAD_NOT_INITIALIZED,
        status_code: SDK_STATUS_CODE.FORBIDDEN,
        message: 'VAD instance is not initialized. Initialize transaction first.',
      };
    }

    let permissionGranted = true;
    try {
      const navigatorPermissionResponse = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      permissionGranted = navigatorPermissionResponse.state === 'granted';
    } catch {
      // Safari doesn't support permissions.query for microphone - let getUserMedia handle it
      permissionGranted = true;
    }

    if (!permissionGranted) {
      return {
        error_code: ERROR_CODE.MICROPHONE,
        status_code: SDK_STATUS_CODE.FORBIDDEN,
        message: 'Microphone access is required to start recording. Please recheck access.',
      };
    }

    await vadInstance.initVad(microphoneID);

    const micVad = vadInstance.getMicVad();
    const isVadLoading = vadInstance.isVadLoading();

    if (isVadLoading || !micVad || typeof micVad.start !== 'function') {
      // retry initiating vad once and if still is in loading return error
      const reinitializeVadResponse = await vadInstance.reinitializeVad(microphoneID);
      if (reinitializeVadResponse) {
        return {
          error_code: ERROR_CODE.VAD_NOT_INITIALIZED,
          status_code: SDK_STATUS_CODE.FORBIDDEN,
          message: 'VAD instance is not initialized. Please try again later.',
        };
      }
    }

    vadInstance.startVad();

    const txn_id = EkaScribeStore.txnID;
    if (!txn_id) {
      return {
        error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
        status_code: SDK_STATUS_CODE.TXN_ERROR,
        message: 'Transaction not initialized. Call initTransaction first.',
      };
    }
    EkaScribeStore.updateVadStatus(txn_id, VAD_STATUS.START);

    return {
      message: 'Recording started successfully.',
      status_code: SDK_STATUS_CODE.SUCCESS,
      txn_id,
    };
  } catch (err: unknown) {
    console.error('%c Line:102 🍇 startRecording err', 'color:#b03734', err);

    // Detect microphone permission denial from getUserMedia (Safari + all browsers)
    const errorName = err instanceof DOMException ? err.name : '';
    const isMicError =
      errorName === 'NotAllowedError' ||
      errorName === 'PermissionDeniedError' ||
      errorName === 'NotFoundError';

    if (isMicError) {
      return {
        error_code: ERROR_CODE.MICROPHONE,
        status_code: SDK_STATUS_CODE.FORBIDDEN,
        message: 'Microphone access is required to start recording. Please recheck access.',
      };
    }

    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `An error occurred while starting the recording: ${err}`,
    };
  }
};

export default startVoiceRecording;
