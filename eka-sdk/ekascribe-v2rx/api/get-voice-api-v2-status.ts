import { RESULT_STATUS, TEMPLATE_ID } from '../constants/enum';
import fetchClient from '../fetch-client';
import { GET_EKA_V2RX_HOST } from '../fetch-client/helper';

export type TOutputSummary = {
  template_id: TEMPLATE_ID;
  value: string; //<base 64 encoded>
  type: string;
  name: string;
};

type TStatusApiResponse = {
  data?: {
    output: TOutputSummary[];
  };
  status?: RESULT_STATUS;
  error?: string;
};

export const getVoiceApiV2Status = async ({
  txnId,
}: {
  txnId: string;
}): Promise<TStatusApiResponse> => {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    let attempts = 0;
    const maxAttempts = 60;

    const options = {
      method: 'GET',
      headers,
    };

    const getSummary = async () => {
      const getResponse = await fetchClient(`${GET_EKA_V2RX_HOST()}/status/${txnId}`, options);
      const response = await getResponse.json();

      if (response.status === RESULT_STATUS.SUCCESS || response.status === RESULT_STATUS.FAILURE) {
        return response;
      }

      if (response.status === RESULT_STATUS.IN_PROGRESS) {
        if (attempts >= maxAttempts) {
          return response;
        }
        attempts++;
        return getSummary();
      }

      return response;
    };

    return getSummary();
  } catch (error) {
    console.error('getVoiceApiV2Status =>', error);
    return {
      error: error as string,
    };
  }
};
