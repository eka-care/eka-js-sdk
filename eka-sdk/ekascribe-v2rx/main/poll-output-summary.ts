import { getVoiceApiV3Status, TOutputSummary } from '../api/transaction/get-voice-api-v3-status';

interface IError {
  code: string;
  msg: string;
}

interface IADDITIONAL_DATA {
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
}

interface IApiResponse {
  data: {
    output: TOutputSummary[];
    additional_data?: IADDITIONAL_DATA;
    meta_data?: {
      total_resources?: number;
      total_parsed_resources?: number;
    };
    audio_matrix?: { quality: string };
    created_at?: string;
    template_results: {
      integration: TOutputSummary[];
      custom: TOutputSummary[];
      transcript?: TOutputSummary[];
    };
  };
  error?: IError;
}

export type TPollingResponse = {
  response?: IApiResponse | null;
  status_code: number;
  errorMessage?: string;
  errorCode?: string;
};

export const pollOutputSummary = async ({
  txn_id,
  max_polling_time = 2 * 60 * 1000,
}: {
  txn_id: string;
  max_polling_time?: number;
}): Promise<TPollingResponse> => {
  try {
    const time = new Date().getTime();
    const maxPollingTimeout = time + max_polling_time;

    let failedCount = 0;

    const getSummary = async () => {
      // this try-catch block is needed to handle the errors of this recursive call
      try {
        const getResponse = await getVoiceApiV3Status({ txnId: txn_id });

        const { status_code, response } = getResponse;

        const currentTime = new Date().getTime();

        if (currentTime >= maxPollingTimeout) {
          const errorMessage =
            'We encountered an error while fetching analysis results due to timeout. Please try again.';
          return {
            status_code: 500,
            errorMessage,
          };
        }

        if (status_code === 401 || status_code === 403) {
          return {
            response,
            status_code,
            errorMessage: 'Unauthorized or Forbidden',
          };
        }

        if (status_code === 202 || status_code === 400 || status_code >= 500) {
          if (status_code >= 400) {
            failedCount++;
            if (failedCount >= 3) {
              return {
                response,
                status_code,
                errorMessage:
                  response?.error?.msg ||
                  `We encountered a backend error while fetching results. Please try again.`,
              };
            }
          } else {
            failedCount = 0;
          }
          // await new Promise((resolve) => setTimeout(resolve, 1000));
          return getSummary();
        }

        return {
          response,
          status_code,
        };
      } catch (error) {
        return {
          status_code: -1, // -1: non-https status_code to distinguish backend's 500 status_code
          errorMessage: `Something went wrong from inside catch block. ${error}`,
        };
      }
    };
    return getSummary();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status_code: -1,
        errorMessage: 'Request was aborted due to timeout.',
      };
    }
    return {
      status_code: -1,
      errorMessage: `Something went wrong from outer catch block, ${error}`,
    };
  }
};
