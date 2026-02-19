import { AwsClient } from 'aws4fetch';
import postCogInit from '../api/post-cog-init';
import { configureAWS, getConfiguredAwsCredentials } from './configure-aws';

// ============================================================================
// Types
// ============================================================================

export interface S3UploadParams {
  s3BucketName: string;
  fileBlob: Blob;
  fileName: string;
  txnID: string;
  businessID: string;
}

export interface S3UploadResult {
  success?: string;
  error?: string;
  errorCode?: string;
  code?: number;
  canRetry: boolean;
}

export interface S3UploadOptions {
  maxRetries?: number;
  initialDelay?: number;
}

// For shared worker - callback to refresh credentials from main thread
export type RefreshCredentialsFn = () => Promise<boolean>;

// ============================================================================
// Error Classification
// ============================================================================

interface ErrorInfo {
  isPermanent: boolean;
  code: number;
  message: string;
}

function classifyError(error: unknown): ErrorInfo {
  const err = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;

  // Session expired from token API - permanent
  if (err.is_session_expired) {
    return { isPermanent: true, code: 401, message: 'Session expired. Please re-login.' };
  }

  const statusCode = (err.statusCode || err.code) as number | undefined;

  // Permanent errors - don't retry
  if (statusCode === 401) {
    return { isPermanent: true, code: 401, message: 'Authentication failed. Please re-login.' };
  }
  if (statusCode === 403) {
    return { isPermanent: true, code: 403, message: 'Permission denied.' };
  }
  if (statusCode === 404) {
    return { isPermanent: true, code: 404, message: 'Resource not found.' };
  }

  // Transient errors - should retry
  return {
    isPermanent: false,
    code: statusCode || 500,
    message: (err.message as string) || 'Upload failed. Will retry.',
  };
}

// ============================================================================
// Credential Management
// ============================================================================

async function fetchAndConfigureCredentials(): Promise<{
  success: boolean;
  isPermanent: boolean;
  error?: string;
}> {
  try {
    const response = await postCogInit();
    const { credentials, is_session_expired } = response;

    if (is_session_expired) {
      return {
        success: false,
        isPermanent: true,
        error: 'Session expired. Please re-login.',
      };
    }

    if (!credentials) {
      return {
        success: false,
        isPermanent: false,
        error: 'No credentials returned from token API',
      };
    }

    const { AccessKeyId, SecretKey, SessionToken } = credentials;

    configureAWS({
      accessKeyId: AccessKeyId,
      secretKey: SecretKey,
      sessionToken: SessionToken,
    });

    return { success: true, isPermanent: false };
  } catch (error) {
    return {
      success: false,
      isPermanent: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credentials',
    };
  }
}

// ============================================================================
// S3 Upload (Core)
// ============================================================================

async function uploadToS3(params: S3UploadParams): Promise<Response> {
  const { s3BucketName, fileBlob, fileName, txnID, businessID } = params;

  const credentials = getConfiguredAwsCredentials();

  if (!credentials) {
    const error = Object.assign(new Error('AWS credentials not configured'), {
      code: 'CredentialsError',
    });
    throw error;
  }

  const { accessKeyId, secretKey: secretAccessKey, sessionToken } = credentials;

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region: 'ap-south-1',
    service: 's3',
  });

  const url = `https://${s3BucketName}.s3.ap-south-1.amazonaws.com/${fileName}`;

  const response = await aws.fetch(url, {
    method: 'PUT',
    body: fileBlob,
    headers: {
      'Content-Type': fileBlob.type || 'application/octet-stream',
      'x-amz-meta-txnid': txnID,
      'x-amz-meta-bid': businessID,
    },
  });

  if (!response.ok) {
    const error = Object.assign(new Error(response.statusText), {
      statusCode: response.status,
      code: response.status === 403 ? 'ExpiredToken' : 'UploadError',
    });
    throw error;
  }

  return response;
}

// ============================================================================
// Main Upload Function - For Main Thread
// ============================================================================

/**
 * Upload file to S3 with automatic credential management and retry logic.
 *
 * Flow:
 * 1. Check if credentials exist
 * 2. If not → fetch and configure credentials
 * 3. Upload file to S3
 * 4. If any error → refresh credentials & retry (unless permanent error)
 * 5. Retry with exponential backoff
 * 6. If permanent error → fail immediately
 */
export async function uploadFileToS3(
  params: S3UploadParams,
  options: S3UploadOptions = {}
): Promise<S3UploadResult> {
  const { maxRetries = 3, initialDelay = 1000 } = options;

  let lastError: ErrorInfo | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Step 1: Ensure credentials are available
      const existingCredentials = getConfiguredAwsCredentials();

      if (!existingCredentials) {
        console.log(`[S3UploadService] No credentials, fetching... (attempt ${attempt + 1})`);
        const credResult = await fetchAndConfigureCredentials();

        if (!credResult.success) {
          if (credResult.isPermanent) {
            return {
              error: credResult.error,
              code: 401,
              canRetry: false,
            };
          }
          throw new Error(credResult.error || 'Failed to fetch credentials');
        }
      }

      // Step 2: Attempt upload
      const response = await uploadToS3(params);

      // Success!
      const etag = response.headers.get('ETag');
      return {
        success: etag || 'Upload successful',
        canRetry: false,
      };
    } catch (error: unknown) {
      const errorInfo = classifyError(error);
      lastError = errorInfo;

      console.log(
        `[S3UploadService] Attempt ${attempt + 1}/${maxRetries + 1} failed:`,
        errorInfo.message,
        `(permanent: ${errorInfo.isPermanent})`
      );

      // Permanent error - don't retry
      if (errorInfo.isPermanent) {
        return {
          error: errorInfo.message,
          code: errorInfo.code,
          canRetry: false,
        };
      }

      // Last attempt - don't retry
      if (attempt >= maxRetries) {
        break;
      }

      // Transient error - refresh credentials and retry
      console.log(`[S3UploadService] Refreshing credentials before retry...`);
      const credResult = await fetchAndConfigureCredentials();

      if (!credResult.success && credResult.isPermanent) {
        return {
          error: credResult.error,
          code: 401,
          canRetry: false,
        };
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[S3UploadService] Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  return {
    error: lastError?.message || 'Upload failed after all retries',
    code: lastError?.code || 500,
    canRetry: true,
  };
}

// ============================================================================
// Worker Upload Function - For Shared Worker
// ============================================================================

/**
 * Upload file to S3 from shared worker context.
 * Uses a callback to request credential refresh from main thread.
 */
export async function uploadFileToS3Worker(
  params: S3UploadParams,
  refreshCredentialsFn: RefreshCredentialsFn,
  options: S3UploadOptions = {}
): Promise<S3UploadResult> {
  const { maxRetries = 3, initialDelay = 1000 } = options;

  let lastError: ErrorInfo | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Step 1: Ensure credentials are available
      const existingCredentials = getConfiguredAwsCredentials();

      if (!existingCredentials) {
        console.log(
          `[S3UploadService:Worker] No credentials, requesting from main thread... (attempt ${
            attempt + 1
          })`
        );
        const refreshed = await refreshCredentialsFn();

        if (!refreshed) {
          throw new Error('Failed to get credentials from main thread');
        }
      }

      // Step 2: Attempt upload
      const response = await uploadToS3(params);

      // Success!
      const etag = response.headers.get('ETag');
      return {
        success: etag || 'Upload successful',
        canRetry: false,
      };
    } catch (error: unknown) {
      const errorInfo = classifyError(error);
      lastError = errorInfo;

      console.log(
        `[S3UploadService:Worker] Attempt ${attempt + 1}/${maxRetries + 1} failed:`,
        errorInfo.message,
        `(permanent: ${errorInfo.isPermanent})`
      );

      // Permanent error - don't retry
      if (errorInfo.isPermanent) {
        return {
          error: errorInfo.message,
          code: errorInfo.code,
          canRetry: false,
        };
      }

      // Last attempt - don't retry
      if (attempt >= maxRetries) {
        break;
      }

      // Transient error - refresh credentials and retry
      console.log(`[S3UploadService:Worker] Requesting credential refresh from main thread...`);
      await refreshCredentialsFn();

      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[S3UploadService:Worker] Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  return {
    error: lastError?.message || 'Upload failed after all retries',
    code: lastError?.code || 500,
    canRetry: true,
  };
}
