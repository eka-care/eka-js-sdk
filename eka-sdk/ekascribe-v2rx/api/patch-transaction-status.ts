import {
  TPatchTransactionError,
  TPatchTransactionRequest,
  TPostTransactionResponse,
} from '../constants/types';
import fetchClient from '../fetch-client';
import { GET_EKA_V2RX_HOST } from '../fetch-client/helper';

export const processingError: TPatchTransactionError = {
  error: {
    type: '',
    code: 'cancelled_by_user',
    msg: 'Cancelled_by_user',
  },
};

const patchTransactionStatus = async ({
  sessionId,
  processing_status,
  processing_error,
}: TPatchTransactionRequest): Promise<TPostTransactionResponse> => {
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

    const response = await fetchClient(`${GET_EKA_V2RX_HOST()}/transaction/${sessionId}`, options);

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const res = await response.json();

    return res;
  } catch (error) {
    console.error('Patch transaction status api failed', error);
    return {
      code: 520,
      message: `Something went wrong! ${error}`,
    } as TPostTransactionResponse;
  }
};

export default patchTransactionStatus;
