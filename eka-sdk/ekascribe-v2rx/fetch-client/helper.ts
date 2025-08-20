const DEV = {
  EKA_HOST: 'https://api.dev.eka.care',
  EKA_V2RX_HOST_V2: 'https://v2rxbe.dev.eka.care/voice/api/v2',
  EKA_V2RX_HOST_V3: 'https://v2rxbe.dev.eka.care/voice/api/v3',
};

const PROD = {
  EKA_HOST: 'https://api.eka.care',
  EKA_V2RX_HOST_V2: 'https://api.eka.care/voice/api/v2',
  EKA_V2RX_HOST_V3: 'https://api.eka.care/voice/api/v3',
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

export const GET_EKA_HOST = () => envVar.EKA_HOST;
export const GET_CLIENT_ID = () => client_id;
export const GET_AUTH_TOKEN = () => auth;
export const GET_EKA_V2RX_HOST_V2 = () => envVar.EKA_V2RX_HOST_V2;
export const GET_EKA_V2RX_HOST_V3 = () => envVar.EKA_V2RX_HOST_V3;

export default setEnv;
