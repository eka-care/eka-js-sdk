import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TPostV1TemplateSectionRequest,
  TPostV1TemplateSectionResponse,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function patchV1TemplateSection({
  sectionId,
  templateId,
  title,
  desc,
  format,
  example,
}: TPostV1TemplateSectionRequest & {
  sectionId: string;
  templateId: string;
}): Promise<TPostV1TemplateSectionResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('template-id', templateId);

    const raw = {
      title,
      desc,
      format,
      example,
    };

    const options = {
      method: 'PATCH',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/api/v1/template/section/${sectionId}`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c patchV1TemplateSection -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      msg: `Something went wrong! ${error}`,
      section_id: '',
      action: 'updated',
    } as TPostV1TemplateSectionResponse;
  }
}
