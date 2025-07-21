import * as AWS from 'aws-sdk';
import s3RetryWrapper from './s3-retry-wrapper';

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
      Bucket: 'm-prod-voice2rx',
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
