import { SDK_STATUS_CODE } from '../constants/constant';
import { API_STATUS, ERROR_CODE } from '../constants/enums';
import { TStartRecordingResponse } from '../constants/types';
import setEnv from '../fetch-client/helper';
import EkaScribeStore from '../store/store';
import { addBreadcrumb, captureEvent } from '../sentry/index';
import startVoiceRecording from './start-recording';

export type TStartRecordingForExistingSessionRequest = {
  txn_id: string;
  business_id: string;
  created_at: number;
  microphoneID?: string;
  sharedWorkerUrl?: string;
  flavour?: string;
};

// created_at is Unix epoch in seconds. Returns "YYMMDD/<txn_id>".
const buildSessionBucketPath = (createdAt: number, txnId: string): string => {
  const date = new Date(createdAt * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().substring(2);
  return `${year}${month}${day}/${txnId}`;
};

const startRecordingForExistingSession = async ({
  txn_id,
  business_id,
  created_at,
  microphoneID,
  flavour,
}: TStartRecordingForExistingSessionRequest): Promise<TStartRecordingResponse> => {
  try {
    const session_bucket_path = buildSessionBucketPath(created_at, txn_id);

    if (!session_bucket_path) {
      return {
        error_code: ERROR_CODE.INVALID_REQUEST,
        status_code: SDK_STATUS_CODE.BAD_REQUEST,
        message: `Invalid created_at: ${created_at}. Expected Unix epoch in seconds.`,
      };
    }

    // Instances are created by EkaScribe.startRecordingForExistingSession
    // (mirrors initTransaction) so they are bound to `this` on the class.
    const audioFileManagerInstance = EkaScribeStore.audioFileManagerInstance;

    if (flavour) {
      setEnv({ flavour });
    }

    EkaScribeStore.txnID = txn_id;
    EkaScribeStore.sessionBucketPath = session_bucket_path;

    EkaScribeStore.sessionStatus[txn_id] = {
      api: {
        status: API_STATUS.INIT,
        code: SDK_STATUS_CODE.SUCCESS,
        response: 'Resumed from previous init',
      },
    };

    audioFileManagerInstance?.setSessionInfo({
      sessionId: txn_id,
      filePath: session_bucket_path,
      businessID: business_id,
    });

    addBreadcrumb('instance.check', 'startRecordingForExistingSession', {
      txn_id,
      vadInstance_exists: !!EkaScribeStore.vadInstance,
      audioFileManager_exists: !!EkaScribeStore.audioFileManagerInstance,
      audioBuffer_exists: !!EkaScribeStore.audioBufferInstance,
    });

    captureEvent('Session resumed', { txn_id });

    return await startVoiceRecording(microphoneID);
  } catch (err) {
    console.error('%c Line:00 🍇 startRecordingForExistingSession err', 'color:#b03734', err);
    return {
      error_code: ERROR_CODE.INTERNAL_SERVER_ERROR,
      status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `An error occurred while starting the recording for existing session: ${err}`,
    };
  }
};

export default startRecordingForExistingSession;
