import { TPostCogResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';

async function postCogInit(): Promise<TPostCogResponse> {
  try {
    const options = {
      method: 'GET',
    };

    const respJson = await fetchWrapper(`https://cog.eka.care/credentials`, options);

    const resp = await respJson.json();
    return resp;
  } catch (error) {
    throw error;
  }
}

export default postCogInit;
