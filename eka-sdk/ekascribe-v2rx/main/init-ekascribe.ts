import postCogInit from '../api/post-cog-init';
import { configureAWS } from '../aws-services/configure-aws';
import { TInitResponse } from '../constants/types';

const initEkaScribe = async (): Promise<TInitResponse> => {
  try {
    // check for sess and refresh in cookies
    const cookies = await chrome.cookies.getAll({ domain: '.eka.care' });
    const sessToken = cookies.find((cookie) => cookie.name === 'sess');
    const refreshToken = cookies.find((cookie) => cookie.name === 'refresh');
    if (!sessToken || !refreshToken) {
      return {
        error: 'Session or refresh token not found in cookies',
      };
    }

    // call cog api
    const response = await postCogInit();
    const { credentials, is_session_expired } = response;
    if (is_session_expired || !credentials) {
      return {
        error: 'Session expired',
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

export default initEkaScribe;
