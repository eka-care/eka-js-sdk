import setEnv, { GET_AUTH_TOKEN, GET_CLIENT_ID, GET_EKA_HOST, GET_REFRESH_TOKEN } from './helper';

async function refreshToken() {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const access_token = GET_AUTH_TOKEN();
    const refresh_token = GET_REFRESH_TOKEN();

    const raw = {
      access_token,
      refresh_token,
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
      // credentials: 'include',
      // mode: 'cors',
    };

    const response = await fetchWrapper(
      `${GET_EKA_HOST()}/connect-auth/v1/account/refresh-token`,
      options,
      false
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

    const refresh_token = GET_REFRESH_TOKEN();

    if (response.status === 401 && retry && refresh_token) {
      const refreshSuccess = await refreshToken();

      if (refreshSuccess) {
        return await fetchWrapper(
          url,
          {
            ...options,
            headers: newHeaders,
          },
          false
        );
      } else {
        throw new Error('Unable to refresh user token');
      }
    }

    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
