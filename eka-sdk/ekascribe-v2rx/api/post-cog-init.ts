import { TPostCogResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../fetch-client/helper';

async function postCogInit(): Promise<TPostCogResponse> {
  try {
    const options = {
      method: 'GET',
    };

    const respJson = await fetchWrapper(`${GET_EKA_VOICE_HOST_V1()}/s3-token`, options);

    const resp = await respJson.json();
    return resp;
  } catch (error) {
    throw error;
  }
}

export default postCogInit;
