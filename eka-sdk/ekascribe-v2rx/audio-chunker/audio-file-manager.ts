import postCogInit from '../api/post-cog-init';
import { uploadFileToS3 } from '../aws-services/s3-upload-service';
import { AUDIO_EXTENSION_TYPE_MAP, OUTPUT_FORMAT } from '../constants/constant';
import { CALLBACK_TYPE, SHARED_WORKER_ACTION } from '../constants/enums';
import { TAudioChunksInfo } from '../constants/types';
import { GET_S3_BUCKET_NAME } from '../fetch-client/helper';
import EkaScribeStore from '../store/store';
import compressAudioToMp3 from '../utils/compress-mp3-audio';

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
  private sharedWorkerInstance: SharedWorker | null = null;
  private waitAbortController: AbortController | null = null;

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

  createSharedWorkerInstance(sharedWorkerUrl: string) {
    try {
      const worker = new SharedWorker(sharedWorkerUrl);

      this.sharedWorkerInstance = worker;

      this.sharedWorkerInstance.port.onmessage = async (event: MessageEvent) => {
        const workerResponse = event.data;
        const onEventCallback = EkaScribeStore.eventCallback;

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

          case SHARED_WORKER_ACTION.REQUEST_TOKEN_REFRESH: {
            // Worker requested token refresh - call cog API and send back credentials
            console.log('[AudioFileManager] Worker requested token refresh');
            try {
              const response = await postCogInit();
              const { credentials, is_session_expired } = response;

              if (is_session_expired || !credentials) {
                this.sharedWorkerInstance?.port.postMessage({
                  action: SHARED_WORKER_ACTION.TOKEN_REFRESH_ERROR,
                  error: 'Session expired or no credentials',
                });
                return;
              }

              const { AccessKeyId, SecretKey, SessionToken } = credentials;

              // Send refreshed credentials to worker
              this.sharedWorkerInstance?.port.postMessage({
                action: SHARED_WORKER_ACTION.TOKEN_REFRESH_SUCCESS,
                payload: {
                  accessKeyId: AccessKeyId,
                  secretKey: SecretKey,
                  sessionToken: SessionToken,
                },
              });

              console.log('[AudioFileManager] Token refresh successful, sent to worker');
            } catch (error) {
              console.error('[AudioFileManager] Token refresh failed:', error);
              this.sharedWorkerInstance?.port.postMessage({
                action: SHARED_WORKER_ACTION.TOKEN_REFRESH_ERROR,
                error: error instanceof Error ? error.message : 'Token refresh failed',
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
              if (!this.successfulUploads.includes(fileName)) {
                this.successfulUploads.push(fileName);
              }

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

  terminateSharedWorkerInstance() {
    if (this.sharedWorkerInstance) {
      this.sharedWorkerInstance.port.close();
      this.sharedWorkerInstance = null;
    }
  }

  /**
   * Upload a chunk of audio data to S3 in main thread.
   * Credentials are handled automatically by the S3UploadService.
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

    // S3UploadService handles credentials automatically - no pre-check needed
    const uploadPromise = uploadFileToS3({
      s3BucketName,
      fileBlob: audioBlob,
      fileName: s3FileName,
      txnID: this.txnID,
      businessID: this.businessID,
    }).then((response) => {
      if (response.success) {
        if (!this.successfulUploads.includes(fileName)) {
          this.successfulUploads.push(fileName);
        }

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
   * Upload audio chunks to S3 in shared worker.
   * Credentials are handled automatically by the worker's S3UploadService.
   */
  private async uploadAudioChunkInWorker({
    audioFrames,
    fileName,
    chunkIndex,
  }: TUploadAudioChunkParams): Promise<{
    success: boolean;
    fileName: string;
  }> {
    const s3FileName = `${this.filePath}/${fileName}`;
    const onEventCallback = EkaScribeStore.eventCallback;

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

    // Worker handles credentials automatically via REQUEST_TOKEN_REFRESH message
    this.sharedWorkerInstance?.port.postMessage({
      action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
      payload: {
        s3BucketName,
        audioFrames,
        fileName: s3FileName,
        txnID: this.txnID,
        businessID: this.businessID,
        chunkIndex,
        fileCount: fileName,
      },
    });

    return {
      success: true,
      fileName,
    };
  }

  async uploadAudioToS3({ audioFrames, fileName, chunkIndex }: TUploadAudioChunkParams) {
    if (typeof SharedWorker === 'undefined' || !SharedWorker || !this.sharedWorkerInstance) {
      // Shared Workers are not supported or not initialized
      console.log('Using main thread for upload (SharedWorker not available)');
      await this.uploadAudioChunkInMain({ audioFrames, fileName, chunkIndex });
    } else {
      // Use SharedWorker for upload
      console.log('Using SharedWorker for upload');
      await this.uploadAudioChunkInWorker({ audioFrames, fileName, chunkIndex });
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
   * @param timeoutMs - Maximum time to wait in milliseconds (default: 30 seconds)
   * @param pollIntervalMs - Interval between polls in milliseconds (default: 500ms)
   */
  async waitForAllUploads(timeoutMs: number = 10000, pollIntervalMs: number = 500): Promise<void> {
    if (this.sharedWorkerInstance) {
      // Abort any previous waitForAllUploads listeners to prevent accumulation
      this.waitAbortController?.abort();
      this.waitAbortController = new AbortController();
      const { signal } = this.waitAbortController;

      return new Promise((resolve) => {
        let timeoutId: ReturnType<typeof setTimeout>;
        let pollTimeoutId: ReturnType<typeof setTimeout>;
        let resolved = false;
        let currentInterval = pollIntervalMs;

        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          clearTimeout(pollTimeoutId);
          this.waitAbortController?.abort();
          this.waitAbortController = null;
        };

        // Overall timeout - resolve even if not all uploads complete
        timeoutId = setTimeout(() => {
          console.warn(
            `[AudioFileManager] waitForAllUploads timed out after ${timeoutMs}ms. ` +
              `Completed: ${this.successfulUploads.length}/${this.audioChunks.length}`
          );
          cleanup();
          resolve(); // Resolve instead of reject to allow flow to continue
        }, timeoutMs);

        const messageHandler = (event: MessageEvent) => {
          if (resolved) return;
          if (event.data.action === SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS_SUCCESS) {
            cleanup();
            resolve();
          } else if (event.data.action === SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS_ERROR) {
            const { uploadRequestReceived } = event.data.response || {};

            if (uploadRequestReceived === 0) {
              cleanup();
              resolve(); // No uploads were requested, resolve successfully
              return;
            }

            // Poll again with exponential backoff (500ms → 750ms → 1125ms → ... capped at 3s)
            pollTimeoutId = setTimeout(() => {
              if (!resolved) {
                this.sharedWorkerInstance?.port.postMessage({
                  action: SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS,
                });
              }
            }, currentInterval);
            currentInterval = Math.min(currentInterval * 1.5, 3000);
          }
        };

        this.sharedWorkerInstance?.port.addEventListener('message', messageHandler, { signal });

        // Initial poll
        this.sharedWorkerInstance?.port.postMessage({
          action: SHARED_WORKER_ACTION.WAIT_FOR_ALL_UPLOADS,
        });
      });
    } else {
      // For main thread, use Promise.race with timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn(
            `[AudioFileManager] waitForAllUploads timed out after ${timeoutMs}ms. ` +
              `Completed: ${this.successfulUploads.length}/${this.audioChunks.length}`
          );
          resolve();
        }, timeoutMs);
      });

      await Promise.race([Promise.allSettled(this.uploadPromises), timeoutPromise]);
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
   * Retry uploading failed files.
   * Returns list of files that still failed after retry.
   * Credentials are handled automatically by the S3UploadService.
   */
  async retryFailedUploads(): Promise<string[]> {
    const failedFiles = this.getFailedUploads();
    if (failedFiles.length === 0) {
      return [];
    }

    const onEventCallback = EkaScribeStore.eventCallback;
    const s3BucketName = GET_S3_BUCKET_NAME();

    if (onEventCallback) {
      onEventCallback({
        callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
        status: 'info',
        message: 'Retrying failed uploads',
        timestamp: new Date().toISOString(),
        data: {
          success: this.successfulUploads.length,
          total: this.audioChunks.length,
        },
      });
    }

    if (this.sharedWorkerInstance) {
      // Reset worker counters so waitForAllUploads only tracks retry uploads
      this.sharedWorkerInstance.port.postMessage({
        action: SHARED_WORKER_ACTION.RESET_UPLOAD_COUNTERS,
      });

      // Worker handles credentials automatically via REQUEST_TOKEN_REFRESH
      this.audioChunks.forEach((chunk, index) => {
        const { fileName, fileBlob, status, audioFrames } = chunk;
        if (status != 'success') {
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

      // S3UploadService handles credentials automatically - no pre-check needed
      this.audioChunks.forEach((chunk, index) => {
        const { fileName, fileBlob, status, audioFrames } = chunk;

        if (status != 'success') {
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
            const uploadPromise = uploadFileToS3({
              s3BucketName,
              fileBlob: failedFileBlob,
              fileName: `${this.filePath}/${fileName}`,
              txnID: this.txnID,
              businessID: this.businessID,
            }).then((response) => {
              if (response.success) {
                if (!this.successfulUploads.includes(fileName)) {
                  this.successfulUploads.push(fileName);
                }

                if (onEventCallback) {
                  onEventCallback({
                    callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
                    status: 'success',
                    message: 'File uploaded successfully',
                    timestamp: new Date().toISOString(),
                    data: {
                      success: this.successfulUploads.length,
                      total: this.audioChunks.length,
                      fileName,
                      is_uploaded: true,
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
              } else {
                // Upload failed - update chunk status
                if (onEventCallback) {
                  onEventCallback({
                    callback_type: CALLBACK_TYPE.FILE_UPLOAD_STATUS,
                    status: 'error',
                    message: response.error || 'Upload failed',
                    timestamp: new Date().toISOString(),
                    error: {
                      code: response.code || 500,
                      msg: response.error || 'Upload failed',
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
  }
}

export default AudioFileManager;
