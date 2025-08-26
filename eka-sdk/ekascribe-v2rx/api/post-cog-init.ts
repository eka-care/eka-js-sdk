import { TPostCogResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_COG_HOST } from '../fetch-client/helper';

async function postCogInit(): Promise<TPostCogResponse> {
  try {
    const options = {
      method: 'GET',
    };

    const respJson = await fetchWrapper(`${GET_COG_HOST()}/credentials`, options);

    const resp = await respJson.json();
    return resp;
  } catch (error) {
    throw error;
  }
}

export default postCogInit;
