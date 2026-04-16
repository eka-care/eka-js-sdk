import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPatchSessionContextResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function patchSessionContext(
  txn_id: string,
  context: { past_sessions?: string[]; attachments?: string[] }
): Promise<TPatchSessionContextResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ context }),
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/sessions/${txn_id}/context`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.error('%c patchSessionContext -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPatchSessionContextResponse;
  }
}

export default patchSessionContext;
