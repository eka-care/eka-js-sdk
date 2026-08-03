import type { ScribeError, SDKResult } from 'med-scribe-alliance-ts-sdk';
import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';
import { MappedError } from './map-transport-error';

/**
 * Map a failed alliance result. A missing `httpStatus` means no response was
 * received, so it falls back to INTERNAL_SERVER_ERROR — never 200.
 */
export function mapAllianceError(
  error: ScribeError,
  fallbackErrorCode: ERROR_CODE,
  fallbackMessage: string
): MappedError {
  return {
    error_code: allianceErrorCode(error, fallbackErrorCode),
    status_code: error.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
    message: error.message || fallbackMessage,
  };
}

/**
 * Status for an operation already confirmed successful. The alliance SDK omits
 * `httpStatus` when no HTTP round trip happened, so 200 is right here.
 * Never use it to decide *whether* something succeeded — that fabricates 200s.
 */
export function confirmedSuccessStatus(result: { httpStatus?: number }): number {
  return result.httpStatus ?? SDK_STATUS_CODE.SUCCESS;
}

/** Status code for an alliance result that is passed through to the caller as-is. */
export function allianceResultStatus(result: SDKResult<unknown>): number {
  return result.success
    ? confirmedSuccessStatus(result)
    : result.error.httpStatus ?? SDK_STATUS_CODE.INTERNAL_SERVER_ERROR;
}

function allianceErrorCode(error: ScribeError, fallbackErrorCode: ERROR_CODE): ERROR_CODE {
  if (error.code === 'txn_limit_exceeded') {
    return ERROR_CODE.TXN_LIMIT_EXCEEDED;
  }

  if (error.httpStatus === SDK_STATUS_CODE.UNAUTHORIZED) {
    return ERROR_CODE.UNAUTHORIZED;
  }

  if (error.httpStatus === SDK_STATUS_CODE.FORBIDDEN) {
    return ERROR_CODE.FORBIDDEN;
  }

  return fallbackErrorCode;
}
