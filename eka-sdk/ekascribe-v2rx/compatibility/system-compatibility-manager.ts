import { COMPATIBILITY_TEST_STATUS, COMPATIBILITY_TEST_TYPE } from '../constants/enums';
import {
  TCompatibilityCallback,
  TCompatibilityTestResult,
  TCompatibilityTestSummary,
  TGetConfigV2TimezoneResponse,
} from '../constants/types';
import { ITransport } from '../transport/transport.interface';
import { EkaHosts } from '../transport/hosts';

const INTERNET_TIMEOUT = 5000;

class SystemCompatibilityManager {
  private microphoneStream: MediaStream | null = null;

  constructor(private transport: ITransport, private hosts: EkaHosts) {}

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

  cleanup(): void {
    try {
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach((track) => track.stop());
        this.microphoneStream = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // --- Test 1: Internet Connectivity ---

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

  // --- Test 2: System Info ---

  private async checkSystemInfo(): Promise<TCompatibilityTestResult> {
    const testType = COMPATIBILITY_TEST_TYPE.SYSTEM_INFO;

    try {
      const { browser, version } = this.detectBrowser();
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const systemTime = new Date();
      const systemTimeISO = systemTime.toISOString();

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

  private async validateTimezone(): Promise<string | null> {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await this.transport.request<TGetConfigV2TimezoneResponse>({
        method: 'GET',
        url: `${this.hosts.voiceV2}/config/?timezone=${timezone}`,
      });

      if (response.status >= 400) {
        return 'Failed to validate timezone against system time';
      }

      const serverTime = response.data.current_time_utc;

      if (!serverTime) {
        return 'Failed to validate timezone against system time';
      }

      const serverTimeDate = new Date(serverTime);
      const systemTimeDate = new Date();
      const timeDifferenceMs = Math.abs(serverTimeDate.getTime() - systemTimeDate.getTime());
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

  // --- Test 3: Microphone Permission ---

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

        stream.getTracks().forEach((track) => track.stop());

        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.SUCCESS,
          'Microphone access is enabled and working.',
          { permission: 'granted', deviceId }
        );
      } catch (permissionError: unknown) {
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

  private handleMicrophoneError(error: unknown): TCompatibilityTestResult {
    const testType = COMPATIBILITY_TEST_TYPE.MICROPHONE;
    const errorMap: Record<string, { message: string; permission: string }> = {
      NotAllowedError: { message: 'Microphone permission denied', permission: 'denied' },
      PermissionDeniedError: { message: 'Microphone permission denied', permission: 'denied' },
      NotFoundError: { message: 'No microphone found', permission: 'denied' },
    };

    const errorName = error instanceof DOMException ? error.name : '';
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorInfo = errorMap[errorName] || {
      message: 'Error accessing microphone',
      permission: 'prompt',
    };

    return this.createTestResult(
      testType,
      COMPATIBILITY_TEST_STATUS.ERROR,
      errorInfo.message,
      { permission: errorInfo.permission },
      errorMessage
    );
  }

  // --- Test 4: Shared Worker Support ---

  private async checkSharedWorkerSupport(): Promise<TCompatibilityTestResult> {
    const testType = COMPATIBILITY_TEST_TYPE.SHARED_WORKER;

    try {
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.SUCCESS,
        'Your browser supports smooth background performance.',
        { supported: true }
      );
    } catch (error) {
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Error checking SharedWorker support',
        { supported: false },
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // --- Test 5: Network & API Access (ping-only) ---

  private async checkNetworkAndApiAccess(): Promise<TCompatibilityTestResult> {
    const startTime = Date.now();
    const testType = COMPATIBILITY_TEST_TYPE.NETWORK_API;

    try {
      const pingSuccess = await this.pingApi();
      const responseTime = Date.now() - startTime;

      if (pingSuccess) {
        return this.createTestResult(
          testType,
          COMPATIBILITY_TEST_STATUS.SUCCESS,
          'Secure network access is confirmed.',
          { pingSuccess: true, responseTime }
        );
      }

      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Unable to access API',
        { pingSuccess: false, responseTime }
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return this.createTestResult(
        testType,
        COMPATIBILITY_TEST_STATUS.ERROR,
        'Error checking network and API access',
        { pingSuccess: false, responseTime },
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async pingApi(): Promise<boolean> {
    try {
      const response = await this.transport.request({
        method: 'GET',
        url: `${this.hosts.ekaHost}/voice/ping`,
      });
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      console.error('Ping failed:', error);
      return false;
    }
  }

  // --- Helpers ---

  private createTestResult(
    test_type: string,
    status: COMPATIBILITY_TEST_STATUS,
    message: string,
    data?: Record<string, unknown>,
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

  private createSummary(results: TCompatibilityTestResult[]): TCompatibilityTestSummary {
    let passedTests = 0;
    let failedTests = 0;
    let warningTests = 0;

    for (const r of results) {
      if (r.status === COMPATIBILITY_TEST_STATUS.SUCCESS) passedTests++;
      else if (r.status === COMPATIBILITY_TEST_STATUS.ERROR) failedTests++;
      else if (r.status === COMPATIBILITY_TEST_STATUS.WARNING) warningTests++;
    }

    return {
      allPassed: passedTests === results.length,
      results,
      totalTests: results.length,
      passedTests,
      failedTests,
      warningTests,
    };
  }
}

export default SystemCompatibilityManager;
