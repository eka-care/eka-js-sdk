import {
  CONSULTATION_MODES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_OUTPUT_FORMATS,
} from '../constants/setup-config';
import { TGetConfigV2Response } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_V2RX_HOST } from '../fetch-client/helper';

export const getConfigV2 = async (): Promise<TGetConfigV2Response> => {
  try {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetchWrapper(`${GET_EKA_V2RX_HOST()}/voice/api/v2/config/`, options);
    const res = await response.json();

    if (!res.data || Object.keys(res.data).length === 0) {
      throw new Error('No data found in response');
    }

    return res;
  } catch (error) {
    // Return hardcoded values as fallback
    console.log('Returning hardcoded settings in getConfig api: ', error);

    return {
      data: {
        supported_languages: SUPPORTED_LANGUAGES,
        supported_output_formats: SUPPORTED_OUTPUT_FORMATS,
        consultation_modes: CONSULTATION_MODES,
        max_selection: {
          languages: 2,
          output_formats: 2,
          consultation_mode: 1,
        },
      },
    };
  }
};
