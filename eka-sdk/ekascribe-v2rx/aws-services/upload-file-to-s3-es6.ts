import { AwsClient } from 'aws4fetch';
import s3RetryWrapper, { RefreshTokenFn } from './s3-retry-wrapper';
import { getConfiguredAwsCredentials, configureAWS } from './configure-aws';
import postCogInit from '../api/post-cog-init';

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

// Default token refresh function for main thread - calls cog API
const defaultRefreshTokenFn: RefreshTokenFn = async () => {
  try {
    const cogResponse = await postCogInit();
    const { credentials, code: cogStatus } = cogResponse as any;

    if (cogStatus === 401) {
      console.error('[refreshToken] Auth token expired');
      return false;
    }

    if (credentials) {
      configureAWS({
        accessKeyId: credentials.AccessKeyId,
        secretKey: credentials.SecretKey,
        sessionToken: credentials.SessionToken,
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[refreshToken] Failed to refresh tokens:', error);
    return false;
  }
};

const pushFilesToS3V2 = async ({
  s3BucketName,
  fileBlob,
  fileName,
  txnID,
  businessID,
  refreshTokenFn = defaultRefreshTokenFn,
}: UploadParams): Promise<UploadResult> => {
  try {
    const url = `https://${s3BucketName}.s3.ap-south-1.amazonaws.com/${fileName}`;

    // uploadCall creates a fresh AWS client on each attempt to use latest credentials
    const uploadCall = (): Promise<Response> =>
      new Promise((resolve, reject) => {
        const configuredCredentials = getConfiguredAwsCredentials();

        if (!configuredCredentials) {
          reject(
            new Error('AWS credentials are not configured. Call postCogInit/configureAWS first.')
          );
          return;
        }

        const { accessKeyId, secretKey: secretAccessKey, sessionToken } = configuredCredentials;

        const aws = new AwsClient({
          accessKeyId,
          secretAccessKey,
          sessionToken,
          region: 'ap-south-1',
          service: 's3',
        });

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
                code: response.status === 403 ? 'ExpiredToken' : 'UploadError',
              };
              reject(error);
              return;
            }
            resolve(response);
          })
          .catch(reject);
      });

    const result = await s3RetryWrapper<Response>(uploadCall, {
      maxRetries: 3,
      delay: 2000,
      refreshTokenFn,
    });

    const etag = result.headers.get('ETag');
    return { success: etag || 'Upload successful' };
  } catch (error: any) {
    const err = JSON.stringify(error, null, 2);
    console.error('pushFilesToS3V2 error =>', err);

    return {
      error: `Something went wrong! ${err}`,
      code: error.statusCode || error.code,
    };
  }
};

export default pushFilesToS3V2;
