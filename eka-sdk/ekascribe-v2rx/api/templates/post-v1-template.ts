import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostV1TemplateRequest, TPostV1TemplateResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function postV1Template({
  title,
  desc,
  section_ids,
}: TPostV1TemplateRequest): Promise<TPostV1TemplateResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const raw = {
      title,
      desc,
      section_ids,
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchWrapper(`${GET_EKA_VOICE_HOST_V1()}/api/v1/template`, options);
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c postV1Template -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostV1TemplateResponse;
  }
}

export default postV1Template;
