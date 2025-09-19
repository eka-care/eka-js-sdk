import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TPatchVoiceApiV3StatusRequest,
  TPatchVoiceApiV3StatusResponse,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V3 } from '../../fetch-client/helper';

export const patchVoiceApiV3Status = async ({
  txnId,
  data,
}: TPatchVoiceApiV3StatusRequest): Promise<TPatchVoiceApiV3StatusResponse> => {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    };

    // Use custom timeout for this API (16 seconds instead of default 5 seconds)
    const getResponse = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V3()}/status/${txnId}`,
      options,
      30000
    );

    const response = await getResponse.json();

    return {
      ...response,
      code: getResponse.status,
    };
  } catch (error) {
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPatchVoiceApiV3StatusResponse;
  }
};
