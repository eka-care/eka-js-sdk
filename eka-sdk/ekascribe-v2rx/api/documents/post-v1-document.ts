import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostV1DocumentRequest, TPostV1DocumentResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function postV1Document({
  session_id,
  document_name,
  type,
  document_id,
  publish,
}: TPostV1DocumentRequest): Promise<TPostV1DocumentResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const raw = {
      session_id,
      type,
      ...(document_name ? { document_name } : {}),
      ...(document_id ? { document_id } : {}),
      ...(publish ? { publish } : {}),
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchWrapper(`${GET_EKA_VOICE_HOST_V1()}/documents`, options);
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

export default postV1Document;
