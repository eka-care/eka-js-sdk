import { SDK_STATUS_CODE } from '../../constants/constant';
import { TGetV1TemplateSectionsResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function getV1TemplateSections(): Promise<TGetV1TemplateSectionsResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'GET',
      headers,
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/api/v1/template/section`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c getV1TemplateSections -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      default_sections: [],
      custom_sections: [],
    } as TGetV1TemplateSectionsResponse;
  }
}

export default getV1TemplateSections;
