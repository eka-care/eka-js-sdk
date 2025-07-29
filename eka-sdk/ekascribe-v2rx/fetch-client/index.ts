import setEnv, { GET_AUTH_TOKEN, GET_CLIENT_ID, GET_EKA_HOST, GET_REFRESH_TOKEN } from './helper';

async function refreshToken() {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.set('client-id', GET_CLIENT_ID());

    let authToken = '';
    let refreshToken = '';
    const cookies = await chrome.cookies.getAll({ domain: '.eka.care' });

    if (GET_AUTH_TOKEN()) {
      authToken = GET_AUTH_TOKEN();
    } else {
      const sessCookie = cookies.find((cookie) => cookie.name === 'sess');
      authToken = sessCookie?.value || '';
    }

    if (GET_REFRESH_TOKEN()) {
      refreshToken = GET_REFRESH_TOKEN();
    } else {
      const refreshCookie = cookies.find((cookie) => cookie.name === 'refresh');
      refreshToken = refreshCookie?.value || '';
    }

    const raw = {
      sess: authToken,
      refresh: refreshToken,
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetch(
      `${GET_EKA_HOST()}/connect-auth/v1/account/refresh-token`,
      options
    );

    if (response.status === 401) {
      return false;
    }

    const res = await response.json();

    setEnv({
      auth_token: res.access_token,
      refresh_token: res.refresh_token,
    });
  } catch (error) {
    console.log('%c Line:9 🥃 refreshToken error: ', 'color:#f5ce50', error);
    return false;
  }

  return true;
}

export default async function fetchWrapper(
  url: RequestInfo,
  options: RequestInit | undefined = {},
  retry: boolean = true
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
      } else {
        // else read it from cookies
        const cookies = await chrome.cookies.getAll({ domain: '.eka.care' });
        const sessCookie = cookies.find((cookie) => cookie.name === 'sess');
        const authToken = sessCookie?.value || '';
        newHeaders.set('auth', authToken);
      }
    }

    const response: Response = await fetch(url, {
      ...options,
      headers: newHeaders,
    });

    if (response.status === 401 && retry) {
      const refreshSuccess = await refreshToken();

      if (refreshSuccess) {
        return await fetchWrapper(url, options, false);
      } else {
        return response;
      }
    }

    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
