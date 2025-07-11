import postTransactionInit from '../api/post-transaction-init';
import { S3_BUCKET_NAME } from '../constants/audio-constants';
import { ERROR_CODE } from '../constants/enums';
import { TStartRecordingRequest, TStartRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';

const startVoiceRecording = async ({
  mode,
  input_language,
  output_format_template,
  txn_id,
}: TStartRecordingRequest): Promise<TStartRecordingResponse> => {
  try {
    if (!mode || !input_language || !output_format_template || !txn_id) {
      return {
        error_code: ERROR_CODE.INVALID_REQUEST,
        status_code: 400,
        message:
          'Invalid request parameters. Please provide mode, input_language, output_format_template, and txn_id.',
      };
    }

    const vadInstance = EkaScribeStore.vadInstance;
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;

    const navigatorPermissionResponse = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });

    if (
      navigatorPermissionResponse.state === 'denied' ||
      navigatorPermissionResponse.state === 'prompt'
    ) {
      return {
        error_code: ERROR_CODE.MICROPHONE,
        status_code: 403,
        message:
          'Microphone access not granted. Please go to your browser or site settings to provide access.',
      };
    }

    const sessionStatus = EkaScribeStore.sessionStatus;
    let businessID = '';
    if (
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
        mode,
        txnId: txn_id,
        s3Url: `s3://${S3_BUCKET_NAME}/${filePath}`,
        input_language,
        output_format_template,
      });

      const {
        code: txnInitStatusCode,
        b_id: businessId,
        message: txnInitMessage,
        error: txnInitError,
      } = txnInitResponse;

      if (txnInitStatusCode === 400 && txnInitError?.code === ERROR_CODE.TXN_LIMIT_EXCEEDED) {
        return {
          error_code: ERROR_CODE.TXN_LIMIT_EXCEEDED,
          status_code: txnInitStatusCode,
          message: txnInitMessage || 'Transaction limit exceeded.',
        };
      }

      if (txnInitStatusCode != 200) {
        return {
          error_code: ERROR_CODE.TXN_INIT_FAILED,
          status_code: txnInitStatusCode,
          message: txnInitMessage || 'Transaction initialization failed.',
        };
      }

      sessionStatus[txn_id] = {
        api: {
          status: 'init',
          code: txnInitStatusCode,
          response: txnInitMessage,
        },
      };
      EkaScribeStore.sessionStatus = sessionStatus;
      businessID = businessId;

      fileManagerInstance?.setSessionInfo({
        sessionId: txn_id,
        filePath: filePath,
        businessID: businessId,
      });
    }

    // TODO: return if vad is still loading or throws error - how to detect error - go through github doc
    // const micVad = vadInstance?.getMicVad();
    // if (micVad.errored) {
    //   return {
    //     vad_error: 'Microphone access not granted. Please check access in your system settings.',
    //   };
    // }

    vadInstance?.startVad();
    EkaScribeStore.sessionStatus[txn_id] = {
      ...EkaScribeStore.sessionStatus[txn_id],
      vad: {
        status: 'start',
      },
    };

    return {
      message: 'Recording started successfully.',
      status_code: 200,
      business_id: businessID,
      txn_id,
    };
  } catch (err) {
    console.log('%c Line:102 🍇 startRecording err', 'color:#b03734', err);
    return {
      error_code: ERROR_CODE.UNKNOWN_ERROR,
      status_code: 520,
      message: `An error occurred while starting the recording: ${err}`,
    };
  }
};

export default startVoiceRecording;
