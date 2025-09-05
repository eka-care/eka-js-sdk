import postV1FileUpload from '../api/post-v1-file-upload';
import postTransactionInit from '../api/transaction/post-transaction-init';
import uploadFilesWithPresignedUrl from '../api/upload-audio-with-presigned-url';
import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';
import { TPostV1UploadAudioFilesRequest } from '../constants/types';

export type TFullAudioUploadResponse = {
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
};

export async function postV1UploadAudioFiles({
  audioFiles,
  txn_id,
  action,
  transfer,
  mode,
  s3Url,
  input_language,
  output_format_template,
  model_training_consent,
  auto_download,
  system_info,
  patient_details,
  model_type,
  version,
  flavour,
}: TPostV1UploadAudioFilesRequest): Promise<TFullAudioUploadResponse> {
  try {
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

    if (uploadResponse.code !== 200) {
      return {
        error_code: ERROR_CODE.AUDIO_UPLOAD_FAILED,
        status_code: uploadResponse.code || SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: uploadResponse.message || 'File uploaded.',
      };
    }

    const batch_s3_url = presignedUrlResponse.uploadData.url + presignedUrlResponse.folderPath;

    const initTransactionResponse = await postTransactionInit({
      mode,
      txn_id,
      s3Url,
      input_language,
      output_format_template,
      model_training_consent,
      auto_download,
      transfer,
      system_info,
      patient_details,
      model_type,
      version,
      flavour,
      batch_s3_url,
    });

    if (initTransactionResponse.code >= 400) {
      return {
        error_code: ERROR_CODE.TXN_INIT_FAILED,
        status_code: initTransactionResponse.code || SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: initTransactionResponse.message || 'Transaction initialization failed.',
      };
    }

    return {
      status_code: SDK_STATUS_CODE.SUCCESS,
      message: 'Transaction initialized successfully.',
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
