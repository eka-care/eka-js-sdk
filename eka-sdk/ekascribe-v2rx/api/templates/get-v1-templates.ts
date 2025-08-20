import { SDK_STATUS_CODE } from '../../constants/constant';
import { TGetV1TemplatesResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function getV1Templates(): Promise<TGetV1TemplatesResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'GET',
      headers,
    };

    const response = await fetchWrapper(`${GET_EKA_VOICE_HOST_V1()}/api/v1/template`, options);
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c getV1Templates -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      items: [],
    } as TGetV1TemplatesResponse;
  }
}

export default getV1Templates;
