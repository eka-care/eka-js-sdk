import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TGetDoctorHeaderFooterRequest,
  TGetDoctorHeaderFooterResponse,
  TDoctorHeaderFooterInfo,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_PARCHI_HOST } from '../../fetch-client/helper';

type TTemplateV2 = {
  _id: string;
  clinicId: string;
  docid: string;
  type: string;
  header_img?: string;
  header_height?: string;
  header_top_margin?: string;
  footer_img?: string;
  footer_height?: string;
  margin_left?: string;
  margin_right?: string;
  page_size?: string;
  show_eka_logo?: boolean;
  show_name_in_signature?: boolean;
  show_not_valid_for_medical_legal_purpose_message?: boolean;
  show_page_number?: boolean;
  show_prescription_id?: boolean;
  show_signature?: boolean;
};

type TDoctorProfileResponse = {
  profile?: {
    professional?: {
      default_clinic?: string;
      templates_v2?: TTemplateV2[];
    };
  };
};

const extractHeaderFooterInfo = (
  template: TTemplateV2 | undefined
): TDoctorHeaderFooterInfo | null => {
  if (!template) {
    return null;
  }

  return {
    _id: template._id || null,
    clinic_id: template.clinicId || null,
    doctor_id: template.docid || null,
    type: template.type || null,
    header_img: template.header_img || null,
    header_height: template.header_height || null,
    header_top_margin: template.header_top_margin || null,
    footer_img: template.footer_img || null,
    footer_height: template.footer_height || null,
    margin_left: template.margin_left || null,
    margin_right: template.margin_right || null,
    page_size: template.page_size || null,
    show_eka_logo: template.show_eka_logo ?? null,
    show_name_in_signature: template.show_name_in_signature ?? null,
    show_not_valid_for_medical_legal_purpose_message:
      template.show_not_valid_for_medical_legal_purpose_message ?? null,
    show_page_number: template.show_page_number ?? null,
    show_prescription_id: template.show_prescription_id ?? null,
    show_signature: template.show_signature ?? null,
  };
};

export const getDoctorHeaderFooter = async ({
  doctor_oid,
  clinic_id,
}: TGetDoctorHeaderFooterRequest): Promise<TGetDoctorHeaderFooterResponse> => {
  try {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetchWrapper(
      `${GET_PARCHI_HOST()}/profile/get/doctorprofile/${doctor_oid}`,
      options
    );
    const res: TDoctorProfileResponse = await response.json();

    const templates = res?.profile?.professional?.templates_v2;
    const defaultClinic = res?.profile?.professional?.default_clinic;

    if (!templates || templates.length === 0) {
      return {
        data: null,
        code: response.status,
        message: 'No templates found for this doctor',
      };
    }

    // Filter templates with type='PRINT'
    const printTemplates = templates.filter((t) => t.type === 'PRINT');

    if (printTemplates.length === 0) {
      return {
        data: null,
        code: response.status,
        message: 'No PRINT templates found for this doctor',
      };
    }

    // 1. If clinic_id is passed, find matching template
    if (clinic_id) {
      const matchingTemplate = printTemplates.find((t) => t.clinicId === clinic_id);
      if (matchingTemplate) {
        return {
          data: extractHeaderFooterInfo(matchingTemplate),
          code: response.status,
        };
      }
    }

    // 2. Try to find template for default_clinic
    if (defaultClinic) {
      const defaultTemplate = printTemplates.find((t) => t.clinicId === defaultClinic);
      if (defaultTemplate) {
        return {
          data: extractHeaderFooterInfo(defaultTemplate),
          code: response.status,
        };
      }
    }

    // 3. Return null if no matching template found
    return {
      data: null,
      code: response.status,
      message: 'No matching template found for the specified or default clinic',
    };
  } catch (error) {
    console.error('Error in getDoctorHeaderFooter api: ', error);

    return {
      data: null,
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Failed to fetch doctor header/footer, ${error}`,
    };
  }
};
