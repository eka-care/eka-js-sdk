import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE, VAD_STATUS } from '../constants/enums';
import { TPauseRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const resumeVoiceRecording = (): TPauseRecordingResponse => {
  try {
    const vadInstance = EkaScribeStore.vadInstance;

    if (!vadInstance) {
      throw new Error('VAD instance is not initialized');
    }

    vadInstance.startVad();
    const txn_id = EkaScribeStore.txnID;
    EkaScribeStore.sessionStatus[txn_id] = {
      ...EkaScribeStore.sessionStatus[txn_id],
      vad: {
        status: VAD_STATUS.RESUME,
      },
    };

    return {
      status_code: SDK_STATUS_CODE.SUCCESS,
      message: 'Recording resumed successfully',
      is_paused: false,
    };
  } catch (error) {
    console.error('Error resuming recording:', error);

    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Failed to resume recording: ${error}`,
    };
  }
};

export default resumeVoiceRecording;
