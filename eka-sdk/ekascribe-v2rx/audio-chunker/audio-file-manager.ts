import { TAudioChunksInfo } from '../constants/types';
import { AUDIO_EXTENSION_TYPE_MAP, OUTPUT_FORMAT } from '../constants/constant';
import postCogInit from '../api/post-cog-init';
import { configureAWS } from '../aws-services/configure-aws';
import { CALLBACK_TYPE, SHARED_WORKER_ACTION } from '../constants/enums';
import compressAudioToMp3 from '../utils/compress-mp3-audio';
import EkaScribeStore from '../store/store';
import { GET_S3_BUCKET_NAME } from '../fetch-client/helper';
import { getSharedWorkerUrl } from '../utils/get-worker-url';
import pushFilesToS3V2 from '../aws-services/upload-file-to-s3-v2';

type UploadPromise = Promise<{ success?: string; error?: string }>;

type TUploadAudioChunkParams = {
  audioFrames: Float32Array;
  fileName: string;
  chunkIndex: number;
};
class AudioFileManager {
  /**
   * Class that handles uploading audio files to S3
   * and downloading audio files for debugging
   */
  private txnID: string = '';
  private filePath: string = '';
  public audioChunks: TAudioChunksInfo[] = [];
  private uploadPromises: UploadPromise[] = [];
  private successfulUploads: string[] = [];
  private totalRawSamples: number = 0;
  private totalRawFrames: number = 0;
  private totalInsertedSamples: number = 0;
  private totalInsertedFrames: number = 0;
  private businessID: string = '';
  private isAWSConfigured: boolean = false;
  private sharedWorkerInstance: SharedWorker | null = null;

  initialiseClassInstance() {
    this.audioChunks = [];
    this.uploadPromises = [];
    this.successfulUploads = [];
    this.totalInsertedFrames = 0;
    this.totalInsertedSamples = 0;
    this.totalRawSamples = 0;
    this.totalRawFrames = 0;
  }

  constructor() {
    this.initialiseClassInstance();
  }

  /**
   * Set basic file information
   */
  setSessionInfo({
    sessionId,
    filePath,
    businessID,
  }: {
    filePath: string;
    businessID: string;
    sessionId: string;
  }) {
    this.txnID = sessionId;
    this.filePath = filePath;
    this.businessID = businessID;
  }

  getRawSampleDetails(): {
    totalRawSamples: number;
    totalRawFrames: number;
  } {
    return {
      totalRawSamples: this.totalRawSamples,
      totalRawFrames: this.totalRawFrames,
    };
  }

  incrementTotalRawSamples(frames: Float32Array): void {
    this.totalRawSamples += frames.length;
    this.totalRawFrames += 1;
  }

  incrementInsertedSamples(samples: number, frames: number): void {
    this.totalInsertedSamples += samples;
    this.totalInsertedFrames += frames;
  }

  getInsertedSampleDetails(): {
    totalInsertedSamples: number;
    totalInsertedFrames: number;
  } {
    return {
      totalInsertedSamples: this.totalInsertedSamples,
      totalInsertedFrames: this.totalInsertedFrames,
    };
  }

  /**
   * Update audio information array, this will update the audio chunks info
   * (+ the latest chunk , affects the length of chunks data struct)
   */
  updateAudioInfo(audioChunks: TAudioChunksInfo): number {
    this.audioChunks.push(audioChunks);
    return this.audioChunks.length;
  }

  createSharedWorkerInstance() {
    try {
      // new URL(relativeOrAbsolutePath, baseUrl)
      // const worker = new SharedWorker(
      //   'https://unpkg.com/@eka-care/ekascribe-ts-sdk@1.5.80/dist/shared-worker/s3-file-upload.js'
      // );

      const workerUrl = getSharedWorkerUrl();

      const worker = new SharedWorker(workerUrl);

      this.sharedWorkerInstance = worker;

      const onEventCallback = EkaScribeStore.eventCallback;

      this.sharedWorkerInstance.port.onmessage = async (event: MessageEvent) => {
        const workerResponse = event.data;

        switch (workerResponse.action) {
          case SHARED_WORKER_ACTION.CONFIGURE_AWS_SUCCESS: {
            if (onEventCallback) {
              onEventCallback({
                callback_type: CALLBACK_TYPE.AWS_CONFIGURE_STATUS,
                status: 'success',
                message: workerResponse.message,
                timestamp: new Date().toISOString(),
              });
            }
            return;
          }

          case SHARED_WORKER_ACTION.CONFIGURE_AWS_ERROR: {
            if (onEventCallback) {
              onEventCallback({
                callback_type: CALLBACK_TYPE.AWS_CONFIGURE_STATUS,
                status: 'error',
                message: workerResponse.message,
                timestamp: new Date().toISOString(),
              });
            }
            return;
          }

          case SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS: {
            const {
              fileCount: fileName,
              chunkIndex,
              fileBlob,
              compressedAudioBuffer,
            } = workerResponse.requestBody;

            if (onEventCallback && compressedAudioBuffer) {
              onEventCallback({
                callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
                status: 'info',
                message: 'Audioframes of chunk to store in IDB',
                timestamp: new Date().toISOString(),
                data: {
                  success: this.successfulUploads.length,
                  total: this.audioChunks.length,
                  fileName,
                  chunkData: compressedAudioBuffer,
                },
              });
            }

            if (workerResponse.response.success) {
              this.successfulUploads.push(fileName);

              // remove audioFrames if file uploaded successfully
              if (chunkIndex !== -1) {
                this.audioChunks[chunkIndex] = {
                  ...this.audioChunks[chunkIndex],
                  audioFrames: undefined,
                  fileBlob: undefined,
                  status: 'success',
                  response: workerResponse.response.success,
                };
              }

              if (onEventCallback) {
                onEventCallback({
                  callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
                  status: 'success',
                  message: workerResponse.response.success,
                  timestamp: new Date().toISOString(),
                  data: {
                    success: this.successfulUploads.length,
                    total: this.audioChunks.length,
                    is_uploaded: true,
                  },
                });
              }
            } else {
              if (onEventCallback) {
                onEventCallback({
                  callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
                  status: 'error',
                  message: workerResponse.response.error || 'Upload failed',
                  timestamp: new Date().toISOString(),
                  error: {
                    code: workerResponse.response.code,
                    msg: workerResponse.response.error,
                    details: workerResponse.response.errorCode,
                  },
                  data: {
                    fileName,
                    is_uploaded: false,
                  },
                });
              }

              // store that audioFrames in audioChunks
              if (chunkIndex !== -1) {
                this.audioChunks[chunkIndex] = {
                  ...this.audioChunks[chunkIndex],
                  fileBlob,
                  audioFrames: undefined,
                  status: 'failure',
                  response: workerResponse.response.error || 'Upload failed',
                };
              }

              // call COG if S3 throws ExpiredToken error
              if (workerResponse.response.errorCode === 'ExpiredToken') {
                this.setupAWSConfiguration({
                  is_shared_worker: true,
                });
              }
            }
          }
        }
      };

      worker.port.start();

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('SecurityError') || errorMessage.includes('Failed to construct')) {
        console.error(
          'Error creating shared worker instance: CORS/Same-origin policy violation. ' +
            'The SharedWorker script must be served from the same origin as your application, ' +
            'or the server must allow cross-origin access with proper CORS headers. ' +
            'Falling back to non-worker upload method.',
          error
        );
      } else {
        console.error('Error creating shared worker instance:', error);
      }
      return false;
    }
  }

  private async setupAWSConfiguration({ is_shared_worker }: { is_shared_worker: boolean }) {
    try {
      const response = await postCogInit();
      const { credentials, is_session_expired } = response;
      if (is_session_expired || !credentials) {
        this.isAWSConfigured = false;
        return false;
      }

      const { AccessKeyId, SecretKey, SessionToken } = credentials;

      if (is_shared_worker) {
        this.sharedWorkerInstance?.port.postMessage({
          action: SHARED_WORKER_ACTION.CONFIGURE_AWS,
          payload: {
            accessKeyId: AccessKeyId,
            secretKey: SecretKey,
            sessionToken: SessionToken,
          },
        });
      } else {
        // Configure AWS credentials once in the main thread.
        // - Legacy paths (AWS SDK) read from AWS.config
        // - aws4-based uploads (`pushFilesToS3V2`) read from the shared credential store
        configureAWS({
          accessKeyId: AccessKeyId,
          secretKey: SecretKey,
          sessionToken: SessionToken,
        });
      }

      this.isAWSConfigured = true;

      return credentials;
    } catch (error) {
      console.log('%c Line:198 🥃 error', 'color:#42b983', error);

      this.isAWSConfigured = false;
      return false;
    }
  }

  /**
   * Upload a chunk of audio data to S3 in main thread
   */
  private async uploadAudioChunkInMain({
    audioFrames,
    fileName,
    chunkIndex,
  }: TUploadAudioChunkParams): Promise<{
    success: boolean;
    fileName: string;
  }> {
    const s3FileName = `${this.filePath}/${fileName}`; // fileName is ${fileCount}.mp3

    const compressedAudioBuffer = compressAudioToMp3(audioFrames);

    const audioBlob = new Blob(compressedAudioBuffer as BlobPart[], {
      type: AUDIO_EXTENSION_TYPE_MAP[OUTPUT_FORMAT],
    });

    const onEventCallback = EkaScribeStore.eventCallback;

    if (onEventCallback) {
      onEventCallback({
        callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
        status: 'info',
        message:
          'Audio chunks count to display success/total file count and to store chunks in IDB',
        timestamp: new Date().toISOString(),
        data: {
          success: this.successfulUploads.length,
          total: this.audioChunks.length,
          fileName,
          chunkData: compressedAudioBuffer,
        },
      });
    }

    const s3BucketName = GET_S3_BUCKET_NAME();
    // Push upload promise to track status
    const uploadPromise = pushFilesToS3V2({
      s3BucketName,
      fileBlob: audioBlob,
      fileName: s3FileName,
      txnID: this.txnID,
      businessID: this.businessID,
      is_shared_worker: false,
    }).then((response) => {
      // callback
      if (response.success) {
        this.successfulUploads.push(fileName);

        // update file status if file uploaded successfully
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex] = {
            ...this.audioChunks[chunkIndex],
            audioFrames: undefined,
            fileBlob: undefined,
            status: 'success',
            response: response.success,
          };
        }

        if (onEventCallback) {
          onEventCallback({
            callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
            status: 'success',
            message: response.success,
            timestamp: new Date().toISOString(),
            data: {
              success: this.successfulUploads.length,
              total: this.audioChunks.length,
              is_uploaded: true,
            },
          });
        }
      } else {
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex] = {
            ...this.audioChunks[chunkIndex],
            fileBlob: audioBlob,
            audioFrames: undefined,
            status: 'failure',
            response: response.error || 'Upload failed',
          };
        }

        if (onEventCallback) {
          onEventCallback({
            callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
            status: 'error',
            message: response.error || 'Upload failed',
            timestamp: new Date().toISOString(),
            error: {
              code: response.code || 500,
              msg: response.error || 'Upload failed',
              details: response.errorCode,
            },
            data: {
              fileName,
              is_uploaded: false,
            },
          });
        }
      }

      return response;
    });

    this.uploadPromises.push(uploadPromise);

    return {
      success: true,
      fileName,
    };
  }

  /**
   * Upload audio chunks to S3 in shared worker
   */
  // private async uploadAudioChunkInWorker({
  //   audioFrames,
  //   fileName,
  //   chunkIndex,
  // }: TUploadAudioChunkParams): Promise<{
  //   success: boolean;
  //   fileName: string;
  // }> {
  //   const s3FileName = `${this.filePath}/${fileName}`;
  //   const onEventCallback = EkaScribeStore.eventCallback;

  //   if (onEventCallback) {
  //     onEventCallback({
  //       callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
  //       status: 'info',
  //       message: 'Audio chunks count to display success/total file count',
  //       timestamp: new Date().toISOString(),
  //       data: {
  //         success: this.successfulUploads.length,
  //         total: this.audioChunks.length,
  //       },
  //     });
  //   }

  //   const s3BucketName = GET_S3_BUCKET_NAME();

  //   this.sharedWorkerInstance?.port.postMessage({
  //     action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
  //     payload: {
  //       s3BucketName,
  //       audioFrames,
  //       fileName: s3FileName,
  //       txnID: this.txnID,
  //       businessID: this.businessID,
  //       chunkIndex,
  //       fileCount: fileName,
  //     },
  //   });

  //   return {
  //     success: true,
  //     fileName,
  //   };
  // }

  async uploadAudioToS3({ audioFrames, fileName, chunkIndex }: TUploadAudioChunkParams) {
    // if (typeof SharedWorker === 'undefined' || !SharedWorker) {
    //   // Shared Workers are not supported in this browser
    //   console.log('Shared Workers are NOT supported in this browser.');

    //   await this.uploadAudioToS3WithoutWorker({ audioFrames, fileName, chunkIndex });
    // } else {
    //   // Shared Workers are supported
    //   console.log('Shared Workers are supported in this browser.');

    //   if (!this.sharedWorkerInstance) {
    //     const workerCreated = this.createSharedWorkerInstance();
    //     if (!workerCreated) {
    //       // SharedWorker creation failed (likely due to CORS/same-origin policy)
    //       // Fall back to non-worker upload
    //       console.warn(
    //         'Failed to create SharedWorker instance. Falling back to non-worker upload method.'
    //       );
    //       await this.uploadAudioToS3WithoutWorker({ audioFrames, fileName, chunkIndex });
    //       return;
    //     }
    //   }

    //   await this.uploadAudioToS3WithWorker({ audioFrames, fileName, chunkIndex });
    // }

    await this.uploadAudioToS3WithoutWorker({ audioFrames, fileName, chunkIndex });
  }

  // private async uploadAudioToS3WithWorker({
  //   audioFrames,
  //   fileName,
  //   chunkIndex,
  // }: TUploadAudioChunkParams) {
  //   try {
  //     if (!this.isAWSConfigured) {
  //       const awsConfigResponse = await this.setupAWSConfiguration({
  //         is_shared_worker: true,
  //       });

  //       if (!awsConfigResponse) {
  //         throw new Error('Failed to configure AWS');
  //       }
  //     }

  //     await this.uploadAudioChunkInWorker({ audioFrames, fileName, chunkIndex });
  //   } catch (error) {
  //     console.error('Error uploading audio to S3: uploadAudioToS3WithWorker: ', error);
  //     // Fall back to non-worker upload if worker fails
  //     await this.uploadAudioToS3WithoutWorker({ audioFrames, fileName, chunkIndex });
  //   }
  // }

  private async uploadAudioToS3WithoutWorker({
    audioFrames,
    fileName,
    chunkIndex,
  }: TUploadAudioChunkParams) {
    try {
      if (!this.isAWSConfigured) {
        const awsConfigResponse = await this.setupAWSConfiguration({
          is_shared_worker: false,
        });

        if (!awsConfigResponse) {
          throw new Error('Failed to configure AWS');
        }
      }

      await this.uploadAudioChunkInMain({ audioFrames, fileName, chunkIndex });
    } catch (error) {
      console.error('Error uploading audio to S3:', error);
    }
  }

  /**
   * Download audio as a file to the user's device (for debugging)
   */
  downloadAudio(audioBlob: Blob, fileName: string): void {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * Wait for all upload promises to complete
   */
  async waitForAllUploads(): Promise<void> {
    if (this.sharedWorkerInstance) {
      return new Promise((resolve, reject) => {
        // one-time message handler to listen for the response
        const messageHandler = (event: MessageEvent) => {
          if (event.data.action === SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS_SUCCESS) {
            this.sharedWorkerInstance?.port.removeEventListener('message', messageHandler);
            resolve();
          } else if (event.data.action === SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS_ERROR) {
            const { uploadRequestReceived } = event.data.response || {};

            if (uploadRequestReceived === 0) {
              this.sharedWorkerInstance?.port.removeEventListener('message', messageHandler);
              reject();
            }

            this.sharedWorkerInstance?.port.postMessage({
              action: SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS,
            });
          }
        };

        // one-time listener
        this.sharedWorkerInstance?.port.addEventListener('message', messageHandler);

        this.sharedWorkerInstance?.port.postMessage({
          action: SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS,
        });
      });
    } else {
      await Promise.allSettled(this.uploadPromises);
    }
  }

  /**
   * Get list of successfully uploaded files
   */
  getSuccessfulUploads(): string[] {
    return [...this.successfulUploads];
  }

  /**
   * Get list of all failed files
   */
  getFailedUploads(): string[] {
    const failedUploads: string[] = [];
    this.audioChunks.forEach((chunk) => {
      if (chunk.status != 'success') {
        failedUploads.push(chunk.fileName);
      }
    });
    return failedUploads;
  }

  /**
   * Get list of all audio chunks
   */
  getTotalAudioChunks(): TAudioChunksInfo[] {
    return this.audioChunks;
  }

  /**
   * Retry uploading failed files
   */
  async retryFailedUploads(): Promise<string[]> {
    const failedFiles = this.getFailedUploads();
    if (failedFiles.length === 0) {
      return [];
    }

    const onEventCallback = EkaScribeStore.eventCallback;
    const s3BucketName = GET_S3_BUCKET_NAME();

    if (this.sharedWorkerInstance) {
      this.audioChunks.forEach((chunk, index) => {
        const { fileName, fileBlob, status, audioFrames } = chunk;
        if (status != 'success') {
          // callback
          this.sharedWorkerInstance?.port.postMessage({
            action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
            payload: {
              s3BucketName,
              audioFrames,
              fileBlob,
              fileName: `${this.filePath}/${fileName}`,
              txnID: this.txnID,
              businessID: this.businessID,
              chunkIndex: index,
              fileCount: fileName,
            },
          });
        }
      });
    } else {
      this.uploadPromises = []; // Reset upload promises for retries

      if (onEventCallback) {
        onEventCallback({
          callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
          status: 'info',
          message: 'Audio chunks count to display success/total file count',
          timestamp: new Date().toISOString(),
          data: {
            success: this.successfulUploads.length,
            total: this.audioChunks.length,
          },
        });
      }

      const s3BucketName = GET_S3_BUCKET_NAME();

      this.audioChunks.forEach((chunk, index) => {
        const { fileName, fileBlob, status, audioFrames } = chunk;

        if (status != 'success') {
          // callback
          let failedFileBlob: Blob | undefined;

          if (status === 'failure') {
            failedFileBlob = fileBlob;
          }

          if (status === 'pending') {
            const compressedAudioBuffer = compressAudioToMp3(audioFrames);

            failedFileBlob = new Blob(compressedAudioBuffer as BlobPart[], {
              type: AUDIO_EXTENSION_TYPE_MAP[OUTPUT_FORMAT],
            });
          }

          if (failedFileBlob) {
            const uploadPromise = pushFilesToS3V2({
              s3BucketName,
              fileBlob: failedFileBlob,
              fileName: `${this.filePath}/${fileName}`,
              txnID: this.txnID,
              businessID: this.businessID,
              is_shared_worker: false,
            }).then((response) => {
              if (response.success) {
                this.successfulUploads.push(fileName);

                if (onEventCallback) {
                  onEventCallback({
                    callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
                    status: 'info',
                    message: 'Audio chunks count to display success/total file count',
                    timestamp: new Date().toISOString(),
                    data: {
                      success: this.successfulUploads.length,
                      total: this.audioChunks.length,
                    },
                  });
                }

                this.audioChunks[index] = {
                  ...this.audioChunks[index],
                  audioFrames: undefined,
                  fileBlob: undefined,
                  status: 'success',
                  response: response.success,
                };
              }

              return response;
            });

            this.uploadPromises.push(uploadPromise);
          }
        }
      });
    }

    // Wait for all retry promises to complete
    await this.waitForAllUploads();

    return this.getFailedUploads();
  }

  /**
   * Reset the upload state
   */
  resetFileManagerInstance(): void {
    // Cancel all pending uploads
    this.uploadPromises.forEach((promise) => {
      // Note: Promises can't be cancelled, but we can ignore their results
      promise.catch(() => {}); // Prevent unhandled rejections
    });

    // Terminate SharedWorker
    if (this.sharedWorkerInstance) {
      this.sharedWorkerInstance.port.close();
      this.sharedWorkerInstance = null;
    }

    // Clear all state
    this.initialiseClassInstance();

    // Reset additional properties not covered by initialiseClassInstance
    this.txnID = '';
    this.filePath = '';
    this.businessID = '';
    this.isAWSConfigured = false;
  }
}

export default AudioFileManager;
