import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TPostV1TemplateSectionRequest,
  TPostV1TemplateSectionResponse,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function postV1TemplateSection({
  title,
  desc,
  format,
  example,
}: TPostV1TemplateSectionRequest): Promise<TPostV1TemplateSectionResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const raw = {
      title,
      desc,
      format,
      example,
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchWrapper(`${GET_EKA_VOICE_HOST_V1()}/template/section`, options);
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c postV1TemplateSection -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      msg: `Something went wrong! ${error}`,
      section_id: '',
    } as TPostV1TemplateSectionResponse;
  }
}

export default postV1TemplateSection;
