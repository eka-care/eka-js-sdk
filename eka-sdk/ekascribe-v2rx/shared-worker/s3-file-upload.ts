// window is undefined in sharedWorker so it is needed to decode the XML AWS error
if (typeof window === 'undefined') {
  self.window = self;
}

import { configureAWS } from '../aws-services/configure-aws';
import pushFileToS3 from '../aws-services/upload-file-to-s3';
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

  // onmessage - to handle messages from the main thread
  workerPort.onmessage = async function (event) {
    const workerData = event.data;

    switch (workerData.action) {
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

      case SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER: {
        const { fileName, audioFrames, txnID, businessID, fileBlob, s3BucketName } =
          workerData.payload;
        uploadRequestReceived++;

        let audioBlob: Blob;
        let compressedAudioBuffer: Uint8Array[] = [];

        if (fileBlob) {
          audioBlob = fileBlob;
        } else {
          compressedAudioBuffer = compressAudioToMp3(audioFrames);

          audioBlob = new Blob(compressedAudioBuffer, {
            type: AUDIO_EXTENSION_TYPE_MAP[OUTPUT_FORMAT],
          });
        }

        await pushFileToS3({
          s3BucketName,
          fileBlob: audioBlob,
          fileName,
          txnID,
          businessID,
          is_shared_worker: true,
        })
          .then((response) => {
            uploadRequestCompleted++;
            // postMessage - to send messages back to the main thread
            workerPort.postMessage({
              action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS,
              response,
              requestBody: {
                ...workerData.payload,
                fileBlob: audioBlob,
                compressedAudioBuffer,
              },
            });
          })
          .catch((error) => {
            console.log(error, 'shared worker - file upload');
            uploadRequestCompleted++;
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
