import { ERROR_CODE } from '../constants/enums';
import { TPauseRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const resumeVoiceRecorfing = (): TPauseRecordingResponse => {
  try {
    const vadInstance = EkaScribeStore.vadInstance;

    if (!vadInstance) {
      throw new Error('VAD instance is not initialized');
    }

    vadInstance.startVad();

    return {
      status_code: 200,
      message: 'Recording resumed successfully',
      is_paused: false,
    };
  } catch (error) {
    console.error('Error resuming recording:', error);

    return {
      error_code: ERROR_CODE.UNKNOWN_ERROR,
      status_code: 520,
      message: `Failed to resume recording: ${error}`,
    };
  }
};

export default resumeVoiceRecorfing;
