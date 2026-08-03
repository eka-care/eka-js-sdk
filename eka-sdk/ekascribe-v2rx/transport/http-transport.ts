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
      config.body instanceof Blob || config.body instanceof File || config.body instanceof FormData;

    const headers = this.buildHeaders(config.headers, isRawBody);
    const timeout = config.timeout ?? this.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers,
        body:
          config.body != null
            ? isRawBody
              ? (config.body as BodyInit)
              : JSON.stringify(config.body)
            : undefined,
        signal: controller.signal,
        credentials: 'include',
      });

      const data = await this.parseBody<T>(response);

      // Throwing routes non-2xx through mapTransportError, setting both codes.
      if (!response.ok) {
        throw new TransportError(
          extractErrorMessage(data, response.statusText),
          response.status,
          data
        );
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

  /**
   * Never throws — a malformed body must not mask the HTTP status, or a 401 with
   * an unparseable payload would skip the token refresh.
   */
  private async parseBody<T>(response: Response): Promise<T> {
    try {
      const contentType = response.headers.get('content-type');
      return contentType?.includes('application/json')
        ? await response.json()
        : ((await response.text()) as unknown as T);
    } catch {
      return undefined as unknown as T;
    }
  }

  private buildHeaders(
    custom?: Record<string, string>,
    isRawBody?: boolean
  ): Record<string, string> {
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
    /** Parsed error body, when the server sent one. */
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

/** Read an error message from a response body, falling back to the status text. */
export function extractErrorMessage(body: unknown, statusText: string): string {
  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    const { error, message, msg } = body as {
      error?: { message?: string };
      message?: string;
      msg?: string;
    };

    const extracted = error?.message ?? message ?? msg;
    if (extracted) {
      return extracted;
    }
  }

  return statusText || 'Request failed';
}
