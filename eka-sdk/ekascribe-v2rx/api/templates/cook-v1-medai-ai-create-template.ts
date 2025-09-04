import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostCookV1MediaAiCreateTemplateResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_COOK_HOST_V1 } from '../../fetch-client/helper';

async function cookV1MediaAiCreateTemplate(
  formData: FormData
): Promise<TPostCookV1MediaAiCreateTemplateResponse> {
  try {
    const options = {
      method: 'POST',
      body: formData,
    };

    const response = await fetchWrapper(
      `${GET_COOK_HOST_V1()}/medai/ai-create-template`,
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
    console.log('%c postV1Template -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostCookV1MediaAiCreateTemplateResponse;
  }
}

export default cookV1MediaAiCreateTemplate;
