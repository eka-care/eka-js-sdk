import { SDK_STATUS_CODE } from '../../constants/constant';
import { TDeleteV1DocumentResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function deleteV1Document(document_id: string): Promise<TDeleteV1DocumentResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'DELETE',
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
    console.error('%c deleteV1Document -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TDeleteV1DocumentResponse;
  }
}

export default deleteV1Document;
