import { SDK_STATUS_CODE } from '../../constants/constant';
import { TSuggestedMedicationResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_HOST } from '../../fetch-client/helper';

export async function getV1SessionSuggestedMedications(
  txnId: string
): Promise<TSuggestedMedicationResponse> {
  try {
    const response = await fetchWrapper(
      `${GET_EKA_HOST()}/voice/v1/session/${txnId}/suggested-medications`,
      { method: 'GET' }
    );

    const res = await response.json();

    return {
      ...res,
      code: response.status,
    };
  } catch (error) {
    console.error('Error in export async function getV1SessionSuggestedMedications api: ', error);

    return {
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Failed to fetch initial configurations, ${error}`,
    } as TSuggestedMedicationResponse;
  }
}
