// @ts-nocheck
import * as AWS from 'aws-sdk';
import s3RetryWrapper from './s3-retry-wrapper';
import { S3_BUCKET_NAME } from '../constants/constant';

const pushFileToS3 = async ({
  fileBlob,
  fileName,
  txnID,
  businessID,
  is_shared_worker = false,
}: {
  fileBlob: Blob;
  fileName: string;
  txnID: string;
  businessID: string;
  is_shared_worker?: boolean;
}): Promise<{
  success?: string;
  error?: string;
  errorCode?: string;
  code?: number;
}> => {
  try {
    const requestBody: AWS.S3.PutObjectRequest = {
      Bucket: S3_BUCKET_NAME,
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

    // retry upload with s3RetryWrapper
    const result = await s3RetryWrapper<AWS.S3.ManagedUpload.SendData>(
      uploadCall,
      3,
      2000,
      0,
      is_shared_worker
    );

    // Return success with the data
    return { success: result.ETag || 'Upload successful' };
  } catch (error) {
    const err = JSON.stringify(error, null, 2);
    console.error('pushFilesToS3V2 error =>', err);

    if (error.statusCode && error.statusCode >= 400) {
      return {
        error: `Expired token! ${err}`,
        errorCode: 'ExpiredToken',
        code: error.statusCode,
      };
    }

    return {
      error: `Something went wrong! ${err}`,
      code: error.statusCode,
    };
  }
};

export default pushFileToS3;
