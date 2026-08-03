import { TransportError } from '../transport/http-transport';
import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';

export interface MappedError {
  error_code: ERROR_CODE;
  status_code: number;
  message: string;
}

const HTTP_NOT_FOUND = 404;
const HTTP_REQUEST_TIMEOUT = 408;

/** Statuses with a specific meaning; anything else is classified by range. */
const STATUS_ERRORS: Record<number, { error_code: ERROR_CODE; detail: string }> = {
  [SDK_STATUS_CODE.UNAUTHORIZED]: {
    error_code: ERROR_CODE.UNAUTHORIZED,
    detail: 'Authentication failed. Token may be expired.',
  },
  [SDK_STATUS_CODE.FORBIDDEN]: {
    error_code: ERROR_CODE.FORBIDDEN,
    detail: 'Access forbidden.',
  },
  [HTTP_NOT_FOUND]: {
    error_code: ERROR_CODE.NOT_FOUND,
    detail: 'Requested resource not found.',
  },
  [HTTP_REQUEST_TIMEOUT]: {
    error_code: ERROR_CODE.NETWORK_ERROR,
    detail: 'Request timed out.',
  },
};

/** 4xx blames the request, 5xx the server. */
function classifyStatus(status: number, serverMessage: string): Omit<MappedError, 'status_code'> {
  const known = STATUS_ERRORS[status];
  if (known) {
    return { error_code: known.error_code, message: known.detail };
  }

  return {
    error_code:
      status >= 400 && status < 500 ? ERROR_CODE.BAD_REQUEST : ERROR_CODE.INTERNAL_SERVER_ERROR,
    message: serverMessage,
  };
}

/** The server's own error code from the response body, if it sent one. */
export function serverErrorCode(error: unknown): string | undefined {
  if (!(error instanceof TransportError)) {
    return undefined;
  }

  return (error.body as { error?: { code?: string } } | undefined)?.error?.code;
}

/** True for failures where the request never produced an HTTP response. */
function networkFailureDetail(error: unknown): string | null {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Request aborted (timeout).';
  }

  if (
    error instanceof TypeError &&
    (error.message.includes('fetch') || error.message.includes('network'))
  ) {
    return 'Network error.';
  }

  return null;
}

/** `fallbackMessage` names the failed operation and prefixes every message. */
export function mapTransportError(error: unknown, fallbackMessage: string): MappedError {
  if (error instanceof TransportError) {
    const { error_code, message } = classifyStatus(error.status, error.message);
    return { error_code, status_code: error.status, message: `${fallbackMessage} ${message}` };
  }

  const networkDetail = networkFailureDetail(error);
  if (networkDetail) {
    return {
      error_code: ERROR_CODE.NETWORK_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `${fallbackMessage} ${networkDetail}`,
    };
  }

  return {
    error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
    status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
    message: `${fallbackMessage} ${error}`,
  };
}
