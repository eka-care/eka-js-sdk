import { TAudioChunksInfo, UploadProgressCallback } from '../constants/types';
import { AUDIO_EXTENSION_TYPE_MAP, OUTPUT_FORMAT } from '../constants/audio-constants';
import { utils } from '@ricky0123/vad-web';
import uploadFileToS3 from '../aws-services/upload-file-to-s3';
import { createFFmpeg } from '@ffmpeg/ffmpeg';

type UploadPromise = Promise<{ success?: string; error?: string }>;

class AudioFileManager {
  /**
   * Class that handles uploading audio files to S3
   * and downloading audio files for debugging
   */
  private txnID: string = '';
  private date: string = '';
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
    date,
    sessionId,
    filePath,
    businessID,
  }: {
    date: string;
    filePath: string;
    businessID: string;
    sessionId: string;
  }) {
    this.date = date;
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

  /**
   * Convert wav to m4a using ffmpeg
   */
  async convertWavToM4a(wavFile: ArrayBuffer): Promise<Blob> {
    const uint8buffer = new Uint8Array(wavFile);
    const ffmpeg = createFFmpeg({
      log: true,
      corePath: chrome.runtime.getURL('../ffmpeg/ffmpeg-core.js'),
    });

    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    // Write the WAV file to memory
    ffmpeg.FS('writeFile', 'input.wav', uint8buffer);

    // Run the conversion
    await ffmpeg.run('-i', 'input.wav', '-c:a', 'aac', '-b:a', '192k', 'output.m4a');

    // Read the result
    const data = ffmpeg.FS('readFile', 'output.m4a');

    // Create a Blob from the output
    const m4aBlob = new Blob([data.buffer], { type: 'audio/mp4' });

    return m4aBlob;
  }

  /**
   * Upload a chunk of audio data to S3
   */
  async uploadAudioChunk(
    audio: Float32Array,
    fileName: string,
    chunkIndex: number
  ): Promise<{
    success: boolean;
    fileName: string;
    audioBlob: Blob;
  }> {
    const s3FileName = `${this.filePath}/${fileName}`;
    // Generate WAV file
    const wavBuffer = utils.encodeWAV(audio);

    // const m4ablob = await this.convertWavToM4a(wavBuffer);
    // console.log('%c Line:150 🍷 m4ablob', 'color:#ed9ec7', m4ablob);
    // this.downloadAudio(m4ablob, fileName);
    const audioBlob = new Blob([wavBuffer], { type: AUDIO_EXTENSION_TYPE_MAP[OUTPUT_FORMAT] });

    if (this.onProgressCallback) {
      this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
    }

    // Push upload promise to track it
    const uploadPromise = uploadFileToS3({
      fileBlob: audioBlob,
      fileName: s3FileName,
      txnID: this.txnID,
      businessID: this.businessID,
    }).then((response) => {
      if (response.success) {
        const successFilename = fileName; // fileName is ${fileCount}.m4a
        this.successfulUploads.push(successFilename);

        // remove fileBlob if file uploaded successfully
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex].fileBlob = undefined;
        }

        if (this.onProgressCallback) {
          this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
        }
      } else {
        // store that fileBlob in audioChunks
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex].fileBlob = audioBlob;
        }
      }

      return response;
    });

    this.uploadPromises.push(uploadPromise);

    return {
      success: true,
      fileName: `${fileName}`,
      audioBlob,
    };
  }

  /**
   * Upload JSON data to S3 (som.json or eof.json)
   */
  async uploadJsonFile(
    jsonData: Record<string, unknown>,
    fileName: string,
    chunkIndex: number
  ): Promise<{ success: boolean; fileName: string }> {
    const s3FileName = `${this.filePath}/${fileName}`;
    const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: 'application/json',
    });

    if (fileName !== 'eof.json' && this.onProgressCallback) {
      this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
    }

    const uploadPromise = uploadFileToS3({
      fileBlob: jsonBlob,
      fileName: s3FileName,
      txnID: this.txnID,
      businessID: this.businessID,
    }).then((response) => {
      if (response.success) {
        // Extract base filename for tracking
        const parts = fileName.split('/');
        const baseFileName = parts[parts.length - 1];
        this.successfulUploads.push(baseFileName);

        // remove fileBlob if file uploaded successfully
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex].fileBlob = undefined;
        }

        if (fileName !== 'eof.json' && this.onProgressCallback) {
          this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
        }
      } else {
        // store that fileBlob in audioChunks
        if (chunkIndex !== -1) {
          this.audioChunks[chunkIndex].fileBlob = jsonBlob;
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
    await Promise.allSettled(this.uploadPromises);
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

    this.uploadPromises = []; // Reset upload promises for retries

    this.audioChunks.forEach((chunk) => {
      const { fileName, fileBlob } = chunk;
      if (fileBlob) {
        const uploadPromise = uploadFileToS3({
          fileBlob,
          fileName: `${this.filePath}/${fileName}`,
          txnID: this.txnID,
          businessID: this.businessID,
        }).then((response) => {
          if (response.success) {
            const successFilename = fileName;
            this.successfulUploads.push(successFilename);
            if (this.onProgressCallback) {
              this.onProgressCallback(this.successfulUploads, this.audioChunks.length);
            }
            // remove fileBlob if file uploaded successfully
            chunk.fileBlob = undefined;
          }
          return response;
        });

        this.uploadPromises.push(uploadPromise);
      }
    });

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
