import { SDK_STATUS_CODE } from '../constants/constant';
import {
  TGetConfigV2Response,
  TGetTransactionHistoryResponse,
  TDeleteTransactionResponse,
  TPatchTransactionRequest,
  TPostTransactionResponse,
  TPatchVoiceApiV3StatusRequest,
  TPatchVoiceApiV3StatusResponse,
  TPatchVoiceApiV2ConfigRequest,
  TPatchVoiceApiV2ConfigResponse,
  TPatchSessionContextRequest,
  TPatchSessionContextResponse,
  TGetV1SessionDetailsRequest,
  TGetV1SessionDetailsResponse,
  TSuggestedMedicationResponse,
  TGetDoctorHeaderFooterRequest,
  TGetDoctorHeaderFooterResponse,
  TDoctorHeaderFooterInfo,
  TGetDoctorClinicsRequest,
  TGetDoctorClinicsResponse,
} from '../constants/types';
import { ITransport } from '../transport/transport.interface';
import { EkaHosts } from '../transport/hosts';

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

export class SessionUtils {
  constructor(private transport: ITransport, private hosts: EkaHosts) {}

  // --- Session CRUD ---

  async getSessionHistory({
    txn_count,
    oid,
  }: {
    txn_count: number;
    oid?: string;
  }): Promise<TGetTransactionHistoryResponse> {
    try {
      const queryParams = `count=${txn_count}${oid ? `&oid=${oid}` : ''}`;
      const response = await this.transport.request<{ data: unknown }>({
        method: 'GET',
        url: `${this.hosts.voiceV2}/transaction/history?${queryParams}`,
      });

      return {
        data: response.data.data as TGetTransactionHistoryResponse['data'],
        status_code: response.status,
        message: `Past ${txn_count} transactions fetched successfully.`,
      };
    } catch (error) {
      return {
        status_code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Something went wrong in fetching transactions. ${error}`,
      };
    }
  }

  // Alliance SDK
  async deleteSession({ txn_id }: { txn_id: string }): Promise<TDeleteTransactionResponse> {
    try {
      const response = await this.transport.request<TDeleteTransactionResponse>({
        method: 'DELETE',
        url: `${this.hosts.voiceV2}/transaction/${txn_id}`,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Something went wrong in deleting transaction. ${error}`,
      };
    }
  }

  // Alliance SDK
  async patchSessionStatus({
    sessionId,
    processing_status,
    processing_error,
    patient_details,
    user_status,
  }: TPatchTransactionRequest): Promise<TPostTransactionResponse> {
    try {
      const body = {
        ...(processing_status ? { processing_status } : {}),
        ...(patient_details ? { patient_details } : {}),
        ...(processing_error ? { processing_error } : {}),
        ...(user_status ? { user_status } : {}),
      };

      const response = await this.transport.request<TPostTransactionResponse>({
        method: 'PATCH',
        url: `${this.hosts.voiceV2}/transaction/${sessionId}`,
        body,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Something went wrong! ${error}`,
      } as TPostTransactionResponse;
    }
  }

  async getSessionDetails({
    session_id,
    presigned = false,
  }: TGetV1SessionDetailsRequest): Promise<TGetV1SessionDetailsResponse> {
    try {
      const response = await this.transport.request<TGetV1SessionDetailsResponse>({
        method: 'GET',
        url: `${this.hosts.voiceV1}/sessions/${session_id}?presigned=${presigned}`,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Something went wrong! ${error}`,
      } as TGetV1SessionDetailsResponse;
    }
  }

  async getSuggestedMedications(txnId: string): Promise<TSuggestedMedicationResponse> {
    try {
      const response = await this.transport.request<TSuggestedMedicationResponse>({
        method: 'GET',
        url: `${this.hosts.ekaHost}/voice/v1/session/${txnId}/suggested-medications`,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch suggested medications, ${error}`,
      } as TSuggestedMedicationResponse;
    }
  }

  async addSessionContext({
    txn_id,
    context,
  }: TPatchSessionContextRequest): Promise<TPatchSessionContextResponse> {
    try {
      const response = await this.transport.request<TPatchSessionContextResponse>({
        method: 'PATCH',
        url: `${this.hosts.voiceV1}/sessions/${txn_id}/context`,
        body: { context },
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Something went wrong! ${error}`,
      } as TPatchSessionContextResponse;
    }
  }

  async removeSessionContext({
    txn_id,
    context,
  }: TPatchSessionContextRequest): Promise<TPatchSessionContextResponse> {
    try {
      const response = await this.transport.request<TPatchSessionContextResponse>({
        method: 'DELETE',
        url: `${this.hosts.voiceV1}/sessions/${txn_id}/context`,
        body: { context },
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Something went wrong! ${error}`,
      } as TPatchSessionContextResponse;
    }
  }

  // @deprecated
  async updateResultSummary({
    txnId,
    data,
  }: TPatchVoiceApiV3StatusRequest): Promise<TPatchVoiceApiV3StatusResponse> {
    try {
      const response = await this.transport.request<TPatchVoiceApiV3StatusResponse>({
        method: 'PATCH',
        url: `${this.hosts.voiceV3}/status/${txnId}`,
        body: data,
        timeout: 30000,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Something went wrong! ${error}`,
      } as TPatchVoiceApiV3StatusResponse;
    }
  }

  // --- Config ---

  async getConfig(): Promise<TGetConfigV2Response> {
    try {
      const response = await this.transport.request<TGetConfigV2Response>({
        method: 'GET',
        url: `${this.hosts.voiceV2}/config/`,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch initial configurations, ${error}`,
      } as TGetConfigV2Response;
    }
  }

  async getConfigMyTemplates(): Promise<TGetConfigV2Response> {
    try {
      const response = await this.transport.request<TGetConfigV2Response>({
        method: 'GET',
        url: `${this.hosts.voiceV2}/config/?my_templates=true`,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch initial configurations, ${error}`,
      } as TGetConfigV2Response;
    }
  }

  async updateConfig(
    request: TPatchVoiceApiV2ConfigRequest
  ): Promise<TPatchVoiceApiV2ConfigResponse> {
    try {
      const queryParams = request.query_params ? `?${request.query_params}` : '';
      const response = await this.transport.request<TPatchVoiceApiV2ConfigResponse>({
        method: 'PUT',
        url: `${this.hosts.voiceV2}/config/${queryParams}`,
        body: request,
      });

      return { ...response.data, code: response.status };
    } catch (error) {
      return {
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        msg: `Failed to fetch initial configurations, ${error}`,
      } as TPatchVoiceApiV2ConfigResponse;
    }
  }

  // --- Profile ---

  async getDoctorHeaderFooter({
    doctor_oid,
    clinic_id,
  }: TGetDoctorHeaderFooterRequest): Promise<TGetDoctorHeaderFooterResponse> {
    try {
      const response = await this.transport.request<TDoctorProfileResponse>({
        method: 'GET',
        url: `${this.hosts.parchiHost}/profile/get/doctorprofile/${doctor_oid}`,
      });

      const res = response.data;
      const templates = res?.profile?.professional?.templates_v2;
      const defaultClinic = res?.profile?.professional?.default_clinic;

      if (!templates || templates.length === 0) {
        return {
          data: this.getDefaultHeaderFooterInfo(),
          code: response.status,
        };
      }

      const printTemplates = templates.filter((t) => t.type === 'PRINT');

      if (printTemplates.length === 0) {
        return {
          data: this.getDefaultHeaderFooterInfo(),
          code: response.status,
        };
      }

      // 1. If clinic_id is passed, find matching template
      if (clinic_id) {
        const matchingTemplate = printTemplates.find((t) => t.clinicId === clinic_id);
        if (matchingTemplate) {
          return {
            data: this.extractHeaderFooterInfo(matchingTemplate),
            code: response.status,
          };
        }
      }

      // 2. Try to find template for default_clinic
      if (defaultClinic) {
        const defaultTemplate = printTemplates.find((t) => t.clinicId === defaultClinic);
        if (defaultTemplate) {
          return {
            data: this.extractHeaderFooterInfo(defaultTemplate),
            code: response.status,
          };
        }
      }

      // 3. Return defaults if no matching template found
      return {
        data: this.getDefaultHeaderFooterInfo(),
        code: response.status,
      };
    } catch (error) {
      return {
        data: this.getDefaultHeaderFooterInfo(),
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch doctor header/footer, ${error}`,
      };
    }
  }

  async getDoctorClinics({
    doctor_id,
  }: TGetDoctorClinicsRequest): Promise<TGetDoctorClinicsResponse> {
    try {
      const response = await this.transport.request<TBusinessEntitiesResponse>({
        method: 'GET',
        url: `${this.hosts.ekaHost}/dr/v1/business/entities`,
      });

      const res = response.data;

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
      return {
        data: null,
        code: SDK_STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: `Failed to fetch doctor clinics, ${error}`,
      };
    }
  }

  // --- Alliance SDK methods (TODO: wire up when Alliance SDK is integrated) ---

  // async createSession(request: unknown): Promise<unknown> {
  //   // Alliance SDK: allianceClient.createSession(request)
  // }

  // async getSessionStatus(sessionId: string): Promise<unknown> {
  //   // Alliance SDK: allianceClient.getSessionStatus(sessionId)
  // }

  // patchSession

  // processTemplate

  // deleteSession

  // cancelSession

  // --- Private helpers ---

  private getDefaultHeaderFooterInfo(): TDoctorHeaderFooterInfo {
    return {
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
    };
  }

  private extractHeaderFooterInfo(template: TTemplateV2): TDoctorHeaderFooterInfo {
    return {
      _id: template._id || null,
      clinic_id: template.clinicId || null,
      doctor_id: template.docid || null,
      type: template.type || null,
      header_img: template.header_img || DEFAULT_HEADER_IMAGE,
      header_height: template.header_img
        ? template.header_height || DEFAULT_HEADER_HEIGHT
        : DEFAULT_HEADER_HEIGHT,
      header_top_margin: template.header_top_margin || null,
      footer_img: template.footer_img || DEFAULT_FOOTER_IMAGE,
      footer_height: template.footer_img
        ? template.footer_height || DEFAULT_FOOTER_HEIGHT
        : DEFAULT_FOOTER_HEIGHT,
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
  }
}
