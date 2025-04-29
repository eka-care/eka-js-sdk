import postTransactionCommit from '../api/post-transaction-commit';
import postTransactionStop from '../api/post-transaction-stop';
import { OUTPUT_FORMAT } from '../constants/audio-constants';
import { TEndV2RxResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const endVoiceRecording = async (): Promise<TEndV2RxResponse> => {
  try {
    const audioBufferInstance = EkaScribeStore.audioBufferInstance;
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    if (!fileManagerInstance || !audioBufferInstance) return { error: 'Something went wrong' };

    // upload last audio chunk
    if (audioBufferInstance.getCurrentSampleLength() > 0) {
      const audio = audioBufferInstance.getAudioData();
      const filenumber = fileManagerInstance.audioChunks.length || 1;
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

      await fileManagerInstance.uploadAudioChunk(audio, filename, audioChunkLength - 1);
    }

    await fileManagerInstance.waitForAllUploads();

    const failedFiles = fileManagerInstance.getFailedUploads() || [];

    // handling of failed files
    if (failedFiles.length > 0) {
      return {
        error: 'Recording upload failed. Please try again.',
        is_upload_failed: true,
      };
    }

    const audioInfo = fileManagerInstance?.audioChunks;
    const audioFiles = audioInfo.map((audio) => audio.fileName);

    const stopTransactionResponse = await postTransactionStop({
      txnId: EkaScribeStore.txnID,
      audioFiles,
    });
    if (stopTransactionResponse.status !== 'success') {
      return {
        stop_txn_error: stopTransactionResponse.message,
      };
    }

    const commitTransactionResponse = await postTransactionCommit({
      txnId: EkaScribeStore.txnID,
      audioFiles,
    });
    if (commitTransactionResponse.status !== 'success') {
      return {
        commit_txn_error: commitTransactionResponse.message,
      };
    }

    return {
      success: true,
      is_upload_failed: false,
    };
  } catch (error) {
    console.error('Error ending recording: ', error);
    return { error: error as string };
  }
};

export default endVoiceRecording;
