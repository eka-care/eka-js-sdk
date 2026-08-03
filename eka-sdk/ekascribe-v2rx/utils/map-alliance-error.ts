import type { ScribeError, SDKResult } from 'med-scribe-alliance-ts-sdk';
import { SDK_STATUS_CODE } from '../constants/constant';
import { ERROR_CODE } from '../constants/enums';
import { MappedError } from './map-transport-error';

/** Missing `httpStatus` means no response arrived — falls back to 1005, never 200. */
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

/** For already-confirmed success only. Using it to *decide* success fabricates 200s. */
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
