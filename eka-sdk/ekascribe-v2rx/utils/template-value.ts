import { TEMPLATE_TYPE } from '../constants/enums';

const safeJsonParse = (input: string) => {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

// Minimal, Unicode-safe base64 decode usable in browser or Node.
export const decodeUnicodeBase64 = (str: string): string => {
  try {
    // Step 1: Use built-in atob for base64 decoding
    const binaryString = atob(str);

    // Step 2: Create a Uint8Array from the binary string
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Step 3: Use TextDecoder to properly decode UTF-8 characters
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (error) {
    console.error('Error decoding base64 string:', error);
    return '';
  }
};

export const processStructuredSummaryData = (type: string, value?: string | null) => {
  if (!value || value.trim() === '') return null;

  const decoded = decodeUnicodeBase64(value);

  switch (type) {
    case TEMPLATE_TYPE.JSON:
      return safeJsonParse(decoded);
    case TEMPLATE_TYPE.TRANSCRIPT:
    case TEMPLATE_TYPE.MARKDOWN:
      return decoded;
    default:
      return safeJsonParse(decoded);
  }
};

export const decodeOutputSummaries = <T extends { type: string; value?: unknown }>(
  summaries?: Array<T>
): Array<T> => {
  if (!summaries?.length) return [];

  return summaries.map((summary) => {
    const { value } = summary;
    if (typeof value !== 'string') return { ...summary, value: value ?? null };

    return {
      ...summary,
      value: processStructuredSummaryData(summary.type, value),
    };
  });
};
