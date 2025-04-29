import postCogInit from '../api/post-cog-init';
import postTransactionInit from '../api/post-transaction-init';
import { configureAWS } from '../aws-services/configure-aws';
import { S3_BUCKET_NAME } from '../constants/audio-constants';
import { TInitResponse } from '../constants/types';
import EkaScribeStore from '../store/store';
import { v4 as uuidv4 } from 'uuid';

const initTransactionMethod = async ({
  mode,
  input_language,
  output_format_template,
}: {
  mode: string;
  input_language: string[];
  output_format_template: { template_id: string }[];
}): Promise<TInitResponse> => {
  try {
    const fileManagerInstance = EkaScribeStore.audioFileManagerInstance;
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
    EkaScribeStore.s3FilePath = filePath;

    const txnInitResponse = await postTransactionInit({
      mode,
      txnId: txnID,
      s3Url: `s3://${S3_BUCKET_NAME}/${EkaScribeStore.s3FilePath}`,
      input_language,
      output_format_template,
    });

    const {
      status: txnInitStatus,
      code: txnInitStatusCode,
      b_id: businessId,
      message: txnInitMessage,
    } = txnInitResponse;
    if (txnInitStatusCode >= 400 || txnInitStatus === 'error') {
      return {
        error: txnInitMessage,
      };
    }

    fileManagerInstance?.setSessionInfo({
      date: filePath,
      sessionId: txnID,
      filePath: filePath,
      businessID: businessId,
    });

    // call cog api
    const response = await postCogInit();
    const { credentials, is_session_expired } = response;
    if (is_session_expired || !credentials) {
      return {
        error: 'Session expired, Please login again.',
      };
    }

    // configuration of AWS
    const { AccessKeyId, SecretKey, SessionToken } = credentials;
    configureAWS({
      accessKeyId: AccessKeyId,
      secretKey: SecretKey,
      sessionToken: SessionToken,
    });

    return { success: true };
  } catch (error) {
    console.error('Error initializing EkaScribe, initEkaScribe: ', error);
    return { error: error as string };
  }
};

export default initTransactionMethod;
