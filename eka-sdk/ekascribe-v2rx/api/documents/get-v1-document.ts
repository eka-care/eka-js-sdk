import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostV1DocumentResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function getV1Document(document_id: string): Promise<TPostV1DocumentResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'GET',
      headers,
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/documents/${document_id}`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.error('%c getV1Document -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      items: [],
    } as TPostV1DocumentResponse;
  }
}

export default getV1Document;
