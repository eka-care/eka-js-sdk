import { GET_CLIENT_ID } from './helper';

export default async function fetchClient(
  url: RequestInfo,
  options: RequestInit | undefined = {}
): Promise<Response> {
  try {
    const newHeaders = new Headers(options.headers);

    if (!newHeaders.get('client-id')) {
      newHeaders.set('client-id', GET_CLIENT_ID());
    }

    // if (!newHeaders.get('auth')) {
    //   newHeaders.set('auth', GET_AUTH_TOKEN());
    // }

    const response: Response = await fetch(url, {
      ...options,
      headers: newHeaders,
    });

    if (response.status > 401) {
      throw new Error('Unable to refresh user token');
    }
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
