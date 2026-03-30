import { SDK_STATUS_CODE } from '../../constants/constant';
import { TDeleteTransactionResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V2 } from '../../fetch-client/helper';

const deleteTransaction = async ({
  txn_id,
}: {
  txn_id: string;
}): Promise<TDeleteTransactionResponse> => {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'DELETE',
      headers,
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V2()}/transaction/${txn_id}`,
      options
    );

    const res = await response.json();

    return {
      ...res,
      code: response.status,
    };
  } catch (error) {
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong in deleting transaction. ${error}`,
    };
  }
};

export default deleteTransaction;
