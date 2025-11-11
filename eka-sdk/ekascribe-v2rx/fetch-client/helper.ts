const DEV = {
  COG_HOST: 'https://cog.dev.eka.care',
  EKA_VOICE_HOST_V1: 'https://api.dev.eka.care/voice/api/v1',
  EKA_VOICE_HOST_V2: 'https://api.dev.eka.care/voice/api/v2',
  EKA_VOICE_HOST_V3: 'https://api.dev.eka.care/voice/api/v3',
  COOK_V1: ' https://deepthought-genai.dev.eka.care/api/v1',
  EKA_HOST: 'https://api.dev.eka.care',
  S3_BUCKET_NAME: 'm-pp-voice2rx',
};

const PROD = {
  COG_HOST: 'https://cog.eka.care',
  EKA_VOICE_HOST_V1: 'https://api.eka.care/voice/api/v1',
  EKA_VOICE_HOST_V2: 'https://api.eka.care/voice/api/v2',
  EKA_VOICE_HOST_V3: 'https://api.eka.care/voice/api/v3',
  COOK_V1: ' https://cook.eka.care/api/v1',
  EKA_HOST: 'https://api.eka.care',
  S3_BUCKET_NAME: 'm-prod-voice-record',
};

let envVar = PROD;
let client_id = 'doc-web';
let auth: string;

const setEnv = ({
  env,
  clientId,
  auth_token,
}: {
  env?: 'PROD' | 'DEV';
  clientId?: string;
  auth_token?: string;
}) => {
  if (env) {
    envVar = env === 'PROD' ? PROD : DEV;
  }
  if (clientId) {
    client_id = clientId;
  }
  if (auth_token) {
    auth = auth_token;
  }
};

export const GET_S3_BUCKET_NAME = () => envVar.S3_BUCKET_NAME;
export const GET_CLIENT_ID = () => client_id;
export const GET_AUTH_TOKEN = () => auth;
export const GET_EKA_VOICE_HOST_V1 = () => envVar.EKA_VOICE_HOST_V1;
export const GET_EKA_VOICE_HOST_V2 = () => envVar.EKA_VOICE_HOST_V2;
export const GET_EKA_VOICE_HOST_V3 = () => envVar.EKA_VOICE_HOST_V3;
export const GET_COOK_HOST_V1 = () => envVar.COOK_V1;
export const GET_COG_HOST = () => envVar.COG_HOST;
export const GET_EKA_HOST = () => envVar.EKA_HOST;
export const GET_CURRENT_ENV = (): 'PROD' | 'DEV' => (envVar === PROD ? 'PROD' : 'DEV');

export default setEnv;
