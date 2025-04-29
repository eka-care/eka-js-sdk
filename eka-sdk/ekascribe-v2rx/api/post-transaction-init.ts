import fetchClient from '../fetch-client';
import { TPostTransactionResponse } from './post-transaction-commit';
import { GET_EKA_V2RX_HOST } from '../fetch-client/helper';

export type TPostInitRequest = {
  mode: string;
  s3Url: string;
  txnId: string;
  input_language: string[];
  output_format_template: { template_id: string }[];
};

async function postTransactionInit({
  mode,
  txnId,
  s3Url,
  input_language,
  output_format_template,
}: TPostInitRequest): Promise<TPostTransactionResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const raw = {
      mode,
      s3_url: s3Url,
      input_language,
      output_format_template,
      transfer: 'vaded',
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchClient(`${GET_EKA_V2RX_HOST()}/transaction/init/${txnId}`, options);
    let res = await response.json();
    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    throw error;
  }
}

export default postTransactionInit;
