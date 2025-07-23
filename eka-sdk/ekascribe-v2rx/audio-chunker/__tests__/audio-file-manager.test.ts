import { SHARED_WORKER_ACTION } from '../../constants/enums';
import AudioFileManager from '../audio-file-manager';

describe('AudioFileManager', () => {
  let audioFileManager: AudioFileManager;

  test('AudioFileManager should be defined', () => {
    expect(audioFileManager).toBeDefined();
  });

  beforeEach(() => {
    audioFileManager = new AudioFileManager();
  });

  describe('uploadAudioToS3', () => {
    const params = {
      audioFrames: new Float32Array([1, 2, 3]),
      fileName: 'test.mp3',
      chunkIndex: 0,
    };

    it('should call uploadAudioToS3WithoutWorker if Shared worker is not supported', async () => {
      // simulate SharedWorker is not supported
      (global as any).SharedWorker = undefined;

      /* DOUBT: will write tests for uploadAudioToS3WithoutWorker but
        since here it has been mocked to resolve as undefined, 
        if any error comes in this function how will this method behave?
      */

      // Spy on the internal method
      const spy = jest
        .spyOn(audioFileManager as any, 'uploadAudioToS3WithoutWorker')
        .mockResolvedValue(undefined);

      await audioFileManager.uploadAudioToS3(params);

      expect(spy).toHaveBeenCalledWith(params);

      spy.mockRestore();
    });

    it('should call uploadAudioToS3WithWorker if Shared worker is supported and create shared worker instance', async () => {
      // simulate SharedWorker is supported
      (global as any).SharedWorker = jest.fn();

      // simulate shared worker instance is not created
      (audioFileManager as any).sharedWorkerInstance = null;

      const createSpy = jest
        .spyOn(audioFileManager as any, 'createSharedWorkerInstance')
        .mockReturnValue(true);

      const spy = jest
        .spyOn(audioFileManager as any, 'uploadAudioToS3WithWorker')
        .mockResolvedValue(undefined);

      await audioFileManager.uploadAudioToS3(params);

      expect(createSpy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(params);

      spy.mockRestore();
      createSpy.mockRestore();
    });

    it('should call uploadAudioToS3WithWorker if Shared worker is supported', async () => {
      // simulate SharedWorker is supported
      (global as any).SharedWorker = jest.fn();

      // simulate shared worker instance is already created
      (audioFileManager as any).sharedWorkerInstance = {};

      const createSpy = jest
        .spyOn(audioFileManager as any, 'createSharedWorkerInstance')
        .mockReturnValue(true);

      const spy = jest
        .spyOn(audioFileManager as any, 'uploadAudioToS3WithWorker')
        .mockResolvedValue(undefined);

      await audioFileManager.uploadAudioToS3(params);

      expect(createSpy).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(params);

      spy.mockRestore();
      createSpy.mockRestore();
    });
  });

  describe('createSharedWorkerInstance', () => {
    let mockWorkerInstance: any;

    beforeEach(() => {
      mockWorkerInstance = {
        port: {
          onmessage: jest.fn(),
          start: jest.fn(),
        },
      };

      // Mock SharedWorker constructor
      (global as any).SharedWorker = jest.fn(() => mockWorkerInstance);

      // Mock URL constructor (simplify just to return string for test)
      (global as any).URL = jest.fn((path: string, base: string) => `${base}/${path}`);
    });

    afterEach(() => {
      jest.resetAllMocks();
      delete (global as any).SharedWorker;
      delete (global as any).URL;
    });

    const sharedWorker = (audioFileManager as any).sharedWorkerInstance;

    it('should create and assign shared worker instance', () => {
      const result = (audioFileManager as any).createSharedWorkerInstance();

      expect(global.SharedWorker).toHaveBeenCalledTimes(1);
      expect(sharedWorker).toBe(mockWorkerInstance);
      expect(mockWorkerInstance.port.onmessage).toBeDefined();
      expect(mockWorkerInstance.port.start).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle UPLOAD_FILE_WITH_WORKER_SUCCESS message from shared worker with success', () => {
      (audioFileManager as any).audioChunks = [
        {
          audioFrames: new Float32Array([1, 2, 3]),
          status: 'pending',
        },
      ];

      (audioFileManager as any).successfulUploads = [];

      (audioFileManager as any).createSharedWorkerInstance();

      const messageHandler = sharedWorker?.port.onmessage as Function;

      messageHandler({
        data: {
          action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS,
          response: {
            success: true,
          },
          requestBody: {
            fileCount: '1.mp3',
            chunkIndex: 0,
          },
        },
      });

      expect((audioFileManager as any).successfulUploads).toContain(['1.mp3']);
      expect((audioFileManager as any).audioChunks[0].status).toBe('success');
      expect((audioFileManager as any).audioChunks[0].response).toBe(true);
      expect((audioFileManager as any).audioChunks[0].audioFrames).toBeUndefined();
      expect((audioFileManager as any).audioChunks[0].fileBlob).toBeUndefined();
    });

    it('should handle UPLOAD_FILE_WITH_WORKER_SUCCESS message from shared worker with error', () => {
      (audioFileManager as any).audioChunks = [
        {
          audioFrames: new Float32Array([1, 2, 3]),
          status: 'pending',
        },
      ];

      (audioFileManager as any).createSharedWorkerInstance();

      const messageHandler = sharedWorker?.port.onmessage as Function;

      messageHandler({
        data: {
          action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS,
          response: {
            error: 'Upload failed',
          },
          requestBody: {
            fileCount: '1.mp3',
            chunkIndex: 0,
            fileBlob: {},
          },
        },
      });

      expect((audioFileManager as any).audioChunks[0].status).toBe('failure');
      expect((audioFileManager as any).audioChunks[0].response).toBe('Upload failed');
      expect((audioFileManager as any).audioChunks[0].audioFrames).toBeUndefined();
      expect((audioFileManager as any).audioChunks[0].fileBlob).toBe({});
    });

    it('should handle UPLOAD_FILE_WITH_WORKER_SUCCESS message from shared worker with errorCode ExpiredToken', () => {
      (audioFileManager as any).audioChunks = [
        {
          audioFrames: new Float32Array([1, 2, 3]),
          status: 'pending',
        },
      ];

      (audioFileManager as any).createSharedWorkerInstance();

      const params = {
        is_shared_worker: true,
      };

      const spy = jest
        .spyOn(audioFileManager as any, 'setupAWSConfiguration')
        .mockResolvedValue(undefined);

      const messageHandler = sharedWorker?.port.onmessage as Function;

      messageHandler({
        data: {
          action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS,
          response: {
            error: 'Expired token. Please re-authenticate!',
            errorCode: 'ExpiredToken',
          },
          requestBody: {
            fileCount: '1.mp3',
            chunkIndex: 0,
            fileBlob: {},
          },
        },
      });

      expect((audioFileManager as any).audioChunks[0].status).toBe('failure');
      expect((audioFileManager as any).audioChunks[0].response).toBe(
        'Expired token. Please re-authenticate!'
      );
      expect((audioFileManager as any).audioChunks[0].audioFrames).toBeUndefined();
      expect((audioFileManager as any).audioChunks[0].fileBlob).toBe({});

      expect(spy).toHaveBeenCalledWith(params);

      spy.mockRestore();
    });

    it('should return false if shared worker instance creation fails', () => {
      (global as any).SharedWorker = jest.fn(() => {
        throw new Error('SharedWorker creation failed');
      });

      const result = (audioFileManager as any).createSharedWorkerInstance();

      expect(sharedWorker).toBe(null);
      expect(result).toBe(false);
    });
  });

  describe('setupAWSConfiguration', () => {
    it('should pass message to shared worker if is_shared_worker is true and credentials are present', () => {
      const params = {
        is_shared_worker: true,
      };

      (audioFileManager as any).setupAWSConfiguration();
      const sharedWorker = (audioFileManager as any).sharedWorkerInstance;

      const messageHandler = sharedWorker?.port.onmessage as Function;

      messageHandler({});
    });

    it('should return error if is_shared_worker is true and credentials are not present', () => {});

    it('should configure AWS credentials if is_shared_worker is false and credentials are present', () => {});

    it('should return error if is_shared_worker is false and credentials are not present', () => {});
  });
});
