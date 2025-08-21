import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TPatchVoiceApiV2ConfigRequest,
  TPatchVoiceApiV2ConfigResponse,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V2 } from '../../fetch-client/helper';

const patchVoiceApiV2Config = async (request: TPatchVoiceApiV2ConfigRequest) => {
  try {
    const options = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    };

    const response = await fetchWrapper(`${GET_EKA_VOICE_HOST_V2()}/config/`, options);
    const res = await response.json();

    return {
      ...res,
      code: response.status,
    };
  } catch (error) {
    console.log('Error in getConfigV2 api: ', error);

    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      msg: `Failed to fetch initial configurations, ${error}`,
    } as TPatchVoiceApiV2ConfigResponse;
  }
};

export default patchVoiceApiV2Config;
