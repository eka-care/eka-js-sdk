import { ERROR_CODE } from '../constants/enums';
import { mapTransportError } from '../utils/map-transport-error';
import {
  TPartialResultCallback,
  TPollingResponse,
  TGetStatusApiResponse,
  TGetStatusResponse,
  TChunkTranscriptResponse,
  TFetchChunkTranscriptResult,
} from '../constants/types';
import { ITransport } from '../transport/transport.interface';
import { EkaHosts } from '../transport/hosts';
import { decodeOutputSummaries } from '../utils/template-value';

// NEHA - Should it call protocol get session apis or status apis
export class OutputManager {
  constructor(private transport: ITransport, private hosts: EkaHosts) {}

  async getTemplateOutput({ txn_id }: { txn_id: string }): Promise<TGetStatusResponse> {
    try {
      return await this.fetchV3Status(txn_id);
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to fetch output templates,');
      return { status_code: mapped.status_code, message: mapped.message };
    }
  }

  async getOutputTranscription({ txn_id }: { txn_id: string }): Promise<TGetStatusResponse> {
    try {
      return await this.fetchV3Status(txn_id, 'transcript=true', 15000);
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to fetch output transcription,');
      return { status_code: mapped.status_code, message: mapped.message };
    }
  }

  async getChunkTranscript(
    txnId: string,
    chunkNumber: string
  ): Promise<TFetchChunkTranscriptResult> {
    try {
      const response = await this.transport.request<
        TChunkTranscriptResponse | { error: { code: string } }
      >({
        method: 'GET',
        url: `${this.hosts.voiceV3}/transcript/${txnId}/${chunkNumber}`,
        timeout: 10000,
      });

      if (response.status >= 400) {
        const errorData = response.data as { error?: { code?: string } };
        return { success: false, error: errorData?.error?.code ?? ERROR_CODE.UNKNOWN_ERROR };
      }

      return { success: true, data: response.data as TChunkTranscriptResponse };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to fetch chunk transcript,');
      return { success: false, error: mapped.error_code };
    }
  }

  async pollSessionOutput(request: {
    txn_id: string;
    max_polling_time?: number;
    template_id?: string;
    document_id?: string;
    dlp?: boolean;
    onPartialResultCb?: TPartialResultCallback;
  }): Promise<TPollingResponse> {
    const {
      txn_id,
      max_polling_time = 2 * 60 * 1000,
      template_id,
      document_id,
      dlp,
      onPartialResultCb,
    } = request;

    const createResponse = (
      status_code: number,
      response: TGetStatusApiResponse | null | undefined,
      message: string,
      poll_status: 'timeout' | 'failed' | 'in-progress' | 'success'
    ): TPollingResponse => {
      onPartialResultCb?.({
        txn_id,
        response: response ?? null,
        status_code,
        message,
        poll_status,
      });

      return {
        response: response ?? null,
        status_code,
        errorMessage:
          poll_status === 'success' || poll_status === 'in-progress' ? undefined : message,
      };
    };

    try {
      const maxPollingTimeout = Date.now() + max_polling_time;
      let failedCount = 0;

      onPartialResultCb?.({
        txn_id,
        response: null,
        status_code: 202,
        message: 'Polling for session output summary started',
        poll_status: 'in-progress',
      });

      const buildQueryParams = (): string => {
        const parts: string[] = [];
        if (template_id) parts.push(`template_id=${template_id}`);
        if (document_id) parts.push(`document_id=${document_id}`);
        if (dlp) parts.push(`dlp=true`);
        return parts.join('&');
      };

      const poll = async (): Promise<TPollingResponse> => {
        try {
          const queryParams = buildQueryParams();
          const getResponse = await this.fetchV3Status(txn_id, queryParams, 20000);
          const { status_code, response } = getResponse;

          if (Date.now() >= maxPollingTimeout) {
            return createResponse(500, null, 'Timeout while fetching analysis results.', 'timeout');
          }

          if (status_code === 401 || status_code === 403) {
            return createResponse(
              status_code,
              response ?? null,
              'Unauthorized or Forbidden',
              'failed'
            );
          }

          if (status_code === 202 || status_code === 400 || status_code >= 500) {
            if (status_code === 202 && response) {
              onPartialResultCb?.({
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
                return createResponse(
                  status_code,
                  null,
                  response?.error?.message || 'Backend error while fetching results.',
                  'failed'
                );
              }
            } else {
              failedCount = 0;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
            return poll();
          }

          return createResponse(
            status_code,
            response ?? null,
            'Template results generated successfully.',
            'success'
          );
        } catch (error) {
          return createResponse(-1, null, `Polling error: ${error}`, 'failed');
        }
      };

      return poll();
    } catch (error) {
      return { response: null, status_code: -1, errorMessage: `Polling failed: ${error}` };
    }
  }

  private async fetchV3Status(
    txnId: string,
    queryParams?: string,
    timeout: number = 20000
  ): Promise<TGetStatusResponse> {
    try {
      const url = `${this.hosts.voiceV3}/status/${txnId}${queryParams ? `?${queryParams}` : ''}`;

      const response = await this.transport.request<TGetStatusApiResponse>({
        method: 'GET',
        url,
        timeout,
      });

      const decodedResponse = this.decodeStatusResponse(response.data);

      return {
        response: decodedResponse,
        status_code: response.status,
      };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to fetch status,');
      return { status_code: mapped.status_code, message: mapped.message };
    }
  }

  private decodeStatusResponse(apiResponse: TGetStatusApiResponse): TGetStatusApiResponse {
    if (!apiResponse?.data) return apiResponse;

    const { data } = apiResponse;

    return {
      ...apiResponse,
      data: {
        ...data,
        output: decodeOutputSummaries(data.output),
        template_results: {
          ...(data.template_results ?? {}),
          integration: decodeOutputSummaries(data.template_results?.integration),
          custom: decodeOutputSummaries(data.template_results?.custom),
          transcript: decodeOutputSummaries(data.template_results?.transcript),
        },
      },
    };
  }
}
