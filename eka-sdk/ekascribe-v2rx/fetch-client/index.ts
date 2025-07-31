import { GET_AUTH_TOKEN, GET_CLIENT_ID } from './helper';

export default async function fetchWrapper(
  url: RequestInfo,
  options: RequestInit | undefined = {}
): Promise<Response> {
  try {
    const newHeaders = new Headers(options.headers);

    if (!newHeaders.get('client-id')) {
      newHeaders.set('client-id', GET_CLIENT_ID());
    }

    if (!newHeaders.get('auth')) {
      // if token is provided in initEkaScribe
      if (GET_AUTH_TOKEN()) {
        newHeaders.set('auth', GET_AUTH_TOKEN());
      }
      //  else {
      //   // else read it from cookies
      //   const cookies = await chrome.cookies.getAll({ domain: '.eka.care' });
      //   const sessCookie = cookies.find((cookie) => cookie.name === 'sess');
      //   const authToken = sessCookie?.value || '';
      //   newHeaders.set('auth', authToken);
      // }
    }

    const response: Response = await fetch(url, {
      ...options,
      headers: newHeaders,
    });

    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
