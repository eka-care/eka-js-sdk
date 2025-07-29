import { SDK_STATUS_CODE } from '../constants/constant';
import { TGetTransactionHistoryResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_V2RX_HOST_V2 } from '../fetch-client/helper';

// TODO: pagination changes

const API_TIMEOUT_MS = 5000;

const getTransactionHistory = async ({
  txn_count,
}: {
  txn_count: number;
}): Promise<TGetTransactionHistoryResponse> => {
  const controller = new AbortController();

  let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'GET',
      headers,
      signal: controller.signal,
    };

    const responseJson = await fetchWrapper(
      `${GET_EKA_V2RX_HOST_V2()}/transaction/history?count=${txn_count}`,
      options
    );

    const response = await responseJson.json();

    return {
      data: response.data,
      code: responseJson.status,
      message: `Past ${txn_count} transactions fetched successfully.`,
    };
  } catch (error) {
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong in fetching transactions. ${error}`,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
};

export default getTransactionHistory;
