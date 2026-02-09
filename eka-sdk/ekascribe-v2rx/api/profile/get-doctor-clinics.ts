import { SDK_STATUS_CODE } from '../../constants/constant';
import { TGetDoctorClinicsRequest, TGetDoctorClinicsResponse } from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_EKA_HOST } from '../../fetch-client/helper';

type TApiClinic = {
  clinic_id: string;
  name: string;
  doctors: string[];
};

type TBusinessEntitiesResponse = {
  status_code?: number;
  success?: boolean;
  data?: {
    clinics?: TApiClinic[];
  };
};

export const getDoctorClinics = async ({
  doctor_id,
}: TGetDoctorClinicsRequest): Promise<TGetDoctorClinicsResponse> => {
  try {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetchWrapper(`${GET_EKA_HOST()}/dr/v1/business/entities`, options);
    const res: TBusinessEntitiesResponse = await response.json();

    if (!res?.data?.clinics || res.data.clinics.length === 0) {
      return {
        data: null,
        code: response.status,
        message: 'No clinics found',
      };
    }

    const doctorClinics = res.data.clinics
      .filter((clinic) => clinic.doctors?.includes(doctor_id))
      .map((clinic) => ({
        clinic_id: clinic.clinic_id,
        name: clinic.name,
      }));

    if (doctorClinics.length === 0) {
      return {
        data: null,
        code: response.status,
        message: 'No clinics found for this doctor',
      };
    }

    return {
      data: doctorClinics,
      code: response.status,
    };
  } catch (error) {
    console.error('Error in getDoctorClinics api: ', error);

    return {
      data: null,
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Failed to fetch doctor clinics, ${error}`,
    };
  }
};
