import { SDK_STATUS_CODE } from '../../constants/constant';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V3 } from '../../fetch-client/helper';
import { decodeOutputSummaries, TTemplateValue } from '../../utils/template-value';

export type TTemplateMessage = {
  type: 'warning' | 'error';
  code?: string;
  msg: string;
};

export type TOutputSummary = {
  template_id: string;
  value?: TTemplateValue; // decoded value sent to client
  type: string;
  name: string;
  lang?: string;
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
    output: TOutputSummary[];
    audio_matrix?: {
      quality: string;
    };
    additional_data?: TAdditionalData;
    meta_data?: {
      total_resources?: number;
      total_parsed_resources?: number;
    };
    created_at?: string;
    template_results: {
      integration: TOutputSummary[];
      custom: TOutputSummary[];
      transcript: TOutputSummary[];
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

const decodeApiResponse = (apiResponse: TApiResponse): TApiResponse => {
  if (!apiResponse?.data) return apiResponse;

  const { data } = apiResponse;

  return {
    ...apiResponse,
    data: {
      ...data,
      output: decodeOutputSummaries(data.output),
      template_results: {
        ...data.template_results,
        integration: decodeOutputSummaries(data.template_results?.integration),
        custom: decodeOutputSummaries(data.template_results?.custom),
        transcript: decodeOutputSummaries(data.template_results?.transcript),
      },
    },
  };
};

export const getVoiceApiV3StatusTranscript = async ({
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
      `${GET_EKA_VOICE_HOST_V3()}/status/transcript/${txnId}`,
      options,
      16000
    );

    const response = (await getResponse.json()) as TApiResponse;
    const decodedResponse = decodeApiResponse(response);

    return {
      response: decodedResponse,
      status_code: getResponse.status,
    };
  } catch (error) {
    return {
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    };
  }
};
