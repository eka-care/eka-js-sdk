import * as AWS from 'aws-sdk';
import s3RetryWrapper from './s3-retry-wrapper';
import { GET_S3_BUCKET_NAME } from '../fetch-client/helper';

type TS3Response = {
  response?: AWS.S3.GetObjectOutput;
  error?: string;
};
export const getFilesS3 = async ({
  fileName,
  maxPollingTime,
}: {
  fileName: string;
  maxPollingTime: number;
}): Promise<TS3Response> => {
  try {
    const requestBody: AWS.S3.GetObjectRequest = {
      Bucket: GET_S3_BUCKET_NAME(),
      Key: fileName,
    };

    const getFileCall = () =>
      new Promise<AWS.S3.GetObjectOutput>((resolve, reject) => {
        const s3Bucket = new AWS.S3({
          region: 'ap-south-1',
          maxRetries: 0,
        });

        s3Bucket.getObject(requestBody, (err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      });

    // retry upload with s3RetryWrapper
    const result = await s3RetryWrapper<AWS.S3.GetObjectOutput>(
      getFileCall,
      maxPollingTime,
      1000,
      0
    );

    return {
      response: result,
    };
  } catch (error) {
    console.error('getFilesS3 =>', error);
    throw error;
  }
};
