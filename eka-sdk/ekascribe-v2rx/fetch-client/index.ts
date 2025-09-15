import { GET_CLIENT_ID, GET_AUTH_TOKEN } from './helper';
import EkaScribeStore from '../store/store';
import { ERROR_CODE } from '../constants/enums';
import { SDK_STATUS_CODE } from '../constants/constant';

const API_TIMEOUT_MS = 10000;

export default async function fetchWrapper(
  url: RequestInfo,
  options: RequestInit | undefined = {},
  timeoutMs: number = API_TIMEOUT_MS
): Promise<Response> {
  const errorCallback = EkaScribeStore.errorCallback;
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

    if (errorCallback) {
      errorCallback({
        error_code: ERROR_CODE.FETCH_WRAPPER_RESPONSE,
        status_code: response.status,
        success_message: 'Fetch wrapper response: ' + JSON.stringify(response),
        request: 'Request body: ' + JSON.stringify(options.body),
      });
    }

    return response;
  } catch (error) {
    console.error(error, 'error in fetch wrapper - SDK');

    if (errorCallback) {
      errorCallback({
        error_code: ERROR_CODE.FETCH_WRAPPER_ERROR,
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        error_message: 'Fetch wrapper response: ' + JSON.stringify(error),
        request: 'Request body: ' + JSON.stringify(options.body),
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
