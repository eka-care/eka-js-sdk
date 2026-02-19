import postTransactionCommit from '../api/transaction/post-transaction-commit';
import postTransactionStop from '../api/transaction/post-transaction-stop';
import { OUTPUT_FORMAT, SDK_STATUS_CODE } from '../constants/constant';
import { API_STATUS, CALLBACK_TYPE, ERROR_CODE, VAD_STATUS } from '../constants/enums';
import { TAudioChunksInfo, TEndRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const endVoiceRecording = async (): Promise<TEndRecordingResponse> => {
  try {
    const audioBufferInstance = EkaScribeStore.audioBufferInstance;
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    const vadInstance = EkaScribeStore.vadInstance;
    const txnID = EkaScribeStore.txnID;
    const onEventCallback = EkaScribeStore.eventCallback;

    if (!fileManagerInstance || !audioBufferInstance || !vadInstance) {
      throw new Error('Class instances are not initialized');
    }

    vadInstance.pauseVad();
    vadInstance.destroyVad();
    EkaScribeStore.updateVadStatus(txnID, VAD_STATUS.STOP);

    // upload last audio chunk
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

      await fileManagerInstance.uploadAudioToS3({
        audioFrames,
        fileName,
        chunkIndex: audioChunkLength - 1,
      });
    }

    await fileManagerInstance.waitForAllUploads();

    const audioInfo = fileManagerInstance?.audioChunks;
    const audioFiles = audioInfo.map((audio) => audio.fileName);

    console.log(audioFiles, 'Audio files to be committed, - endVoiceRecording - SDLK');

    // call stop txn api
    if (EkaScribeStore.sessionStatus[txnID].api?.status === API_STATUS.INIT) {
      const { message: txnStopMsg, code: txnStopStatusCode } = await postTransactionStop({
        audioFiles,
        txnId: txnID,
      });

      if (onEventCallback) {
        onEventCallback({
          callback_type: CALLBACK_TYPE.TRANSACTION_STATUS,
          status: 'info',
          message: `Transaction stop status: ${txnStopStatusCode}`,
          timestamp: new Date().toISOString(),
          data: {
            request: audioFiles,
          },
        });
      }

      if (txnStopStatusCode != 200) {
        return {
          error_code: ERROR_CODE.TXN_STOP_FAILED,
          status_code: txnStopStatusCode,
          message: txnStopMsg || 'Transaction stop failed.',
        };
      }

      EkaScribeStore.updateApiStatus(txnID, API_STATUS.STOP, txnStopStatusCode, txnStopMsg);
    } else if (EkaScribeStore.sessionStatus[txnID].api?.status === API_STATUS.NOT_INITIALIZED) {
      // transaction is not initialised
      return {
        error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
        status_code: SDK_STATUS_CODE.TXN_ERROR,
        message: 'Transaction is not initialized. Cannot end recording.',
      };
    }

    const failedFiles = fileManagerInstance.getFailedUploads() || [];
    let retryFailedFiles: string[] = [];

    console.log(failedFiles, 'Failed files before retry - endVoiceRecording - SDLK');

    // retry upload once if there are any failed uploads
    if (failedFiles.length > 0) {
      retryFailedFiles = await fileManagerInstance.retryFailedUploads();
    }

    // if there are still failed uploads after retry, return error
    if (retryFailedFiles.length > 0) {
      return {
        error_code: ERROR_CODE.AUDIO_UPLOAD_FAILED,
        status_code: SDK_STATUS_CODE.AUDIO_ERROR,
        message: 'Audio upload failed for some files after retry.',
        failed_files: retryFailedFiles,
        total_audio_files: audioFiles,
      };
    }

    // call commit transaction api
    const successfullyUploadedAudioFiles = fileManagerInstance.getSuccessfulAudioFileNames();
    if (
      EkaScribeStore.sessionStatus[txnID].api?.status === API_STATUS.STOP ||
      EkaScribeStore.sessionStatus[txnID].api?.status === API_STATUS.COMMIT
    ) {
      const { message: txnCommitMsg, code: txnCommitStatusCode } = await postTransactionCommit({
        txnId: txnID,
        audioFiles: successfullyUploadedAudioFiles,
      });

      if (onEventCallback) {
        onEventCallback({
          callback_type: CALLBACK_TYPE.TRANSACTION_STATUS,
          status: 'info',
          message: `Transaction commit status: ${txnCommitStatusCode}`,
          timestamp: new Date().toISOString(),
          data: {
            request: audioFiles,
          },
        });
      }

      if (txnCommitStatusCode != 200) {
        return {
          error_code: ERROR_CODE.TXN_COMMIT_FAILED,
          status_code: txnCommitStatusCode,
          message: txnCommitMsg || 'Transaction stop failed.',
        };
      }

      EkaScribeStore.updateApiStatus(txnID, API_STATUS.COMMIT, txnCommitStatusCode, txnCommitMsg);
    } else {
      // transaction is not stopped or committed
      return {
        error_code: ERROR_CODE.TXN_STATUS_MISMATCH,
        status_code: SDK_STATUS_CODE.TXN_ERROR,
        message: 'Transaction is not initialised or stopped. Cannot end recording.',
      };
    }

    return {
      status_code: SDK_STATUS_CODE.SUCCESS,
      message: 'Recording ended successfully.',
    };
  } catch (error) {
    console.error('Error ending recording: ', error);

    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `An error occurred while ending the recording: ${error}`,
    };
  }
};

export default endVoiceRecording;
