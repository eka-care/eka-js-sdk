import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TGetV1SessionDetailsRequest,
  TGetV1SessionDetailsResponse,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V1 } from '../../fetch-client/helper';

async function getV1SessionDetails({
  session_id,
  presigned = false,
}: TGetV1SessionDetailsRequest): Promise<TGetV1SessionDetailsResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    const options = {
      method: 'GET',
      headers,
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V1()}/sessions/${session_id}?presigned=${presigned}`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.error('%c getV1SessionDetails -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TGetV1SessionDetailsResponse;
  }
}

export default getV1SessionDetails;
