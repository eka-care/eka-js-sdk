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
