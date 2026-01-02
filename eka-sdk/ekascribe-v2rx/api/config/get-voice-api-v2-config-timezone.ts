import { SDK_STATUS_CODE } from '../../constants/constant';
import { TGetConfigV2TimezoneResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V2 } from '../../fetch-client/helper';

export const getConfigV2Timezone = async ({
  timezone,
}: {
  timezone: string;
}): Promise<TGetConfigV2TimezoneResponse> => {
  try {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V2()}/config/?timezone=${timezone}`,
      options
    );
    const res = await response.json();

    return {
      ...res,
      code: response.status,
    };
  } catch (error) {
    console.error('Error in getConfigV2Timezone api: ', error);

    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Failed to fetch timezone configurations, ${error}`,
    } as TGetConfigV2TimezoneResponse;
  }
};
