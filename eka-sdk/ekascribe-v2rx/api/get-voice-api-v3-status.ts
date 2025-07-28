import { SDK_STATUS_CODE } from '../constants/constant';
import fetchWrapper from '../fetch-client';
import { GET_EKA_V2RX_HOST_V3 } from '../fetch-client/helper';

export type TTemplateMessage = {
  type: 'warning' | 'error';
  code?: string;
  msg: string;
};

export type TOutputSummary = {
  template_id: string;
  value?: string | null; //<base 64 encoded>
  type: string;
  name: string;
  status: TTemplateStatus;
  errors?: TTemplateMessage[];
  warnings?: TTemplateMessage[];
};

export type TTemplateStatus = 'success' | 'partial_success' | 'failure';

type TAdditionalData = {
  doctor: {
    _id: string;
    profile: {
      personal: {
        name: {
          l: string;
          f: string;
        };
      };
    };
  };
};

type TApiResponse = {
  data: {
    output?: TOutputSummary[];
    additional_data?: TAdditionalData;
    meta_data?: {
      total_resources?: number;
      total_parsed_resources?: number;
    };
  };
  error?: {
    code: string;
    msg: string;
  };
};

export type TGetStatusResponse = {
  response?: TApiResponse | null;
  code: number;
  message?: string;
};

const API_TIMEOUT_MS = 16000;

export const getVoiceApiV2Status = async ({
  txnId,
}: {
  txnId: string;
}): Promise<TGetStatusResponse> => {
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
    };

    const getResponse = await fetchWrapper(`${GET_EKA_V2RX_HOST_V3()}/status/${txnId}`, options);

    const response = await getResponse.json();

    return {
      response,
      code: getResponse.status,
    };
  } catch (error) {
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
};
