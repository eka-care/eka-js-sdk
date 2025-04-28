import fetchClient from '../fetch-client';
import { GET_EKA_V2RX_HOST } from '../fetch-client/helper';

export type TPostCommitRequest = {
  audioFiles: string[];
  txnId: string;
};

export type TPostTransactionResponse = {
  status: string;
  message: string;
  txn_id: string;
  b_id: string;
  code: number;
};

async function postTransactionCommitV2({
  audioFiles,
  txnId,
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

    const response = await fetchClient(
      `${GET_EKA_V2RX_HOST()}/transaction/commit/${txnId}`,
      options
    );

    return await response.json();
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    throw error;
  }
}

export default postTransactionCommitV2;
