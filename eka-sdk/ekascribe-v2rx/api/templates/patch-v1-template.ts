import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostV1TemplateRequest, TPostV1TemplateResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

export async function patchV1Template({
  template_id,
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
      method: 'PATCH',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/api/v1/template/${template_id}`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c patchV1Template -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      msg: `Something went wrong! ${error}`,
    } as TPostV1TemplateResponse;
  }
}

export default patchV1Template;
