import { TransportError } from '../transport/http-transport';
import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';

export interface MappedError {
  error_code: ERROR_CODE;
  status_code: number;
  message: string;
}

export function mapTransportError(error: unknown, fallbackMessage: string): MappedError {
  if (error instanceof TransportError) {
    if (error.status === 401) {
      return {
        error_code: ERROR_CODE.UNAUTHORIZED,
        status_code: SDK_STATUS_CODE.UNAUTHORIZED,
        message: 'Authentication failed. Token may be expired.',
      };
    }

    if (error.status === 403) {
      return {
        error_code: ERROR_CODE.FORBIDDEN,
        status_code: SDK_STATUS_CODE.FORBIDDEN,
        message: 'Access forbidden.',
      };
    }

    if (error.status === 408) {
      return {
        error_code: ERROR_CODE.NETWORK_ERROR,
        status_code: error.status,
        message: `${fallbackMessage} Request timed out.`,
      };
    }

    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: error.status,
      message: `${fallbackMessage} ${error.message}`,
    };
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      error_code: ERROR_CODE.NETWORK_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `${fallbackMessage} Request aborted (timeout).`,
    };
  }

  if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
    return {
      error_code: ERROR_CODE.NETWORK_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `${fallbackMessage} Network error.`,
    };
  }

  return {
    error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
    status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
    message: `${fallbackMessage} ${error}`,
  };
}
