import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostV1DocumentRequest, TPostV1DocumentResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function postV1SessionDocumentPublish({
  session_id,
  document_id,
}: TPostV1DocumentRequest): Promise<TPostV1DocumentResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/sessions/${session_id}/documents/${document_id}/publish`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.error('%c postV1Document -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostV1DocumentResponse;
  }
}

export default postV1SessionDocumentPublish;
