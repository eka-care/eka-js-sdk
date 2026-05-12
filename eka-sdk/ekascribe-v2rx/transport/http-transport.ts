import {
  ITransport,
  TransportConfig,
  TransportRequest,
  TransportResponse,
} from './transport.interface';

const DEFAULT_TIMEOUT = 10000;

export class HttpTransport implements ITransport {
  private accessToken?: string;
  private clientId?: string;
  private flavour?: string;
  private defaultTimeout: number;
  private onUnauthorized?: () => Promise<string>;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(config: TransportConfig) {
    this.accessToken = config.access_token;
    this.clientId = config.clientId;
    this.flavour = config.flavour;
    this.defaultTimeout = config.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.onUnauthorized = config.onUnauthorized;
  }

  setAuthToken(token: string): void {
    this.accessToken = token;
  }

  async request<T = unknown>(config: TransportRequest): Promise<TransportResponse<T>> {
    try {
      return await this.executeRequest<T>(config);
    } catch (error) {
      if (this.isUnauthorizedError(error) && this.onUnauthorized) {
        const newToken = await this.refreshToken();
        this.accessToken = newToken;
        return this.executeRequest<T>(config);
      }
      throw error;
    }
  }

  private async executeRequest<T>(config: TransportRequest): Promise<TransportResponse<T>> {
    const isRawBody =
      config.body instanceof Blob ||
      config.body instanceof File ||
      config.body instanceof FormData;

    const headers = this.buildHeaders(config.headers, isRawBody);
    const timeout = config.timeout ?? this.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body: config.body != null
          ? (isRawBody ? (config.body as BodyInit) : JSON.stringify(config.body))
          : undefined,
        signal: controller.signal,
        credentials: 'include',
      });

      if (response.status === 401) {
        throw new TransportError('Unauthorized', 401);
      }

      if (response.status === 403) {
        throw new TransportError('Forbidden', 403);
      }

      let data: T;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      return {
        status: response.status,
        data,
        headers: this.extractHeaders(response.headers),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildHeaders(custom?: Record<string, string>, isRawBody?: boolean): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!isRawBody) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (this.clientId) {
      headers['client-id'] = this.clientId;
    }

    if (this.flavour) {
      headers['flavour'] = this.flavour;
    }

    if (custom) {
      Object.assign(headers, custom);
    }

    return headers;
  }

  private async refreshToken(): Promise<string> {
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.onUnauthorized!().finally(() => {
      this.tokenRefreshPromise = null;
    });

    return this.tokenRefreshPromise;
  }

  private isUnauthorizedError(error: unknown): boolean {
    return error instanceof TransportError && error.status === 401;
  }

  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

export class TransportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}
