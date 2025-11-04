import postTransactionInit from '../api/transaction/post-transaction-init';
import { SDK_STATUS_CODE } from '../constants/constant';
import { CALLBACK_TYPE, ERROR_CODE } from '../constants/enums';
import { TStartRecordingRequest, TStartRecordingResponse } from '../constants/types';
import { GET_S3_BUCKET_NAME } from '../fetch-client/helper';
import EkaScribeStore from '../store/store';

const initialiseTransaction = async (
  request: TStartRecordingRequest
): Promise<TStartRecordingResponse> => {
  try {
    const { txn_id } = request;
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
    const sessionStatus = EkaScribeStore.sessionStatus;
    const onEventCallback = EkaScribeStore.eventCallback;
    let businessID = '';
    let userOID = '';
    let userUUID = '';

    if (
      !sessionStatus[txn_id] ||
      Object.keys(sessionStatus[txn_id]).length === 0 ||
      sessionStatus[txn_id].api?.status === 'na'
    ) {
      EkaScribeStore.txnID = txn_id;
      // File path calculation
      const date = new Date();
      // Format date to YYYYMMDD
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().substring(2);
      // s3 file path format: <date>/txnID
      const filePath = `${year}${month}${day}/${txn_id}`;
      EkaScribeStore.sessionBucketPath = filePath;

      const txnInitResponse = await postTransactionInit({
        ...request,
        s3Url: `s3://${GET_S3_BUCKET_NAME()}/${filePath}`,
      });

      const {
        code: txnInitStatusCode,
        b_id: businessId,
        oid,
        uuid,
        message: txnInitMessage,
        error: txnInitError,
      } = txnInitResponse;

      if (onEventCallback) {
        onEventCallback({
          callback_type: CALLBACK_TYPE.TRANSACTION_STATUS,
          status: 'info',
          message: `Transaction init status: ${txnInitStatusCode}`,
          timestamp: new Date().toISOString(),
        });
      }

      if (txnInitStatusCode === 400 && txnInitError?.code === ERROR_CODE.TXN_LIMIT_EXCEEDED) {
        return {
          error_code: ERROR_CODE.TXN_LIMIT_EXCEEDED,
          status_code: txnInitStatusCode,
          message: txnInitMessage || 'Transaction limit exceeded.',
        };
      }

      if (txnInitStatusCode >= 400) {
        return {
          error_code: ERROR_CODE.TXN_INIT_FAILED,
          status_code: txnInitStatusCode,
          message: txnInitMessage || 'Transaction initialization failed.',
        };
      }

      EkaScribeStore.sessionStatus[txn_id] = {
        api: {
          status: 'init',
          code: txnInitStatusCode,
          response: txnInitMessage,
        },
      };
      businessID = businessId;
      userOID = oid;
      userUUID = uuid;

      fileManagerInstance?.setSessionInfo({
        sessionId: txn_id,
        filePath: filePath,
        businessID: businessId,
      });
    }

    return {
      message: 'Transaction initialized successfully.',
      status_code: SDK_STATUS_CODE.SUCCESS,
      business_id: businessID,
      oid: userOID,
      uuid: userUUID,
      txn_id,
    };
  } catch (err) {
    console.error('%c Line:102 🍇 initialiseTransaction err', 'color:#b03734', err);
    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `An error occurred in initializing the transaction: ${err}`,
    };
  }
};

export default initialiseTransaction;
