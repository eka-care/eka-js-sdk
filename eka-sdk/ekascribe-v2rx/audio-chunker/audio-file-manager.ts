import { TAudioChunksInfo, UploadProgressCallback } from '../constants/types';
import { AUDIO_EXTENSION_TYPE_MAP, OUTPUT_FORMAT } from '../constants/audio-constants';
import pushFileToS3 from '../aws-services/upload-file-to-s3';
import postCogInit from '../api/post-cog-init';
import { configureAWS } from '../aws-services/configure-aws';
import { SHARED_WORKER_ACTION } from '../constants/enums';
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
  private onProgressCallback?: UploadProgressCallback;
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
   * Set callback for upload progress updates
   */
  setProgressCallback(callback: UploadProgressCallback): void {
    this.onProgressCallback = callback;
  }

  /**
   * Update audio information array, this will update the audio chunks info
   * (+ the latest chunk , affects the length of chunks data struct)
   */
  updateAudioInfo(audioChunks: TAudioChunksInfo): number {
    this.audioChunks.push(audioChunks);
    return this.audioChunks.length;
  }

  createSharedWorkerInstance(): {
    success: boolean;
  } {
    try {
      const worker = new SharedWorker(new URL('../shared-worker/s3-file-upload.ts'));

      this.sharedWorkerInstance = worker;

      this.sharedWorkerInstance.port.onmessage = async (event: MessageEvent) => {
        const workerResponse = event.data;

        switch (workerResponse.action) {
          case SHARED_WORKER_ACTION.CONFIGURE_AWS_SUCCESS: {
            console.log('AWS configured successfully in worker');
            return;
          }

          case SHARED_WORKER_ACTION.CONFIGURE_AWS_ERROR: {
            console.error('Error configuring AWS in worker:', workerResponse.error);
            return;
          }

          case SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS: {
            const { fileCount: fileName, chunkIndex, fileBlob } = workerResponse.requestBody;

            if (workerResponse.response.success) {
              this.successfulUploads.push(fileName);

              // remove audioFrames if file uploaded successfully
              if (chunkIndex !== -1) {
                this.audioChunks[chunkIndex] = {
                  ...this.audioChunks[chunkIndex],
                  fileBlob: undefined,
                  status: 'success',
                  response: workerResponse.response.success,
                };
              }

              if (this.onProgressCallback) {
                this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
              }
            } else {
              // store that audioFrames in audioChunks
              if (chunkIndex !== -1) {
                this.audioChunks[chunkIndex] = {
                  ...this.audioChunks[chunkIndex],
                  fileBlob,
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

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error creating shared worker instance:', error);
      return {
        success: false,
      };
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
        configureAWS({
          accessKeyId: AccessKeyId,
          secretKey: SecretKey,
          sessionToken: SessionToken,
        });
      }

      this.isAWSConfigured = true;

      return true;
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

    const audioBlob = new Blob(compressedAudioBuffer, {
      type: AUDIO_EXTENSION_TYPE_MAP[OUTPUT_FORMAT],
    });

    if (this.onProgressCallback) {
      this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
    }

    // Push upload promise to track status
    const uploadPromise = pushFileToS3({
      fileBlob: audioBlob,
      fileName: s3FileName,
      txnID: this.txnID,
      businessID: this.businessID,
      is_shared_worker: false,
    }).then((response) => {
      if (response.success) {
        this.successfulUploads.push(fileName);

        // update file status if file uploaded successfully
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex] = {
            ...this.audioChunks[chunkIndex],
            fileBlob: undefined,
            status: 'success',
            response: response.success,
          };
        }

        if (this.onProgressCallback) {
          this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
        }
      } else {
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex] = {
            ...this.audioChunks[chunkIndex],
            fileBlob: audioBlob,
            status: 'failure',
            response: response.error || 'Upload failed',
          };
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
  private async uploadAudioChunkInWorker({
    audioFrames,
    fileName,
    chunkIndex,
  }: TUploadAudioChunkParams): Promise<{
    success: boolean;
    fileName: string;
  }> {
    const s3FileName = `${this.filePath}/${fileName}`;

    if (this.onProgressCallback) {
      this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
    }

    this.sharedWorkerInstance?.port.postMessage({
      action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
      payload: {
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
    if (typeof SharedWorker === 'undefined' || !SharedWorker) {
      // Shared Workers are not supported in this browser
      this.uploadAudioToS3WithoutWorker({ audioFrames, fileName, chunkIndex });
    } else {
      // Shared Workers are supported
      console.log('Shared Workers are NOT supported in this browser.');

      if (!this.sharedWorkerInstance) {
        this.createSharedWorkerInstance();
      }

      this.uploadAudioToS3WithWorker({ audioFrames, fileName, chunkIndex });
    }
  }

  private async uploadAudioToS3WithWorker({
    audioFrames,
    fileName,
    chunkIndex,
  }: TUploadAudioChunkParams) {
    try {
      if (!this.isAWSConfigured) {
        const awsConfigResponse = await this.setupAWSConfiguration({
          is_shared_worker: true,
        });

        if (!awsConfigResponse) {
          throw new Error('Failed to configure AWS');
        }
      }

      await this.uploadAudioChunkInWorker({ audioFrames, fileName, chunkIndex });
    } catch (error) {
      console.error('Error uploading audio to S3:', error);
    }
  }

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
      if (chunk.fileBlob) {
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

    if (this.sharedWorkerInstance) {
      this.audioChunks.forEach((chunk, index) => {
        const { fileName, fileBlob } = chunk;
        if (fileBlob) {
          this.sharedWorkerInstance?.port.postMessage({
            action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
            payload: {
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

      this.audioChunks.forEach((chunk) => {
        const { fileName, fileBlob } = chunk;
        if (fileBlob) {
          const uploadPromise = pushFileToS3({
            fileBlob,
            fileName: `${this.filePath}/${fileName}`,
            txnID: this.txnID,
            businessID: this.businessID,
            is_shared_worker: false,
          }).then((response) => {
            if (response.success) {
              this.successfulUploads.push(fileName);

              if (this.onProgressCallback) {
                this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
              }

              // Update audio chunk upload status
              chunk.fileBlob = undefined;
              chunk.status = 'success';
              chunk.response = response.success;
            }

            return response;
          });

          this.uploadPromises.push(uploadPromise);
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
    this.initialiseClassInstance();
  }
}

export default AudioFileManager;
