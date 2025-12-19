import postTransactionCommit from '../api/transaction/post-transaction-commit';
import { SDK_STATUS_CODE } from '../constants/constant';
import { CALLBACK_TYPE, ERROR_CODE } from '../constants/enums';
import { TEndRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const retryUploadFailedFiles = async ({
  force_commit = false,
}: {
  force_commit?: boolean;
}): Promise<TEndRecordingResponse> => {
  try {
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    const onEventCallback = EkaScribeStore.eventCallback;

    if (!fileManagerInstance) {
      throw new Error('Class instances are not initialized');
    }

    const failedFiles = (await fileManagerInstance.retryFailedUploads()) || [];
    const audioInfo = fileManagerInstance?.audioChunks.filter((file) => file.status === 'success');
    const audioFiles = audioInfo.map((audio) => audio.fileName);

    if (failedFiles.length > 0 && !force_commit) {
      return {
        error_code: ERROR_CODE.AUDIO_UPLOAD_FAILED,
        status_code: SDK_STATUS_CODE.AUDIO_ERROR,
        message: 'Audio upload failed for some files after retry.',
        failed_files: failedFiles,
        total_audio_files: audioFiles,
      };
    }

    // call commit transaction api
    const txnID = EkaScribeStore.txnID;
    if (
      EkaScribeStore.sessionStatus[txnID].api?.status === 'stop' ||
      EkaScribeStore.sessionStatus[txnID].api?.status === 'commit'
    ) {
      const { message: txnCommitMsg, code: txnCommitStatusCode } = await postTransactionCommit({
        txnId: EkaScribeStore.txnID,
        audioFiles,
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

      EkaScribeStore.sessionStatus[txnID] = {
        ...EkaScribeStore.sessionStatus[txnID],
        api: {
          status: 'commit',
          code: txnCommitStatusCode,
          response: txnCommitMsg,
        },
      };
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
      message: 'All recordings uploaded successfully.',
    };
  } catch (error) {
    console.error('Error retrying upload: ', error);
    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `An error occurred while retrying failed upload: ${error}`,
    };
  }
};

export default retryUploadFailedFiles;
