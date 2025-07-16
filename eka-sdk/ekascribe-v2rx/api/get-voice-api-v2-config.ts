import { TGetConfigV2Response } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_V2RX_HOST_V2 } from '../fetch-client/helper';

export const getConfigV2 = async (): Promise<TGetConfigV2Response> => {
  try {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetchWrapper(`${GET_EKA_V2RX_HOST_V2()}/config/`, options);
    const res = await response.json();

    return {
      ...res,
      code: response.status,
    };
  } catch (error) {
    console.log('Returning hardcoded settings in getConfig api: ', error);

    return {
      code: 520,
      message: `Failed to fetch initisl configurations, ${error}`,
    } as TGetConfigV2Response;
  }
};
