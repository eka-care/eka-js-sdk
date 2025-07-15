// window is undefined in sharedWorker so it is needed to decode the XML AWS error
if (typeof window === 'undefined') {
  self.window = self;
}

import AudioBufferManager from '../audio-chunker/audio-buffer-manager';
import AudioFileManager from '../audio-chunker/audio-file-manager';
import VadWebClient from '../audio-chunker/vad-web';
import { configureAWS } from '../aws-services/configure-aws';
import pushFileToS3 from '../aws-services/upload-file-to-s3';
import { AUDIO_EXTENSION_TYPE_MAP, OUTPUT_FORMAT } from '../constants/audio-constants';
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
  let audioFileManager: AudioFileManager;
  let audioBuffer: AudioBufferManager;
  let vadWeb: VadWebClient;

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
        const { fileName, audioFrames, txnID, businessID, fileBlob } = workerData.payload;
        uploadRequestReceived++;

        let audioBlob: Blob;

        if (fileBlob) {
          audioBlob = fileBlob;
        } else {
          const compressedAudioBuffer = compressAudioToMp3(audioFrames);

          audioBlob = new Blob(compressedAudioBuffer, {
            type: AUDIO_EXTENSION_TYPE_MAP[OUTPUT_FORMAT],
          });
        }

        await pushFileToS3({
          fileBlob: audioBlob,
          fileName,
          txnID,
          businessID,
        })
          .then((response) => {
            console.log('%c Line:68 🧀 response', 'color:#ed9ec7', response);
            uploadRequestCompleted++;
            // postMessage - to send messages back to the main thread
            workerPort.postMessage({
              action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS,
              response,
              requestBody: {
                ...workerData.payload,
                fileBlob: audioBlob,
              },
            });
          })
          .catch((error) => {
            console.log('%c Line:78 🥐 error', 'color:#93c0a4', error);
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

      case SHARED_WORKER_ACTION.SET_CLASS_INSTANCE: {
        const { audioFileManagerInstance, audioBufferInstance, vadInstance } = workerData.payload;
        audioBuffer = audioBufferInstance;
        audioFileManager = audioFileManagerInstance;
        vadWeb = vadInstance;
        return;
      }

      case SHARED_WORKER_ACTION.INIT_VAD: {
        if (!vadWeb) {
          workerPort.postMessage({
            action: SHARED_WORKER_ACTION.INIT_VAD_ERROR,
            error: 'VAD instance is not initialized',
          });
          return;
        }

        await vadWeb.initVad();

        workerPort.postMessage({
          action: SHARED_WORKER_ACTION.INIT_VAD_SUCCESS,
          message: 'VAD initialized successfully',
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
