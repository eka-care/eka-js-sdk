import { TPostTransactionResponse } from '../constants/types';
import fetchClient from '../fetch-client';

export type TPostInitRequest = {
  mode: string;
  s3Url: string;
  txnId: string;
};

async function postTransactionInitV2({
  mode,
  txnId,
  s3Url,
}: TPostInitRequest): Promise<TPostTransactionResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const raw = {
      mode,
      s3_url: s3Url,
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchClient(
      `http://api.eka.care/voice/api/v2/transaction/init/${txnId}`,
      options
    );

    return await response.json();
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    throw error;
  }
}

export default postTransactionInitV2;
