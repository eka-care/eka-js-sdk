import { GET_CLIENT_ID, GET_AUTH_TOKEN } from './helper';
import EkaScribeStore from '../store/store';
import { CALLBACK_TYPE } from '../constants/enums';

const API_TIMEOUT_MS = 10000;

export default async function fetchWrapper(
  url: RequestInfo,
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

    if (!newHeaders.get('auth') && GET_AUTH_TOKEN()) {
      newHeaders.set('auth', GET_AUTH_TOKEN());
    }

    const response: Response = await fetch(url, {
      ...options,
      headers: newHeaders,
      signal: controller.signal,
      credentials: 'include',
    });

    if (!response.ok) {
      if (onEventCallback) {
        onEventCallback({
          callback_type: CALLBACK_TYPE.AUTHENTICATION_STATUS,
          status: 'error',
          message: 'Fetch wrapper response: ' + response.ok + response.status,
          timestamp: new Date().toISOString(),
          data: {
            request: 'Request body: ' + JSON.stringify(options.body),
            response: 'Response body: ' + JSON.stringify(response),
          },
        });
      }

      throw new Error('Fetch wrapper error: ' + response.ok + response.status);
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
