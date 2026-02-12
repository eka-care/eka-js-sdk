import { SDK_STATUS_CODE } from '../../constants/constant';
import {
  TGetDoctorHeaderFooterRequest,
  TGetDoctorHeaderFooterResponse,
  TDoctorHeaderFooterInfo,
} from '../../constants/types';
import fetchWrapper from '../../fetch-client';
import { GET_PARCHI_HOST } from '../../fetch-client/helper';

const DEFAULT_HEADER_IMAGE = 'https://cdn.eka.care/vagus/cmlf0ip4a00000td1dmth2wk3.png';
const DEFAULT_FOOTER_IMAGE = 'https://cdn.eka.care/vagus/cmlf0j9ea00010td1h3mi6zqk.png';
const DEFAULT_HEADER_HEIGHT = '3cm';
const DEFAULT_FOOTER_HEIGHT = '3.5cm';

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

const getDefaultHeaderFooterInfo = (): TDoctorHeaderFooterInfo => ({
  _id: null,
  clinic_id: null,
  doctor_id: null,
  type: null,
  header_img: DEFAULT_HEADER_IMAGE,
  header_height: DEFAULT_HEADER_HEIGHT,
  header_top_margin: null,
  footer_img: DEFAULT_FOOTER_IMAGE,
  footer_height: DEFAULT_FOOTER_HEIGHT,
  margin_left: null,
  margin_right: null,
  page_size: null,
  show_eka_logo: null,
  show_name_in_signature: null,
  show_not_valid_for_medical_legal_purpose_message: null,
  show_page_number: null,
  show_prescription_id: null,
  show_signature: null,
});

const extractHeaderFooterInfo = (template: TTemplateV2): TDoctorHeaderFooterInfo => ({
  _id: template._id || null,
  clinic_id: template.clinicId || null,
  doctor_id: template.docid || null,
  type: template.type || null,
  header_img: template.header_img || DEFAULT_HEADER_IMAGE,
  header_height: template.header_img ? template.header_height || DEFAULT_HEADER_HEIGHT : DEFAULT_HEADER_HEIGHT,
  header_top_margin: template.header_top_margin || null,
  footer_img: template.footer_img || DEFAULT_FOOTER_IMAGE,
  footer_height: template.footer_img ? template.footer_height || DEFAULT_FOOTER_HEIGHT : DEFAULT_FOOTER_HEIGHT,
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
});

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
        data: getDefaultHeaderFooterInfo(),
        code: response.status,
      };
    }

    // Filter templates with type='PRINT'
    const printTemplates = templates.filter((t) => t.type === 'PRINT');

    if (printTemplates.length === 0) {
      return {
        data: getDefaultHeaderFooterInfo(),
        code: response.status,
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

    // 3. Return defaults if no matching template found
    return {
      data: getDefaultHeaderFooterInfo(),
      code: response.status,
    };
  } catch (error) {
    console.error('Error in getDoctorHeaderFooter api: ', error);

    return {
      data: getDefaultHeaderFooterInfo(),
      code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: `Failed to fetch doctor header/footer, ${error}`,
    };
  }
};
