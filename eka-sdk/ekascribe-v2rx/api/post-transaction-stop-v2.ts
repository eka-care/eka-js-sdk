import fetchClient from '../fetch-client';
import { GET_EKA_V2RX_HOST } from '../fetch-client/helper';
import { TPostCommitRequest, TPostTransactionResponse } from './post-transaction-commit-v2';

async function postTransactionStopV2({
  txnId,
  audioFiles,
}: TPostCommitRequest): Promise<TPostTransactionResponse> {
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

    const response = await fetchClient(`${GET_EKA_V2RX_HOST()}/transaction/stop/${txnId}`, options);

    return await response.json();
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    throw error;
  }
}

export default postTransactionStopV2;
