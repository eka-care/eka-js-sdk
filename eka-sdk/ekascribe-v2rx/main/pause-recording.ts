import { OUTPUT_FORMAT, SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';
import { TPauseRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const pauseVoiceRecording = async (): Promise<TPauseRecordingResponse> => {
  try {
    const audioBufferInstance = EkaScribeStore.audioBufferInstance;
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    const vadInstance = EkaScribeStore.vadInstance;

    if (!fileManagerInstance || !audioBufferInstance || !vadInstance) {
      throw new Error('Class instances are not initialized');
    }

    vadInstance.pauseVad();

    const txn_id = EkaScribeStore.txnID;
    EkaScribeStore.sessionStatus[txn_id] = {
      ...EkaScribeStore.sessionStatus[txn_id],
      vad: {
        status: 'pause',
      },
    };

    if (audioBufferInstance.getCurrentSampleLength() > 0) {
      const audioFrames = audioBufferInstance.getAudioData();
      const filenumber = (fileManagerInstance.audioChunks.length || 0) + 1;
      const filename = `${filenumber}.${OUTPUT_FORMAT}`;

      const rawSampleDetails = fileManagerInstance.getRawSampleDetails();
      const chunkTimestamps = audioBufferInstance.calculateChunkTimestamps(
        rawSampleDetails.totalRawSamples
      );

      const chunkInfo = {
        timestamp: {
          st: chunkTimestamps.start,
          et: chunkTimestamps.end,
        },
        fileName: filename,
      };

      const audioChunkLength = fileManagerInstance.updateAudioInfo(chunkInfo);

      fileManagerInstance?.incrementInsertedSamples(
        audioBufferInstance.getCurrentSampleLength(),
        audioBufferInstance.getCurrentFrameLength()
      );
      audioBufferInstance.resetBufferState();

      await fileManagerInstance.uploadAudioToS3({
        audioFrames,
        fileName: filename,
        chunkIndex: audioChunkLength - 1,
      });
    }

    return {
      status_code: SDK_STATUS_CODE.SUCCESS,
      message: 'Recording paused successfully',
      is_paused: true,
    };
  } catch (error) {
    console.log('%c Line:7 🍔 pauseRecording error', 'color:#3f7cff', error);
    return {
      error_code: ERROR_CODE.UNKNOWN_ERROR,
      status_code: SDK_STATUS_CODE.BAD_REQUEST,
      message: `An error occurred while starting the recording: ${error}`,
    };
  }
};

export default pauseVoiceRecording;
