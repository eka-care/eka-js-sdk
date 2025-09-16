import { SDK_STATUS_CODE } from '../constants/constant';
import { TPostV1FileUploadResponse } from '../constants/types';
import fetchWrapper from '../fetch-client';
import { GET_EKA_HOST } from '../fetch-client/helper';

async function postV1FileUpload({
  txn_id,
  action,
}: {
  txn_id: string;
  action: string;
}): Promise<TPostV1FileUploadResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    };

    const response = await fetchWrapper(
      `${GET_EKA_HOST()}/v1/file-upload?txn_id=${txn_id}&action=${action}`,
      options
    );

    let res = await response.json();
    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c getPresignedUrl -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostV1FileUploadResponse;
  }
}

export default postV1FileUpload;
