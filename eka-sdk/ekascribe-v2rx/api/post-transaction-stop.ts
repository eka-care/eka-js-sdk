import { TPostTransactionApiResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_V2RX_HOST } from '../fetch-client/helper';
import { TPostCommitRequest } from './post-transaction-commit';

async function postTransactionStop({
  txnId,
  audioFiles,
}: TPostCommitRequest): Promise<TPostTransactionApiResponse> {
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
      `${GET_EKA_V2RX_HOST()}/transaction/stop/${txnId}`,
      options
    );

    return await response.json();
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    return {
      code: 520,
      message: `Something went wrong! ${error}`,
    } as TPostTransactionApiResponse;
  }
}

export default postTransactionStop;
