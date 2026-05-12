import {
  IpcBridge,
  ITransport,
  TransportConfig,
  TransportRequest,
  TransportResponse,
} from './transport.interface';
import { TransportError } from './http-transport';

const IPC_TIMEOUT = 10000;

interface IpcMessage {
  correlationId: string;
  type: 'request';
  payload: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
}

interface IpcResponseMessage {
  correlationId: string;
  type: 'response';
  payload: {
    status: number;
    data: unknown;
    headers?: Record<string, string>;
  };
}

export class IpcTransport implements ITransport {
  private accessToken: string;
  private clientId?: string;
  private flavour?: string;
  private defaultTimeout: number;
  private onUnauthorized?: () => Promise<string>;
  private tokenRefreshPromise: Promise<string> | null = null;
  private bridge: IpcBridge;
  private pendingRequests = new Map<
    string,
    { resolve: (value: TransportResponse) => void; reject: (error: Error) => void }
  >();

  constructor(config: TransportConfig, bridge: IpcBridge) {
    this.accessToken = config.access_token;
    this.clientId = config.clientId;
    this.flavour = config.flavour;
    this.defaultTimeout = config.defaultTimeout ?? IPC_TIMEOUT;
    this.onUnauthorized = config.onUnauthorized;
    this.bridge = bridge;

    this.bridge.onResponse((message: unknown) => {
      const response = message as IpcResponseMessage;
      if (response?.type !== 'response' || !response.correlationId) return;

      const pending = this.pendingRequests.get(response.correlationId);
      if (!pending) return;

      this.pendingRequests.delete(response.correlationId);
      pending.resolve({
        status: response.payload.status,
        data: response.payload.data,
        headers: response.payload.headers,
      });
    });
  }

  setAuthToken(token: string): void {
    this.accessToken = token;
  }

  destroy(): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new TransportError('Transport destroyed', 0));
    }
    this.pendingRequests.clear();
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
    const correlationId = this.generateCorrelationId();
    const timeout = config.timeout ?? this.defaultTimeout;
    const isRawBody =
      config.body instanceof Blob ||
      config.body instanceof File ||
      config.body instanceof FormData;
    const headers = this.buildHeaders(config.headers, isRawBody);

    const message: IpcMessage = {
      correlationId,
      type: 'request',
      payload: {
        method: config.method,
        url: config.url,
        headers,
        body: config.body != null
          ? (isRawBody ? (config.body as any) : JSON.stringify(config.body))
          : undefined,
      },
    };

    return new Promise<TransportResponse<T>>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new TransportError('IPC request timed out', 408));
      }, timeout);

      this.pendingRequests.set(correlationId, {
        resolve: (response: TransportResponse) => {
          clearTimeout(timeoutId);

          if (response.status === 401) {
            reject(new TransportError('Unauthorized', 401));
            return;
          }

          if (response.status === 403) {
            reject(new TransportError('Forbidden', 403));
            return;
          }

          resolve(response as TransportResponse<T>);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });

      this.bridge.send(message);
    });
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

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
