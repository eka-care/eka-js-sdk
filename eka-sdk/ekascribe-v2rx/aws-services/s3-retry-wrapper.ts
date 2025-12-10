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
        try {
          const cogResponse = await postCogInit();
          const { credentials, code: cogStatus } = cogResponse as any;

          // Surface auth expiry to caller so it can be handled in the right context (e.g., main thread).
          if (cogStatus === 401) {
            const authError: any = new Error('Auth token expired');
            authError.statusCode = 401;
            authError.code = 'AuthTokenExpired';
            throw authError;
          }

          if (credentials) {
            configureAWS({
              accessKeyId: credentials.AccessKeyId,
              secretKey: credentials.SecretKey,
              sessionToken: credentials.SessionToken,
            });
          }
        } catch (cogError) {
          throw cogError;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry the operation
    return s3RetryWrapper(s3Fn, maxRetryCount, delay, retryAttempt + 1);
  }
}

export default s3RetryWrapper;
