const DEV = {
  EKA_COG_HOST: 'https://cog.dev.eka.care',
  EKA_V2RX_HOST: 'https://api.dev.eka.care',
};

const PROD = {
  EKA_COG_HOST: 'https://cog.eka.care',
  EKA_V2RX_HOST: 'https://api.eka.care',
};

let envVar = PROD;
let client_id = 'doctor-app-ios';
let auth: string;
let refresh: string;

const setEnv = ({
  env,
  clientId,
  auth_token,
  refresh_token,
}: {
  env?: 'PROD' | 'DEV';
  clientId?: string;
  auth_token: string;
  refresh_token: string;
}) => {
  envVar = env === 'PROD' ? PROD : DEV;
  if (clientId) {
    client_id = clientId;
  }
  auth = auth_token;
  refresh = refresh_token;
};

export const GET_EKA_COG_HOST = () => envVar.EKA_COG_HOST;
export const GET_CLIENT_ID = () => client_id;
export const GET_AUTH_TOKEN = () => auth;
export const GET_REFRESH_TOKEN = () => refresh;
export const GET_EKA_V2RX_HOST = () => envVar.EKA_V2RX_HOST;

export default setEnv;
