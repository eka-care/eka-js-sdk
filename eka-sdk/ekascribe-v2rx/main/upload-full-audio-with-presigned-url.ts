import postV1FileUpload from '../api/post-v1-file-upload';
import uploadFilesWithPresignedUrl from '../api/upload-audio-with-presigned-url';
import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';

export type TFullAudioUploadResponse = {
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
};

export type TFullAudioRequest = {
  txn_id: string;
  action: string;
  audioFiles: File[] | Blob[];
};

export async function postV1UploadAudioFiles({
  audioFiles,
  txn_id,
  action,
}: TFullAudioRequest): Promise<TFullAudioUploadResponse> {
  try {
    if (!audioFiles || audioFiles.length === 0) {
      return {
        error_code: ERROR_CODE.INVALID_REQUEST,
        status_code: SDK_STATUS_CODE.BAD_REQUEST,
        message: 'No audio files provided',
      };
    }

    // Step 1: Get presigned URL
    const presignedUrlResponse = await postV1FileUpload({ txn_id, action });

    if (presignedUrlResponse.code !== 200) {
      return {
        error_code: ERROR_CODE.GET_PRESIGNED_URL_FAILED,
        status_code: presignedUrlResponse.code || SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: presignedUrlResponse.message || 'Get presigned URL failed',
      };
    }

    // Step 2: Upload files using the presigned URL
    const uploadResponse = await uploadFilesWithPresignedUrl({
      audioFiles,
      presignedUrlResponse,
    });

    return {
      status_code: uploadResponse.code || SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: uploadResponse.message || 'File uploaded.',
    };
  } catch (error) {
    console.error('getPresignedUrlAndUploadFiles error:', error);
    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Complete upload workflow failed: ${error}`,
    };
  }
}
