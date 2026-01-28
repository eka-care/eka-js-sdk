// window is undefined in sharedWorker so it is needed to decode the XML AWS error
if (typeof window === 'undefined') {
  self.window = self;
}

import { configureAWS } from '../aws-services/configure-aws';
import { uploadFileToS3Worker, RefreshCredentialsFn } from '../aws-services/s3-upload-service';
import { AUDIO_EXTENSION_TYPE_MAP, OUTPUT_FORMAT } from '../constants/constant';
import { SHARED_WORKER_ACTION } from '../constants/enums';
import compressAudioToMp3 from '../utils/compress-mp3-audio';

// onconnect - to establish communication channel with the main thread
// eslint-disable-next-line
// @ts-ignore
onconnect = function (event: MessageEvent) {
  // after connection messages are being channelled through the port
  const workerPort = event.ports[0];

  let uploadRequestReceived: number = 0;
  let uploadRequestCompleted: number = 0;

  // Store ALL pending token refresh resolvers (to handle concurrent requests)
  let pendingTokenRefreshResolvers: Array<(value: boolean) => void> = [];
  let isTokenRefreshInProgress: boolean = false;

  // Create a refreshCredentialsFn that communicates with main thread
  // Handles multiple concurrent refresh requests by queuing resolvers
  const createRefreshCredentialsFn = (): RefreshCredentialsFn => {
    return () =>
      new Promise<boolean>((resolve) => {
        // Add this resolver to the queue
        pendingTokenRefreshResolvers.push(resolve);

        // Only send one request to main thread, others will wait
        if (!isTokenRefreshInProgress) {
          isTokenRefreshInProgress = true;

          // Request token refresh from main thread
          workerPort.postMessage({
            action: SHARED_WORKER_ACTION.REQUEST_TOKEN_REFRESH,
          });

          // Timeout after 10 seconds - resolve all pending with false
          setTimeout(() => {
            if (isTokenRefreshInProgress) {
              console.error('[SharedWorker] Token refresh timeout');
              isTokenRefreshInProgress = false;
              // Resolve ALL pending requests with false
              pendingTokenRefreshResolvers.forEach((r) => r(false));
              pendingTokenRefreshResolvers = [];
            }
          }, 10000);
        }
      });
  };

  // onmessage - to handle messages from the main thread
  workerPort.onmessage = async function (event) {
    const workerData = event.data;

    switch (workerData.action) {
      case SHARED_WORKER_ACTION.TEST_WORKER: {
        // Respond to test message to confirm worker is functional
        workerPort.postMessage({
          action: SHARED_WORKER_ACTION.TEST_WORKER,
          message: 'Shared worker is functional',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      case SHARED_WORKER_ACTION.CONFIGURE_AWS: {
        try {
          const { accessKeyId, secretKey, sessionToken } = workerData.payload;

          configureAWS({
            accessKeyId,
            secretKey,
            sessionToken,
          });

          workerPort.postMessage({
            action: SHARED_WORKER_ACTION.CONFIGURE_AWS_SUCCESS,
            message: 'AWS configured successfully',
          });
        } catch (error: unknown) {
          workerPort.postMessage({
            action: SHARED_WORKER_ACTION.CONFIGURE_AWS_ERROR,
            error: error || 'Failed to configure AWS',
          });
        }

        return;
      }

      case SHARED_WORKER_ACTION.TOKEN_REFRESH_SUCCESS: {
        // Main thread has refreshed tokens - configure AWS with new credentials
        const { accessKeyId, secretKey, sessionToken } = workerData.payload || {};

        if (accessKeyId && secretKey && sessionToken) {
          configureAWS({
            accessKeyId,
            secretKey,
            sessionToken,
          });
        }

        // Resolve ALL pending token refresh promises
        isTokenRefreshInProgress = false;
        pendingTokenRefreshResolvers.forEach((resolver) => resolver(true));
        pendingTokenRefreshResolvers = [];
        return;
      }

      case SHARED_WORKER_ACTION.TOKEN_REFRESH_ERROR: {
        // Main thread failed to refresh tokens
        console.error('[SharedWorker] Token refresh failed:', workerData.error);

        // Resolve ALL pending token refresh promises with false
        isTokenRefreshInProgress = false;
        pendingTokenRefreshResolvers.forEach((resolver) => resolver(false));
        pendingTokenRefreshResolvers = [];
        return;
      }

      case SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER: {
        const { fileName, audioFrames, txnID, businessID, fileBlob, s3BucketName } =
          workerData.payload;
        uploadRequestReceived++;

        let audioBlob: Blob;
        let compressedAudioBuffer: Uint8Array[] | undefined;

        if (fileBlob) {
          audioBlob = fileBlob;
        } else {
          compressedAudioBuffer = compressAudioToMp3(audioFrames);

          audioBlob = new Blob(compressedAudioBuffer, {
            type: AUDIO_EXTENSION_TYPE_MAP[OUTPUT_FORMAT],
          });
        }

        // Use uploadFileToS3Worker directly - handles credentials and retry internally
        const response = await uploadFileToS3Worker(
          {
            s3BucketName,
            fileBlob: audioBlob,
            fileName,
            txnID,
            businessID,
          },
          createRefreshCredentialsFn()
        );

        uploadRequestCompleted++;

        // Send response back to main thread
        workerPort.postMessage({
          action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS,
          response,
          requestBody: {
            ...workerData.payload,
            fileBlob: audioBlob,
            compressedAudioBuffer,
          },
        });

        return;
      }

      case SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS: {
        if (uploadRequestReceived === uploadRequestCompleted) {
          workerPort.postMessage({
            action: SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS_SUCCESS,
            response: {
              uploadRequestReceived,
              uploadRequestCompleted,
            },
          });
          return;
        }

        workerPort.postMessage({
          action: SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS_ERROR,
          response: {
            uploadRequestReceived,
            uploadRequestCompleted,
          },
        });
        return;
      }
    }
  };

  workerPort.postMessage(`[WORKER] Web worker onmessage established ${JSON.stringify(workerPort)}`);

  // start the worker port to listen for messages
  workerPort.start();
};

console.log('File upload web worker created');
