import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostTransactionCommitRequest, TPostTransactionResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V2 } from '../../fetch-client/helper';

async function postTransactionCommit({
  audioFiles,
  txnId,
}: TPostTransactionCommitRequest): Promise<TPostTransactionResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const raw = {
      audio_files: audioFiles,
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V2()}/transaction/commit/${txnId}`,
      options
    );

    let res = await response.json();
    res = {
      ...res,
      code: response.status,
    };
    return res;
  } catch (error) {
    console.error('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostTransactionResponse;
  }
}

export default postTransactionCommit;
