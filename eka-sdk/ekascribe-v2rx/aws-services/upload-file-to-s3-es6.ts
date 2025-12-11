import { AwsClient } from 'aws4fetch';
import s3RetryWrapper from './s3-retry-wrapper';
import { getConfiguredAwsCredentials } from './configure-aws';

interface UploadParams {
  s3BucketName: string;
  fileBlob: Blob;
  fileName: string;
  txnID: string;
  businessID: string;
  is_shared_worker?: boolean;
}

interface UploadResult {
  success?: string;
  error?: string;
  errorCode?: string;
  code?: number;
}

const pushFilesToS3V2 = async ({
  s3BucketName,
  fileBlob,
  fileName,
  txnID,
  businessID,
  is_shared_worker = false,
}: UploadParams): Promise<UploadResult> => {
  try {
    const configuredCredentials = getConfiguredAwsCredentials();

    if (!configuredCredentials) {
      throw new Error('AWS credentials are not configured. Call postCogInit/configureAWS first.');
    }

    const { accessKeyId, secretKey: secretAccessKey, sessionToken } = configuredCredentials;

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region: 'ap-south-1',
      service: 's3',
    });

    const url = `https://${s3BucketName}.s3.ap-south-1.amazonaws.com/${fileName}`;

    const uploadCall = (): Promise<Response> =>
      new Promise((resolve, reject) => {
        aws
          .fetch(url, {
            method: 'PUT',
            body: fileBlob,
            headers: {
              'Content-Type': fileBlob.type || 'application/octet-stream',
              'x-amz-meta-txnid': txnID,
              'x-amz-meta-bid': businessID,
            },
          })
          .then((response) => {
            if (!response.ok) {
              const error = {
                statusCode: response.status,
                message: response.statusText,
                // Normalise shape so s3RetryWrapper can treat this as an expired token
                // (matches legacy AWS SDK error.code === 'ExpiredToken' handling).
                code: 'ExpiredToken',
              };
              reject(error);
              return;
            }
            resolve(response);
          })
          .catch(reject);
      });

    // Retry upload with s3RetryWrapper
    const result = await s3RetryWrapper<Response>(uploadCall, 3, 2000, 0, is_shared_worker);

    const etag = result.headers.get('ETag');
    return { success: etag || 'Upload successful' };
  } catch (error: any) {
    const err = JSON.stringify(error, null, 2);
    console.error('pushFilesToS3V2 error =>', err);

    if (error.statusCode === 401 || error.code === 'AuthTokenExpired') {
      return {
        error: 'Authentication token expired. Please call updateAuthTokens with a new token.',
        errorCode: 'AuthTokenExpired',
        code: 401,
      };
    }

    if (error.statusCode && error.statusCode >= 400) {
      return {
        error: `Expired token! ${err}`,
        errorCode: 'ExpiredToken',
        code: error.statusCode || error.code,
      };
    }

    return {
      error: `Something went wrong! ${err}`,
      code: error.statusCode || error.code,
    };
  }
};

export default pushFilesToS3V2;
