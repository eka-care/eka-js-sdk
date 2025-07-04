import postTransactionInit from '../api/post-transaction-init';
import { S3_BUCKET_NAME } from '../constants/audio-constants';
import { ERROR_CODE } from '../constants/enums';
import { TStartRecordingRequest, TStartRecordingResponse } from '../constants/types';
import EkaScribeStore from '../store/store';
import { v4 as uuidv4 } from 'uuid';

const startVoiceRecording = async ({
  mode,
  input_language,
  output_format_template,
}: TStartRecordingRequest): Promise<TStartRecordingResponse> => {
  try {
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

    const txnID = 'ce-' + uuidv4();
    EkaScribeStore.txnID = txnID;
    // File path calculation
    const currDate = new Date();
    const date = currDate.toISOString();
    EkaScribeStore.date = date;
    // Format date to YYYYMMDD
    const day = currDate.getDate().toString().padStart(2, '0');
    const month = (currDate.getMonth() + 1).toString().padStart(2, '0');
    const year = currDate.getFullYear().toString().substring(2);
    // s3 file path format: <date>/txnID
    const filePath = `${year}${month}${day}/${txnID}`;
    EkaScribeStore.sessionBucketPath = filePath;

    const txnInitResponse = await postTransactionInit({
      mode,
      txnId: txnID,
      s3Url: `s3://${S3_BUCKET_NAME}/${EkaScribeStore.sessionBucketPath}`,
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

    fileManagerInstance?.setSessionInfo({
      date: filePath,
      sessionId: txnID,
      filePath: filePath,
      businessID: businessId,
    });

    // TODO: return if vad is still loading or throws error - go through github doc
    // const micVad = vadInstance?.getMicVad();
    // if (micVad.errored) {
    //   return {
    //     vad_error: 'Microphone access not granted. Please check access in your system settings.',
    //   };
    // }

    vadInstance?.startVad();

    return {
      message: 'Recording started successfully.',
      status_code: 200,
      business_id: businessId,
      txn_id: txnID,
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
