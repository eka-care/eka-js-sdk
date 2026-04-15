import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V3 } from '../../fetch-client/helper';

export type TChunkTranscriptResponse = {
  text: string;
  confidence: number;
  segments: unknown[];
  audio_length: number;
  audio_quality: string;
  metadata: {
    model_id: string;
    commit_id: string;
    context_used: unknown[];
    lang_input: string[];
    lang_output: string;
    task: string | null;
  };
};

type TChunkTranscriptErrorResponse = {
  status: 'failed';
  error: {
    code: string;
    message: string;
    display_message: string;
  };
  txn_id: string;
  b_id: string;
};

export type TFetchChunkTranscriptResult =
  | { success: true; data: TChunkTranscriptResponse }
  | { success: false; error: string };

const REQUEST_TIMEOUT_MS = 10000;

const fetchChunkTranscript = async (
  txnId: string,
  chunkNumber: string
): Promise<TFetchChunkTranscriptResult> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V3()}/transcript/${txnId}/${chunkNumber}`,
      { method: 'GET', signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = (await response.json()) as TChunkTranscriptErrorResponse;
      return { success: false, error: errorData?.error?.code ?? 'unknown_error' };
    }

    const data = (await response.json()) as TChunkTranscriptResponse;
    return { success: true, data };
  } catch {
    return { success: false, error: 'network_error' };
  }
};

export default fetchChunkTranscript;
