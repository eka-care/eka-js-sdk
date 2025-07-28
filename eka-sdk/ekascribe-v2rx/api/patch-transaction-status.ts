import { SDK_STATUS_CODE } from '../constants/constant';
import {
  TPatchTransactionError,
  TPatchTransactionRequest,
  TPostTransactionResponse,
} from '../constants/types';
import fetchClient from '../fetch-client';
import { GET_EKA_V2RX_HOST_V2 } from '../fetch-client/helper';

export const processingError: TPatchTransactionError = {
  error: {
    type: '',
    code: 'cancelled_by_user',
    msg: 'Cancelled_by_user',
  },
};

const API_TIMEOUT_MS = 5000;

const patchTransactionStatus = async ({
  sessionId,
  processing_status,
  processing_error,
}: TPatchTransactionRequest): Promise<TPostTransactionResponse> => {
  const controller = new AbortController();

  let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const raw = {
      processing_status,
      processing_error,
    };

    const options = {
      method: 'PATCH',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchClient(
      `${GET_EKA_V2RX_HOST_V2()}/transaction/${sessionId}`,
      options
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    let res = await response.json();
    res = {
      ...res,
      code: response.status,
    };
    return res;
  } catch (error) {
    console.error('Patch transaction status api failed', error);
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
};

export default patchTransactionStatus;
