import { SDK_STATUS_CODE } from '../constants/constant';
import { TPostTransactionInitRequest, TPostTransactionResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_V2RX_HOST_V2 } from '../fetch-client/helper';

const API_TIMEOUT_MS = 5000;

async function postTransactionInit({
  mode,
  txnId,
  s3Url,
  input_language,
  output_format_template,
}: TPostTransactionInitRequest): Promise<TPostTransactionResponse> {
  const controller = new AbortController();

  let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

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

    const response = await fetchWrapper(
      `${GET_EKA_V2RX_HOST_V2()}/transaction/init/${txnId}`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostTransactionResponse;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
}

export default postTransactionInit;
