export type RefreshTokenFn = () => Promise<boolean>;

interface RetryOptions {
  maxRetries: number;
  delay: number;
  refreshTokenFn?: RefreshTokenFn;
}

async function s3RetryWrapper<T>(s3Fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, delay, refreshTokenFn } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await s3Fn();
    } catch (error: any) {
      lastError = error;
      console.log(
        `[s3RetryWrapper] Attempt ${attempt + 1}/${maxRetries + 1} failed:`,
        JSON.stringify(error, null, 2)
      );

      // If we've exhausted all retries, throw
      if (attempt >= maxRetries) {
        break;
      }

      if (refreshTokenFn) {
        console.log('[s3RetryWrapper] Auth error detected, refreshing tokens...');
        try {
          const refreshed = await refreshTokenFn();
          if (!refreshed) {
            console.log('[s3RetryWrapper] Token refresh failed, not retrying');
            break;
          }
          console.log('[s3RetryWrapper] Tokens refreshed, retrying upload...');
        } catch (refreshError) {
          console.error('[s3RetryWrapper] Token refresh error:', refreshError);
          break;
        }
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export default s3RetryWrapper;
