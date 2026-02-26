import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TPostV1ConvertToTemplateRequest,
  TPostV1ConvertToTemplateResponse,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function postConvertTranscriptionToTemplate({
  txn_id,
  template_id,
  transcript,
  target_language,
}: TPostV1ConvertToTemplateRequest): Promise<TPostV1ConvertToTemplateResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...(transcript && { transcript }),
        ...(template_id && { template_id }),
        ...(target_language && { target_language }),
      }),
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/transaction/${txn_id}/convert-to-template`,
      options,
      60000
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.error('%c postV1ConvertToTemplate -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostV1ConvertToTemplateResponse;
  }
}

export default postConvertTranscriptionToTemplate;
