import setEnv, { GET_CLIENT_ID, GET_AUTH_TOKEN, GET_FLAVOUR, GET_EKA_HOST } from './helper';
import EkaScribeStore from '../store/store';
import { AUTH_ERROR_STATUS, CALLBACK_TYPE } from '../constants/enums';

const API_TIMEOUT_MS = 10000;

function handleAuthError(status: AUTH_ERROR_STATUS, code: number): void {
  const callback = EkaScribeStore.authErrorCallback;
  if (!callback) return;

  try {
    const result = callback(status, code);
    const newToken = result?.access_token;
    if (newToken) {
      setEnv({ auth_token: newToken });
    }
  } catch (err) {
    console.error('[fetchWrapper] auth error callback threw:', err);
  }
}

type NetworkRequestPayload = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  retry: boolean;
  ekaHost: string;
};

type NetworkResponsePayload = {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
};

type NetworkApiBridge = {
  request: (payload: NetworkRequestPayload) => Promise<NetworkResponsePayload>;
};

type WindowWithNetworkApi = Window & {
  networkApi?: NetworkApiBridge;
};

function getNetworkBridge(): NetworkApiBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as WindowWithNetworkApi).networkApi;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export default async function fetchWrapper(
  url: string,
  options: RequestInit | undefined = {},
  timeoutMs: number = API_TIMEOUT_MS
): Promise<Response> {
  const onEventCallback = EkaScribeStore.eventCallback;
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Set up timeout
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const newHeaders = new Headers(options.headers);

    if (!newHeaders.get('client-id')) {
      newHeaders.set('client-id', GET_CLIENT_ID());
    }

    if (!newHeaders.get('flavour') && !url.includes('file-upload')) {
      newHeaders.set('flavour', GET_FLAVOUR());
    }

    if (!newHeaders.get('auth') && GET_AUTH_TOKEN()) {
      newHeaders.set('auth', GET_AUTH_TOKEN());
    }

    const bridge = getNetworkBridge();
    let response: Response;

    if (bridge) {
      const payload: NetworkRequestPayload = {
        url: typeof url === 'string' ? url : (url as Request).url,
        method: options.method || 'GET',
        headers: headersToRecord(newHeaders),
        body: (options.body as string) ?? null,
        retry: true,
        ekaHost: GET_EKA_HOST(),
      };

      const result = await bridge.request(payload);
      response = new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
      });
    } else {
      response = await fetch(url, {
        ...options,
        headers: newHeaders,
        signal: controller.signal,
        credentials: 'include',
      });
    }

    if (response.status === 401 || response.status === 403) {
      const status =
        response.status === 401 ? AUTH_ERROR_STATUS.UNAUTHORIZED : AUTH_ERROR_STATUS.FORBIDDEN;
      handleAuthError(status, response.status);
    } else if (!response.ok && onEventCallback) {
      onEventCallback({
        callback_type: CALLBACK_TYPE.AUTHENTICATION_STATUS,
        status: 'error',
        message: 'Fetch wrapper error: ' + response.ok + response.status,
        timestamp: new Date().toISOString(),
        data: {
          request: 'Request body: ' + JSON.stringify(options.body),
          response: 'Response body: ' + JSON.stringify(response),
        },
      });
    }

    return response;
  } catch (error) {
    console.error(error, 'error in fetch wrapper - SDK');

    if (onEventCallback) {
      onEventCallback({
        callback_type: CALLBACK_TYPE.AUTHENTICATION_STATUS,
        status: 'error',
        message: 'Fetch wrapper response: ' + error,
        timestamp: new Date().toISOString(),
        data: {
          request: 'Request body: ' + JSON.stringify(options.body),
          response: 'Error body: ' + JSON.stringify(error),
        },
      });
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
}
