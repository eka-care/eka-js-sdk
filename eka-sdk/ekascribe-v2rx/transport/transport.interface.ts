export interface TransportRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface TransportResponse<T = unknown> {
  status: number;
  data: T;
  headers?: Record<string, string>;
}

export interface ITransport {
  request<T = unknown>(config: TransportRequest): Promise<TransportResponse<T>>;
  setAuthToken(token: string): void;
}

export interface IpcBridge {
  send(message: unknown): void;
  onResponse(handler: (message: unknown) => void): void;
}

export interface TransportConfig {
  access_token?: string;
  clientId?: string;
  flavour?: string;
  defaultTimeout?: number;
  onUnauthorized?: () => Promise<string>;
}
