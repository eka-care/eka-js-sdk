import { TPostCogResponse } from '../constants/types';

async function postCogInit(): Promise<TPostCogResponse> {
  try {
    const options = {
      method: 'GET',
    };

    const respJson = await fetch(`https://cog.eka.care/credentials`, options);

    // refresh COG token
    if (respJson.status === 401) {
      // @ts-ignore
      // TODO: change this
      const response = await window.refreshAuth();
      if (response.ok) {
        return await postCogInit();
      }

      return { is_session_expired: true };
    }

    if (respJson.status >= 400) {
      throw new Error(`Invalid status code: ${respJson.status}`);
    }
    const resp = await respJson.json();
    return resp;
  } catch (error) {
    throw error;
  }
}

export default postCogInit;
