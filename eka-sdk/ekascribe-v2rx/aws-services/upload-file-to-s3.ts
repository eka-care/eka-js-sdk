import * as AWS from 'aws-sdk';
import s3RetryWrapper from './s3-retry-wrapper';

const uploadFileToS3 = async ({
  fileBlob,
  fileName,
}: {
  fileBlob: Blob;
  fileName: string;
}): Promise<{
  success?: string;
  error?: string;
}> => {
  try {
    const requestBody: AWS.S3.PutObjectRequest = {
      Bucket: 'm-prod-voice2rx',
      Key: fileName,
      Body: fileBlob,
    };

    const uploadCall = () =>
      new Promise<AWS.S3.ManagedUpload.SendData>((resolve, reject) => {
        const s3Bucket = new AWS.S3({
          region: 'ap-south-1',
          maxRetries: 0,
        });

        s3Bucket.upload(requestBody, (err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      });

    // retry upload with s3RetryWrapper
    const result = await s3RetryWrapper<AWS.S3.ManagedUpload.SendData>(uploadCall, 3, 2000, 0);

    // Return success with the data
    return { success: result.ETag || 'Upload successful' };
  } catch (error) {
    console.error('pushFilesToS3V2 =>', error);
    return {
      error: `Something went wrong! ${error}`,
    };
  }
};

export default uploadFileToS3;
