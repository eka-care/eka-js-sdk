import postCogInit from '../api/post-cog-init';
import { configureAWS } from '../aws-services/configure-aws';
import {
  COMPATIBILITY_TEST_STATUS,
  COMPATIBILITY_TEST_TYPE,
  SHARED_WORKER_ACTION,
} from '../constants/enums';
import {
  TCompatibilityCallback,
  TCompatibilityTestResult,
  TCompatibilityTestSummary,
} from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_HOST, GET_S3_BUCKET_NAME } from '../fetch-client/helper';
import pushFilesToS3V2 from '../aws-services/upload-file-to-s3-es6';
import { getConfigV2Timezone } from '../api/config/get-voice-api-v2-config-timezone';

// Constants
const INTERNET_TIMEOUT = 5000;
const WORKER_TIMEOUT = 2000;
const UPLOAD_TIMEOUT = 10000;
const COMPATIBILITY_TEST_FOLDER = 'system-compatibility-test';

class SystemCompatibilityManager {
  private testSharedWorker: SharedWorker | null = null;
  private microphoneStream: MediaStream | null = null;
  private awsConfigured: boolean = false;

  constructor() {}

  /**
   * Main orchestrator - runs all 5 compatibility tests sequentially
   */
  async runCompatibilityTest(callback: TCompatibilityCallback): Promise<TCompatibilityTestSummary> {
    const results: TCompatibilityTestResult[] = [];
    const tests = [
      this.checkInternetConnectivity,
      this.checkSystemInfo,
      this.checkMicrophonePermission,
      this.checkSharedWorkerSupport,
      this.checkNetworkAndApiAccess,
    ];

    try {
      for (const test of tests) {
        const result = await test.call(this);
        results.push(result);
        callback(result);
      }

      return this.createSummary(results);
    } catch (error) {
      console.error('Error in runCompatibilityTest:', error);
      return this.createSummary(results);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Create summary from test results
   */
  private createSummary(results: TCompatibilityTestResult[]): TCompatibilityTestSummary {
    const passedTests = results.filter(
      (r) => r.status === COMPATIBILITY_TEST_STATUS.SUCCESS
    ).length;
    const failedTests = results.filter((r) => r.status === COMPATIBILITY_TEST_STATUS.ERROR).length;
    const warningTests = results.filter(
      (r) => r.status === COMPATIBILITY_TEST_STATUS.WARNING
    ).length;

    return {
      allPassed: passedTests === results.length,
      results,
      totalTests: results.length,
      passedTests,
      failedTests,
      warningTests,
    };
  }

  /**
   * Test 1: Check Internet Connectivity
   */
  private async checkInternetConnectivity(): Promise<TCompatibilityTestResult> {
    const startTime = Date.now();
    const testType = COMPATIBILITY_TEST_TYPE.INTERNET_CONNECTIVITY;

    try {
      if (!navigator.onLine) {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.ERROR,
          'No internet connection detected',
          { isOnline: false }
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), INTERNET_TIMEOUT);

      try {
        await fetch('https://www.google.com/favicon.ico', {
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const pingTime = Date.now() - startTime;

        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.SUCCESS,
          'Internet connection is working properly.',
          { isOnline: true, pingTime }
        );
      } catch (fetchError) {
        clearTimeout(timeoutId);
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.ERROR,
          'Unable to reach internet',
          { isOnline: false },
          fetchError instanceof Error ? fetchError.message : 'Fetch failed'
        );
      }
    } catch (error) {
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Error checking internet connectivity',
        { isOnline: false },
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test 2: Check System Information with timezone validation
   */
  private async checkSystemInfo(): Promise<TCompatibilityTestResult> {
    const testType = COMPATIBILITY_TEST_TYPE.SYSTEM_INFO;

    try {
      const { browser, version } = this.detectBrowser();
      const deviceMemory = (navigator as any).deviceMemory;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const systemTime = new Date();
      const systemTimeISO = systemTime.toISOString();

      // Validate timezone and system time
      const validationError = await this.validateTimezone();
      if (validationError) {
        return this.createTestResult(testType, COMPATIBILITY_TEST_STATUS.ERROR, validationError, {
          browser,
          version,
          ram: deviceMemory,
          timezone,
          systemTime: systemTimeISO,
        });
      }

      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.SUCCESS,
        'Your browser and device meet the required specifications.',
        { browser, version, ram: deviceMemory, timezone, systemTime: systemTimeISO }
      );
    } catch (error) {
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Error collecting system information',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Validate timezone against system time
   */
  private async validateTimezone(): Promise<string | null> {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const serverTimeResponse = await getConfigV2Timezone({ timezone });

      if (serverTimeResponse.code >= 400) {
        return 'Failed to validate timezone against system time';
      }

      const serverTime = serverTimeResponse.current_time_utc;

      // Validate that server time is present and valid
      if (!serverTime) {
        return 'Failed to validate timezone against system time';
      }

      // Validate server time and system time are within 10 minutes
      const serverTimeDate = new Date(serverTime);
      const systemTimeDate = new Date();

      // Calculate absolute difference in milliseconds
      const timeDifferenceMs = Math.abs(serverTimeDate.getTime() - systemTimeDate.getTime());

      // 10 minutes = 10 * 60 * 1000 = 600,000 milliseconds
      const allowedDifferenceMs = 10 * 60 * 1000;

      if (timeDifferenceMs > allowedDifferenceMs) {
        const differenceMinutes = Math.round(timeDifferenceMs / (60 * 1000));
        return `System time is invalid. It differs from server time by ${differenceMinutes} minutes.`;
      }

      return null;
    } catch (error) {
      return 'Failed to validate timezone against system time';
    }
  }

  /**
   * Detect browser and version
   */
  private detectBrowser(): { browser: string; version: string } {
    const ua = navigator.userAgent;
    const browsers = [
      { name: 'Firefox', pattern: /Firefox\/(\d+\.\d+)/ },
      { name: 'Opera', pattern: /(?:Opera|OPR)\/(\d+\.\d+)/ },
      { name: 'Internet Explorer', pattern: /rv:(\d+\.\d+)/, check: () => ua.includes('Trident') },
      { name: 'Edge', pattern: /(?:Edge|Edg)\/(\d+\.\d+)/ },
      { name: 'Chrome', pattern: /Chrome\/(\d+\.\d+)/ },
      {
        name: 'Safari',
        pattern: /Version\/(\d+\.\d+)/,
        check: () => ua.includes('Safari') && !ua.includes('Chrome'),
      },
    ];

    for (const { name, pattern, check } of browsers) {
      if (check ? check() : ua.includes(name) || pattern.test(ua)) {
        const match = ua.match(pattern);
        return { browser: name, version: match?.[1] || 'Unknown' };
      }
    }

    return { browser: 'Unknown', version: 'Unknown' };
  }

  /**
   * Test 3: Check Microphone Permission
   */
  private async checkMicrophonePermission(): Promise<TCompatibilityTestResult> {
    const testType = COMPATIBILITY_TEST_TYPE.MICROPHONE;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.ERROR,
          'getUserMedia is not supported in this browser',
          { permission: 'denied' }
        );
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const deviceId = stream.getAudioTracks()[0]?.getSettings()?.deviceId;

        // Stop stream immediately
        stream.getTracks().forEach((track) => track.stop());

        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.SUCCESS,
          'Microphone access is enabled and working.',
          { permission: 'granted', deviceId }
        );
      } catch (permissionError: any) {
        return this.handleMicrophoneError(permissionError);
      }
    } catch (error) {
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Error checking microphone permission',
        { permission: 'denied' },
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Handle microphone permission errors
   */
  private handleMicrophoneError(error: any): TCompatibilityTestResult {
    const testType = COMPATIBILITY_TEST_TYPE.MICROPHONE;
    const errorMap: Record<string, { message: string; permission: string }> = {
      NotAllowedError: { message: 'Microphone permission denied', permission: 'denied' },
      PermissionDeniedError: { message: 'Microphone permission denied', permission: 'denied' },
      NotFoundError: { message: 'No microphone found', permission: 'denied' },
    };

    const errorInfo = errorMap[error.name] || {
      message: 'Error accessing microphone',
      permission: 'prompt',
    };

    return this.createTestResult(
      testType,
      COMPATIBILITY_TEST_STATUS.ERROR,
      errorInfo.message,
      { permission: errorInfo.permission },
      error.message
    );
  }

  /**
   * Test 4: Check Shared Worker Support
   */
  setCompatiblityTestSharedWorker(worker: SharedWorker): void {
    this.testSharedWorker = worker;
  }

  private async checkSharedWorkerSupport(): Promise<TCompatibilityTestResult> {
    const testType = COMPATIBILITY_TEST_TYPE.SHARED_WORKER;

    try {
      if (typeof SharedWorker === 'undefined') {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.WARNING,
          'SharedWorker is not supported in this browser',
          { supported: false, workerCreated: false }
        );
      }

      try {
        // const worker = new SharedWorker(
        //   'https://cdn.jsdelivr.net/npm/@eka-care/ekascribe-ts-sdk@2.0.30/dist/worker.bundle.js'
        // );

        // // const worker = new SharedWorker(new URL('./worker.bundle.js', import.meta.url));

        // console.log(worker, 'worker');
        // this.testSharedWorker = worker;

        if (!this.testSharedWorker) {
          return this.createTestResult(
            testType,
            COMPATIBILITY_TEST_STATUS.WARNING,
            'SharedWorker not created',
            { supported: false, workerCreated: false }
          );
        }

        return await this.testWorkerCommunication(this.testSharedWorker);
      } catch (workerError) {
        console.log(workerError, 'worker error');
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.WARNING,
          'SharedWorker supported but failed to create',
          { supported: true, workerCreated: false },
          workerError instanceof Error ? workerError.message : 'Worker creation failed'
        );
      }
    } catch (error) {
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Error checking SharedWorker support',
        { supported: false, workerCreated: false },
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Test worker communication
   */
  private testWorkerCommunication(worker: SharedWorker): Promise<TCompatibilityTestResult> {
    const testType = COMPATIBILITY_TEST_TYPE.SHARED_WORKER;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(
          this.createTestResult(
            testType,
            COMPATIBILITY_TEST_STATUS.WARNING,
            'SharedWorker created but did not respond',
            { supported: true, workerCreated: true }
          )
        );
      }, WORKER_TIMEOUT);

      worker.port.onmessage = (event) => {
        const { action } = event.data || {};

        if (action === SHARED_WORKER_ACTION.TEST_WORKER) {
          clearTimeout(timeoutId);
          resolve(
            this.createTestResult(
              testType,
              COMPATIBILITY_TEST_STATUS.SUCCESS,
              'Your browser supports smooth background performance.',
              { supported: true, workerCreated: true }
            )
          );
        }
      };

      worker.port.start();
      worker.port.postMessage({ action: SHARED_WORKER_ACTION.TEST_WORKER });
    });
  }

  /**
   * Test 5: Check Network & API Access
   */
  private async checkNetworkAndApiAccess(): Promise<TCompatibilityTestResult> {
    const startTime = Date.now();
    const testType = COMPATIBILITY_TEST_TYPE.NETWORK_API;

    const results = {
      pingSuccess: false,
      uploadSuccess: false,
    };

    try {
      // Step 1: Ping the voice API
      results.pingSuccess = await this.pingApi();

      // Step 2: Configure AWS
      await this.configureAwsCredentials();

      // Step 3: Test S3 upload
      if (this.awsConfigured) {
        results.uploadSuccess = await this.testS3Upload();
      }

      const responseTime = Date.now() - startTime;
      const data = {
        pingSuccess: results.pingSuccess,
        awsConfigured: this.awsConfigured,
        responseTime,
        uploadSuccess: results.uploadSuccess,
      };

      // Determine status and message
      if (results.pingSuccess && this.awsConfigured && results.uploadSuccess) {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.SUCCESS,
          'Secure network access is confirmed.',
          data
        );
      } else if (results.pingSuccess && this.awsConfigured) {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.WARNING,
          'Network and API access verified but S3 upload failed',
          data
        );
      } else if (results.pingSuccess) {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.WARNING,
          'API accessible but AWS configuration failed',
          data
        );
      } else {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.ERROR,
          'Unable to access API',
          data
        );
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Error checking network and API access',
        { ...results, awsConfigured: this.awsConfigured, responseTime },
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Ping the API endpoint
   */
  private async pingApi(): Promise<boolean> {
    try {
      const response = await fetchWrapper(`${GET_EKA_HOST()}/voice/ping`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('Ping failed:', error);
      return false;
    }
  }

  /**
   * Configure AWS credentials
   */
  private async configureAwsCredentials(): Promise<void> {
    try {
      const cogResponse = await postCogInit();

      if (cogResponse.credentials) {
        const { AccessKeyId, SecretKey, SessionToken } = cogResponse.credentials;

        if (this.testSharedWorker) {
          const worker = this.testSharedWorker;

          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              worker.port.removeEventListener('message', messageHandler);
              reject(new Error('AWS configuration timeout'));
            }, WORKER_TIMEOUT * 2);

            const messageHandler = (event: MessageEvent) => {
              const { action, error } = event.data || {};

              if (action === SHARED_WORKER_ACTION.CONFIGURE_AWS_SUCCESS) {
                clearTimeout(timeoutId);
                worker.port.removeEventListener('message', messageHandler);
                this.awsConfigured = true;
                resolve();
              } else if (action === SHARED_WORKER_ACTION.CONFIGURE_AWS_ERROR) {
                clearTimeout(timeoutId);
                worker.port.removeEventListener('message', messageHandler);
                this.awsConfigured = false;
                reject(new Error(error || 'AWS configuration failed'));
              }
            };

            worker.port.addEventListener('message', messageHandler);
            worker.port.postMessage({
              action: SHARED_WORKER_ACTION.CONFIGURE_AWS,
              payload: {
                accessKeyId: AccessKeyId,
                secretKey: SecretKey,
                sessionToken: SessionToken,
              },
            });
          });
        } else {
          configureAWS({
            accessKeyId: AccessKeyId,
            secretKey: SecretKey,
            sessionToken: SessionToken,
          });
          this.awsConfigured = true;
        }
      }
    } catch (error) {
      console.error('AWS configuration failed:', error);
      this.awsConfigured = false;
    }
  }

  /**
   * Test S3 upload
   */
  private async testS3Upload(): Promise<boolean> {
    try {
      const dummyFile = this.createDummyMp4File();
      const fileName = `${COMPATIBILITY_TEST_FOLDER}/sample-audio.m4a_`;
      const txnID = `compat-test-${Date.now()}`;
      const businessID = 'compat-test';
      const s3BucketName = GET_S3_BUCKET_NAME();

      if (this.testSharedWorker) {
        const result = await this.uploadViaWorker(
          dummyFile,
          fileName,
          s3BucketName,
          txnID,
          businessID
        );
        return !!result.success;
      } else {
        const result = await pushFilesToS3V2({
          s3BucketName,
          fileBlob: dummyFile,
          fileName,
          txnID,
          businessID,
          is_shared_worker: false,
        });
        return !!result.success;
      }
    } catch (error) {
      console.error('Upload test failed:', error);
      return false;
    }
  }

  /**
   * Create a dummy MP4 file for testing upload
   */
  private createDummyMp4File(): Blob {
    const mp4Header = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02,
      0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x61, 0x76, 0x63, 0x31, 0x6d, 0x70,
      0x34, 0x31,
    ]);

    return new Blob([mp4Header], { type: 'audio/mp4' });
  }

  /**
   * Upload file via shared worker
   */
  private uploadViaWorker(
    fileBlob: Blob,
    fileName: string,
    s3BucketName: string,
    txnID: string,
    businessID: string
  ): Promise<{ success?: string; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.testSharedWorker) {
        reject(new Error('Shared worker not available'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Upload timeout'));
      }, UPLOAD_TIMEOUT);

      const messageHandler = (event: MessageEvent) => {
        const { action, response, error } = event.data || {};

        if (action === SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_SUCCESS) {
          clearTimeout(timeoutId);
          this.testSharedWorker!.port.removeEventListener('message', messageHandler);
          resolve(response || { success: 'Upload successful' });
        } else if (action === SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER_ERROR) {
          clearTimeout(timeoutId);
          this.testSharedWorker!.port.removeEventListener('message', messageHandler);
          reject(new Error(error || 'Upload failed'));
        }
      };

      this.testSharedWorker.port.addEventListener('message', messageHandler);
      this.testSharedWorker.port.postMessage({
        action: SHARED_WORKER_ACTION.UPLOAD_FILE_WITH_WORKER,
        payload: { fileName, fileBlob, txnID, businessID, s3BucketName },
      });
    });
  }

  /**
   * Helper to create test result objects
   */
  private createTestResult(
    test_type: string,
    status: COMPATIBILITY_TEST_STATUS,
    message: string,
    data?: any,
    error?: string
  ): TCompatibilityTestResult {
    const result: TCompatibilityTestResult = {
      test_type,
      status,
      message,
      timestamp: new Date().toISOString(),
    };

    if (data) result.data = data;
    if (error) result.error = error;

    return result;
  }

  /**
   * Cleanup all test resources
   */
  cleanup(): void {
    try {
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach((track) => track.stop());
        this.microphoneStream = null;
      }

      if (this.testSharedWorker) {
        this.testSharedWorker.port.close();
        this.testSharedWorker = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default SystemCompatibilityManager;
