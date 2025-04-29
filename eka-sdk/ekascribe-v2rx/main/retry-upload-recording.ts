import postTransactionCommit from '../api/post-transaction-commit';
import postTransactionStop from '../api/post-transaction-stop';
import { TEndV2RxResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const retryUploadFiles = async (): Promise<TEndV2RxResponse> => {
  try {
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    if (!fileManagerInstance) {
      return {
        error: 'Something went wrong',
      };
    }

    const failedFiles = (await fileManagerInstance.retryFailedUploads()) || [];

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
    };
  } catch (err) {
    console.error('Error retrying upload: ', err);
    return {
      error: err as string,
    };
  }
};

export default retryUploadFiles;
