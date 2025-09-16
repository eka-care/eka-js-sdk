import { SDK_STATUS_CODE } from '../constants/constant';
import { TPostV1FileUploadResponse } from '../constants/types';

type TUploadSingleFileResponse = {
  key?: string;
  size?: number;
  success: boolean;
  error?: string;
};

async function uploadSingleFile(
  uploadData: TPostV1FileUploadResponse['uploadData'],
  folderPath: string,
  file: File | Blob,
  fileName?: string
): Promise<TUploadSingleFileResponse> {
  try {
    const updatedFields = {
      ...uploadData.fields,
      key: folderPath + fileName,
    };

    const formData = new FormData();
    Object.entries(updatedFields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    formData.append('file', file);

    const response = await fetch(uploadData.url, {
      method: 'POST',
      body: formData,
    });

    if (response.status === 204) {
      // S3 returns 204 No Content on successful upload
      return {
        key: folderPath + fileName,
        size: file.size,
        success: true,
      };
    } else {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error('uploadSingleFile error:', error);
    return {
      success: false,
      error: `Upload failed: ${error}`,
    };
  }
}

type TUploadFilesResponse = {
  code: number;
  message: string;
};

async function uploadFilesWithPresignedUrl({
  audioFiles,
  audioFileNames,
  presignedUrlResponse,
}: {
  audioFiles: File[] | Blob[];
  audioFileNames: string[];
  presignedUrlResponse: TPostV1FileUploadResponse;
}): Promise<TUploadFilesResponse> {
  try {
    const uploadPromises = audioFiles.map((file, index) => {
      const fileName = audioFileNames[index];

      return uploadSingleFile(
        { ...presignedUrlResponse.uploadData },
        presignedUrlResponse.folderPath,
        file,
        fileName
      );
    });

    const results = await Promise.all(uploadPromises);

    const failedUploads = results.filter((result) => !result.success);
    const successfulUploads = results.filter((result) => result.success);

    // TODO: presigned url expiry handling and failed files handling

    return {
      code: failedUploads.length > 0 ? 207 : 200, // 207 for partial success, 200 for all success
      message: `Upload completed. ${successfulUploads.length}/${results.length} files uploaded successfully.`,
    };
  } catch (error) {
    console.error('uploadAudioFilesWithPresignedUrl error:', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Upload failed: ${error}`,
    };
  }
}

export default uploadFilesWithPresignedUrl;
