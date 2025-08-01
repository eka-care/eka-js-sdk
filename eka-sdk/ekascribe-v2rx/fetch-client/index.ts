import { GET_AUTH_TOKEN, GET_CLIENT_ID } from './helper';

const API_TIMEOUT_MS = 5000;

export default async function fetchWrapper(
  url: RequestInfo,
  options: RequestInit | undefined = {},
  timeoutMs: number = API_TIMEOUT_MS
): Promise<Response> {
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
      // if token is provided in initEkaScribe
      newHeaders.set('auth', GET_AUTH_TOKEN());
    }

    const response: Response = await fetch(url, {
      ...options,
      headers: newHeaders,
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
}
