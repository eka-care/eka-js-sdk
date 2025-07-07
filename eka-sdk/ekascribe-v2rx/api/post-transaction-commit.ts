import { TPostTransactionCommitRequest, TPostTransactionResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_V2RX_HOST_V2 } from '../fetch-client/helper';

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
      `${GET_EKA_V2RX_HOST_V2()}/transaction/commit/${txnId}`,
      options
    );

    return await response.json();
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    return {
      code: 520,
      message: `Something went wrong! ${error}`,
    } as TPostTransactionResponse;
  }
}

export default postTransactionCommit;
