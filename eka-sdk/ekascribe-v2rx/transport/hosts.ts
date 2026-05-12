export type EkaHosts = {
  voiceV1: string;
  voiceV2: string;
  voiceV3: string;
  cookV1: string;
  ekaHost: string;
  parchiHost: string;
};

const DEV_HOSTS: EkaHosts = {
  voiceV1: 'https://api.dev.eka.care/voice/api/v1',
  voiceV2: 'https://api.dev.eka.care/voice/api/v2',
  voiceV3: 'https://api.dev.eka.care/voice/api/v3',
  cookV1: 'https://deepthought-genai.dev.eka.care/api/v1',
  ekaHost: 'https://api.dev.eka.care',
  parchiHost: 'https://parchi.dev.eka.care',
};

const PROD_HOSTS: EkaHosts = {
  voiceV1: 'https://api.eka.care/voice/api/v1',
  voiceV2: 'https://api.eka.care/voice/api/v2',
  voiceV3: 'https://api.eka.care/voice/api/v3',
  cookV1: 'https://cook.eka.care/api/v1',
  ekaHost: 'https://api.eka.care',
  parchiHost: 'https://parchi.eka.care',
};

export function getHosts(env: 'PROD' | 'DEV'): EkaHosts {
  return env === 'PROD' ? PROD_HOSTS : DEV_HOSTS;
}
