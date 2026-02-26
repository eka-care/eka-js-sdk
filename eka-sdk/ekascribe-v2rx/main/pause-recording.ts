import { OUTPUT_FORMAT, SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE, VAD_STATUS } from '../constants/enums';
import { TAudioChunksInfo, TPauseRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const pauseVoiceRecording = (): TPauseRecordingResponse => {
  try {
    const audioBufferInstance = EkaScribeStore.audioBufferInstance;
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    const vadInstance = EkaScribeStore.vadInstance;

    if (!fileManagerInstance || !audioBufferInstance || !vadInstance) {
      throw new Error('Class instances are not initialized');
    }

    vadInstance.pauseVad();

    const txn_id = EkaScribeStore.txnID;
    EkaScribeStore.updateVadStatus(txn_id, VAD_STATUS.PAUSE);

    if (audioBufferInstance.getCurrentSampleLength() > 0) {
      const audioFrames = audioBufferInstance.getAudioData();
      const filenumber = (fileManagerInstance.audioChunks.length || 0) + 1;
      const fileName = `${filenumber}.${OUTPUT_FORMAT}`;

      const rawSampleDetails = fileManagerInstance.getRawSampleDetails();
      const chunkTimestamps = audioBufferInstance.calculateChunkTimestamps(
        rawSampleDetails.totalRawSamples
      );

      const chunkInfo: TAudioChunksInfo = {
        fileName,
        timestamp: {
          st: chunkTimestamps.start,
          et: chunkTimestamps.end,
        },
        status: 'pending',
        audioFrames,
      };

      const audioChunkLength = fileManagerInstance.updateAudioInfo(chunkInfo);

      fileManagerInstance?.incrementInsertedSamples(
        audioBufferInstance.getCurrentSampleLength(),
        audioBufferInstance.getCurrentFrameLength()
      );
      audioBufferInstance.resetBufferState();

      fileManagerInstance.uploadAudioToS3({
        audioFrames,
        fileName,
        chunkIndex: audioChunkLength - 1,
      });
    }

    return {
      status_code: SDK_STATUS_CODE.SUCCESS,
      message: 'Recording paused successfully',
      is_paused: true,
    };
  } catch (error) {
    console.error('%c Line:7 🍔 pauseRecording error', 'color:#3f7cff', error);
    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `An error occurred while starting the recording: ${error}`,
    };
  }
};

export default pauseVoiceRecording;
