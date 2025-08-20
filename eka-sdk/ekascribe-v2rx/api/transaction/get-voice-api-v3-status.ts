import { SDK_STATUS_CODE } from '../../constants/constant';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V3 } from '../../fetch-client/helper';

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
  status_code: number;
  message?: string;
};

export const getVoiceApiV3Status = async ({
  txnId,
}: {
  txnId: string;
}): Promise<TGetStatusResponse> => {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'GET',
      headers,
    };

    // Use custom timeout for this API (16 seconds instead of default 5 seconds)
    const getResponse = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V3()}/status/${txnId}`,
      options,
      16000
    );

    const response = await getResponse.json();

    return {
      response,
      status_code: getResponse.status,
    };
  } catch (error) {
    return {
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    };
  }
};
