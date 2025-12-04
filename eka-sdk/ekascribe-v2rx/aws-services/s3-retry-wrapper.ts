import postCogInit from '../api/post-cog-init';
import { configureAWS } from './configure-aws';

async function s3RetryWrapper<T>(
  s3Fn: () => Promise<T>,
  maxRetryCount: number,
  delay: number,
  retryAttempt: number,
  is_shared_worker = false
): Promise<T> {
  try {
    return await s3Fn();
  } catch (error) {
    console.log(JSON.stringify(error, null, 2), 'file upload - s3RetryWrapper - error');
    if (retryAttempt >= maxRetryCount) {
      throw error;
    }

    if (is_shared_worker) {
      // eslint-disable-next-line
      // @ts-ignore
      if (error.statusCode >= 400) {
        throw error;
      }
    } else {
      // eslint-disable-next-line
      // @ts-ignore
      const errorCode = error.code;
      // eslint-disable-next-line
      // @ts-ignore
      const statusCode = error.statusCode;

      // Normalise detection of expired/invalid credentials:
      // - Legacy AWS SDK path sets error.code === 'ExpiredToken'
      // - aws4 path (V2) sets both error.code === 'ExpiredToken' and statusCode >= 400
      if (errorCode === 'ExpiredToken' || statusCode >= 400) {
        const cogResponse = await postCogInit();
        const { credentials } = cogResponse;
        if (credentials) {
          configureAWS({
            accessKeyId: credentials.AccessKeyId,
            secretKey: credentials.SecretKey,
            sessionToken: credentials.SessionToken,
          });
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry the operation
    return s3RetryWrapper(s3Fn, maxRetryCount, delay, retryAttempt + 1);
  }
}

export default s3RetryWrapper;
