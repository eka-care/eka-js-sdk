import {
  getVoiceApiV3Status,
  TGetStatusApiResponse,
} from '../api/transaction/get-voice-api-v3-status';
import EkaScribeStore from '../store/store';

export type TPollingResponse = {
  response?: TGetStatusApiResponse | null;
  status_code: number;
  errorMessage?: string;
  errorCode?: string;
};

import { TPartialResultCallback } from '../constants/types';

export const pollOutputSummary = async ({
  txn_id,
  max_polling_time = 2 * 60 * 1000,
  template_id,
  onPartialResultCb,
}: {
  txn_id: string;
  max_polling_time?: number;
  template_id?: string;
  onPartialResultCb?: TPartialResultCallback;
}): Promise<TPollingResponse> => {
  // Use passed callback, fallback to store callback for backwards compatibility
  const onPartialResultCallback = onPartialResultCb ?? EkaScribeStore.partialResultCallback;

  const createResponse = (
    status_code: number,
    response: TGetStatusApiResponse | null | undefined,
    message: string,
    poll_status: 'timeout' | 'failed' | 'in-progress' | 'success'
  ): TPollingResponse => {
    const result: TPollingResponse = {
      response: response ?? null,
      status_code,
      errorMessage:
        poll_status === 'success' || poll_status === 'in-progress' ? undefined : message,
    };

    onPartialResultCallback?.({
      txn_id,
      response: response ?? null,
      status_code,
      message,
      poll_status,
    });

    return result;
  };

  try {
    const time = new Date().getTime();
    const maxPollingTimeout = time + max_polling_time;

    let failedCount = 0;

    onPartialResultCallback?.({
      txn_id,
      response: null,
      status_code: 202,
      message: 'Polling for session output summary started',
      poll_status: 'in-progress',
    });

    const getSummary = async (queryParams?: string) => {
      // this try-catch block is needed to handle the errors of this recursive call
      try {
        const getResponse = await getVoiceApiV3Status({ txnId: txn_id, queryParams });

        const { status_code, response } = getResponse;

        const currentTime = new Date().getTime();

        if (currentTime >= maxPollingTimeout) {
          const errorMessage =
            'We encountered an error while fetching analysis results due to timeout. Please try again.';

          return createResponse(500, null, errorMessage, 'timeout');
        }

        if (status_code === 401 || status_code === 403) {
          return createResponse(status_code, response, 'Unauthorized or Forbidden', 'failed');
        }

        if (status_code === 202 || status_code === 400 || status_code >= 500) {
          // callback to pass processed templates
          if (status_code === 202 && response) {
            onPartialResultCallback?.({
              txn_id,
              response,
              status_code,
              message: 'Partial result received',
              poll_status: 'in-progress',
            });
          }

          if (status_code >= 400) {
            failedCount++;

            if (failedCount >= 3) {
              const errorMessage =
                response?.error?.msg ||
                'We encountered a backend error while fetching results. Please try again.';

              return createResponse(status_code, null, errorMessage, 'failed');
            }
          } else {
            failedCount = 0;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return getSummary(template_id ? `template_id=${template_id}` : '');
        }

        return createResponse(
          status_code,
          response,
          'Template results generated successfully. Polling for this session is complete.',
          'success'
        );
      } catch (error) {
        return createResponse(
          -1,
          null,
          `Something went wrong from inside catch block. ${error}`,
          'failed'
        );
      }
    };

    return getSummary(template_id ? `template_id=${template_id}` : '');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return createResponse(-1, null, 'Request was aborted due to timeout.', 'timeout');
    }

    return createResponse(
      -1,
      null,
      `Something went wrong from outer catch block, ${error}`,
      'failed'
    );
  }
};
