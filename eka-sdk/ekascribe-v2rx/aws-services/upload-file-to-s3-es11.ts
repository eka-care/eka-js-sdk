// @ts-nocheck
import * as AWS from 'aws-sdk';
import s3RetryWrapper, { RefreshTokenFn } from './s3-retry-wrapper';

interface UploadParams {
  s3BucketName: string;
  fileBlob: Blob;
  fileName: string;
  txnID: string;
  businessID: string;
  refreshTokenFn?: RefreshTokenFn;
}

interface UploadResult {
  success?: string;
  error?: string;
  errorCode?: string;
  code?: number;
}

const pushFileToS3 = async ({
  s3BucketName,
  fileBlob,
  fileName,
  txnID,
  businessID,
  refreshTokenFn,
}: UploadParams): Promise<UploadResult> => {
  try {
    const requestBody: AWS.S3.PutObjectRequest = {
      Bucket: s3BucketName,
      Key: fileName,
      Body: fileBlob,
      Metadata: {
        txnid: txnID,
        bid: businessID,
      },
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

    const result = await s3RetryWrapper<AWS.S3.ManagedUpload.SendData>(uploadCall, {
      maxRetries: 3,
      delay: 2000,
      refreshTokenFn,
    });

    return { success: result.ETag || 'Upload successful' };
  } catch (error) {
    const err = JSON.stringify(error, null, 2);
    console.error('pushFileToS3 error =>', err);

    return {
      error: `Something went wrong! ${err}`,
      code: error.statusCode || error.code,
    };
  }
};

export default pushFileToS3;
