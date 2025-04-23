import { v4 as uuidv4 } from 'uuid';
import { TAudioChunksInfo, UploadProgressCallback } from '../constants/types';
import {
  AUDIO_EXTENSION_TYPE_MAP,
  OUTPUT_FORMAT,
  S3_BUCKET_NAME,
} from '../constants/audio-constants';
import { utils } from '@ricky0123/vad-web';
import EkaScribeStore from '../store/store';
import uploadFileToS3 from '../aws-services/upload-file-to-s3';
import { createFFmpeg } from '@ffmpeg/ffmpeg';

type UploadPromise = Promise<{ success?: string; error?: string }>;

class AudioFileManager {
  /**
   * Class that handles uploading audio files to S3
   * and downloading audio files for debugging
   */
  private txnID: string;
  private date: string;
  private filePath: string;
  public audioChunks: TAudioChunksInfo[];
  private uploadPromises: UploadPromise[];
  private successfulUploads: string[];
  private onProgressCallback?: UploadProgressCallback;
  private totalRawSamples = 0;
  private totalRawFrames = 0;
  private totalInsertedSamples = 0;
  private totalInsertedFrames = 0;

  constructor() {
    this.txnID = 'ce-' + uuidv4();
    EkaScribeStore.txnID = this.txnID;
    // File path calculation
    const currDate = new Date();
    this.date = currDate.toISOString();
    EkaScribeStore.date = this.date;
    // Format date to YYYYMMDD
    const day = currDate.getDate().toString().padStart(2, '0');
    const month = (currDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currDate.getFullYear().toString().substring(2);
    // s3 file path format: <date>/txnID
    this.filePath = `${year}${month}${day}/${this.txnID}`;
    EkaScribeStore.s3FilePath = this.filePath;
    this.audioChunks = [];
    this.uploadPromises = [];
    this.successfulUploads = [];
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
   * Upload Som.json to s3
   */
  async uploadSomToS3() {
    const cookies = await chrome.cookies.getAll({ domain: '.eka.care' });
    const sessToken = cookies.find((cookie) => cookie.name === 'sess');
    const somJson = {
      mode: EkaScribeStore.mode,
      date: this.date,
      uuid: this.txnID,
      s3_url: `s3://${S3_BUCKET_NAME}/${this.filePath}`,
      doc_oid: '123456789',
      doc_uuid: 'abae23c0-123456789',
      context_data: {
        accessToken: sessToken?.value,
      },
    };

    const chunkInfo = {
      timestamp: {
        st: '0',
        et: '0',
      },
      fileName: 'som.json',
    };

    const audioChunkLength = this.updateAudioInfo(chunkInfo) || 0;

    await this.uploadJsonFile(somJson, 'som.json', audioChunkLength - 1);
  }

  /**
   * Upload Eof.json to s3
   */
  async uploadEofToS3(): Promise<void> {
    const audioInfo = this.audioChunks;
    const { totalInsertedFrames, totalInsertedSamples } = this.getInsertedSampleDetails();
    const { totalRawFrames, totalRawSamples } = this.getRawSampleDetails();

    const chunks = Object.fromEntries(
      audioInfo.map((audio) => [
        audio.fileName,
        {
          st: audio.timestamp.st,
          et: audio.timestamp.et,
        },
      ])
    );

    const audioFiles = audioInfo
      .map((audio) => audio.fileName)
      .filter((fileName) => fileName !== 'som.json');

    const eofJson = {
      chunks_info: chunks,
      s3_url: `s3://${S3_BUCKET_NAME}/${this.filePath}`,
      date: this.date,
      uuid: this.txnID,
      files: audioFiles,
      doc_oid: '123456789',
      doc_uuid: 'abae23c0-123456789',
      context_data: {
        totalInsertedFrames,
        totalInsertedSamples,
        totalRawFrames,
        totalRawSamples,
      },
    };

    const chunkInfo = {
      timestamp: {
        st: '0',
        et: '0',
      },
      fileName: 'eof.json',
    };

    const audioChunkLength = this?.updateAudioInfo(chunkInfo) || 0;

    await this?.uploadJsonFile(eofJson, 'eof.json', audioChunkLength - 1);
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
  reset(): void {
    this.uploadPromises = [];
    this.successfulUploads = [];
  }
}

export default AudioFileManager;
