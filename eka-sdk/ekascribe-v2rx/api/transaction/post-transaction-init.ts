import { SDK_STATUS_CODE } from '../../constants/constant';
import { TPostTransactionInitRequest, TPostTransactionResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_VOICE_HOST_V2 } from '../../fetch-client/helper';

async function postTransactionInit({
  mode,
  txn_id,
  s3Url,
  input_language,
  output_format_template,
  model_training_consent,
  auto_download,
  transfer,
  system_info,
  patient_details,
  model_type,
  version,
  flavour,
  batch_s3_url,
  audio_file_names,
}: TPostTransactionInitRequest): Promise<TPostTransactionResponse> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    if (flavour) {
      headers.set('flavour', flavour);
    }

    const raw = {
      mode,
      s3_url: s3Url,
      input_language,
      output_format_template,
      model_training_consent,
      auto_download,
      transfer,
      system_info,
      patient_details,
      model_type,
      version,
      batch_s3_url,
      ...(audio_file_names ? { client_generated_files: audio_file_names } : {}),
    };

    const options = {
      method: 'POST',
      headers,
      body: JSON.stringify(raw),
    };

    const response = await fetchWrapper(
      `${GET_EKA_VOICE_HOST_V2()}/transaction/init/${txn_id}`,
      options
    );
    let res = await response.json();

    res = {
      ...res,
      code: response.status,
    };

    return res;
  } catch (error) {
    console.log('%c Line:52 🥖 postTransactionInit -> error', 'color:#f5ce50', error);
    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Something went wrong! ${error}`,
    } as TPostTransactionResponse;
  }
}

export default postTransactionInit;
