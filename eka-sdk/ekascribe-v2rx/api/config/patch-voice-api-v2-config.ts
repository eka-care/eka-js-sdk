import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TPatchVoiceApiV2ConfigRequest,
  TPatchVoiceApiV2ConfigResponse,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V2 } from '../../fetch-client/helper';

const putVoiceApiV2Config = async (request: TPatchVoiceApiV2ConfigRequest) => {
  try {
    const options = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    };

    const queryParams = request.query_params ? `?${request.query_params}` : '';

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V2()}/config/${queryParams}`,
      options
    );
    const res = await response.json();

    return {
      ...res,
      code: response.status,
    };
  } catch (error) {
    console.error('Error in getConfigV2 api: ', error);

    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      msg: `Failed to fetch initial configurations, ${error}`,
    } as TPatchVoiceApiV2ConfigResponse;
  }
};

export default putVoiceApiV2Config;
