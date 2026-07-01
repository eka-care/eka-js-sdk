import { mapTransportError } from '../utils/map-transport-error';
import {
  TGetV1TemplatesResponse,
  TPostV1TemplateRequest,
  TPostV1TemplateResponse,
  TGetV1TemplateSectionsResponse,
  TPostV1TemplateSectionRequest,
  TPostV1TemplateSectionResponse,
  TPostV1DocumentRequest,
  TPostV1DocumentResponse,
  TDeleteV1DocumentResponse,
  TPostV1ConvertToTemplateRequest,
  TPostV1ConvertToTemplateResponse,
  TPostV1AiCreateTemplateRequest,
  TPostV1AiCreateTemplateResponse,
} from '../constants/types';
import { ITransport } from '../transport/transport.interface';
import { EkaHosts } from '../transport/hosts';
import {
  type ScribeClient,
  type SDKResult,
  type ProcessTemplateResponse,
} from 'med-scribe-alliance-ts-sdk';

export class DocumentManager {
  constructor(
    private transport: ITransport,
    private hosts: EkaHosts,
    private allianceClient: ScribeClient
  ) {}

  // --- Templates ---

  async getAllTemplates(): Promise<TGetV1TemplatesResponse> {
    try {
      const response = await this.transport.request<TGetV1TemplatesResponse>({
        method: 'GET',
        url: `${this.hosts.voiceV1}/template`,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to fetch templates,');
      return { status_code: mapped.status_code, items: [] } as TGetV1TemplatesResponse;
    }
  }

  async createTemplate({
    title,
    desc,
    section_ids,
  }: TPostV1TemplateRequest): Promise<TPostV1TemplateResponse> {
    try {
      const response = await this.transport.request<TPostV1TemplateResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV1}/template`,
        body: { title, desc, section_ids },
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to create template,');
      return {
        status_code: mapped.status_code,
        message: mapped.message,
      } as TPostV1TemplateResponse;
    }
  }

  async updateTemplate({
    template_id,
    title,
    desc,
    section_ids,
  }: TPostV1TemplateRequest): Promise<TPostV1TemplateResponse> {
    try {
      const response = await this.transport.request<TPostV1TemplateResponse>({
        method: 'PATCH',
        url: `${this.hosts.voiceV1}/template/${template_id}`,
        body: { title, desc, section_ids },
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to update template,');
      return { status_code: mapped.status_code, msg: mapped.message } as TPostV1TemplateResponse;
    }
  }

  async deleteTemplate(templateId: string): Promise<TPostV1TemplateResponse> {
    try {
      const response = await this.transport.request<TPostV1TemplateResponse>({
        method: 'DELETE',
        url: `${this.hosts.voiceV1}/template/${templateId}`,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to delete template,');
      return { status_code: mapped.status_code, msg: mapped.message } as TPostV1TemplateResponse;
    }
  }

  async aiGenerateTemplate({
    file,
    instruction,
  }: TPostV1AiCreateTemplateRequest): Promise<TPostV1AiCreateTemplateResponse> {
    try {
      const trimmedInstruction = instruction?.trim();

      let body: FormData | { instruction: string };
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        if (trimmedInstruction) {
          formData.append('instruction', trimmedInstruction);
        }
        body = formData;
      } else {
        body = { instruction: trimmedInstruction ?? '' };
      }

      const response = await this.transport.request<TPostV1AiCreateTemplateResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV1}/template/ai-create-template`,
        body,
        timeout: 30000,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to AI generate template,');
      return {
        status_code: mapped.status_code,
        message: mapped.message,
      } as TPostV1AiCreateTemplateResponse;
    }
  }

  async convertToTemplate({
    txn_id,
    template_id,
  }: {
    txn_id: string;
    template_id: string;
  }): Promise<SDKResult<ProcessTemplateResponse>> {
    return this.allianceClient.processTemplate(template_id, txn_id);
  }

  async convertTranscriptionToTemplate({
    txn_id,
    template_id,
    transcript,
    target_language,
  }: TPostV1ConvertToTemplateRequest): Promise<TPostV1ConvertToTemplateResponse> {
    try {
      const response = await this.transport.request<TPostV1ConvertToTemplateResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV1}/transaction/${txn_id}/convert-to-template`,
        body: {
          ...(transcript && { transcript }),
          ...(template_id && { template_id }),
          ...(target_language && { target_language }),
        },
        timeout: 60000,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to convert transcription to template,');
      return {
        status_code: mapped.status_code,
        message: mapped.message,
      } as TPostV1ConvertToTemplateResponse;
    }
  }

  // --- Template Sections ---

  async getAllTemplateSections(): Promise<TGetV1TemplateSectionsResponse> {
    try {
      const response = await this.transport.request<TGetV1TemplateSectionsResponse>({
        method: 'GET',
        url: `${this.hosts.voiceV1}/template/section`,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to fetch template sections,');
      return { status_code: mapped.status_code, items: [] } as TGetV1TemplateSectionsResponse;
    }
  }

  async createTemplateSection({
    title,
    desc,
    format,
    example,
  }: TPostV1TemplateSectionRequest): Promise<TPostV1TemplateSectionResponse> {
    try {
      const response = await this.transport.request<TPostV1TemplateSectionResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV1}/template/section`,
        body: { title, desc, format, example },
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to create template section,');
      return {
        status_code: mapped.status_code,
        msg: mapped.message,
        section_id: '',
      } as TPostV1TemplateSectionResponse;
    }
  }

  async updateTemplateSection({
    section_id,
    title,
    desc,
    format,
    example,
  }: TPostV1TemplateSectionRequest): Promise<TPostV1TemplateSectionResponse> {
    try {
      const response = await this.transport.request<TPostV1TemplateSectionResponse>({
        method: 'PATCH',
        url: `${this.hosts.voiceV1}/template/section/${section_id}`,
        body: { title, desc, format, example },
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to update template section,');
      return {
        status_code: mapped.status_code,
        msg: mapped.message,
        section_id: '',
        action: 'updated',
      } as TPostV1TemplateSectionResponse;
    }
  }

  async deleteTemplateSection(sectionId: string): Promise<TPostV1TemplateSectionResponse> {
    try {
      const response = await this.transport.request<TPostV1TemplateSectionResponse>({
        method: 'DELETE',
        url: `${this.hosts.voiceV1}/template/section/${sectionId}`,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to delete template section,');
      return {
        status_code: mapped.status_code,
        msg: mapped.message,
      } as TPostV1TemplateSectionResponse;
    }
  }

  // --- Documents ---

  async getDocument({
    documentId,
    params,
  }: {
    documentId: string;
    params?: string;
  }): Promise<TPostV1DocumentResponse> {
    try {
      const queryParams = params ? `?${params}` : '';
      const response = await this.transport.request<TPostV1DocumentResponse>({
        method: 'GET',
        url: `${this.hosts.voiceV1}/documents/${documentId}${queryParams}`,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to fetch document,');
      return { status_code: mapped.status_code } as TPostV1DocumentResponse;
    }
  }

  async createDocument({
    session_id,
    document_name,
    type,
    document_id,
    publish,
  }: TPostV1DocumentRequest): Promise<TPostV1DocumentResponse> {
    try {
      const response = await this.transport.request<TPostV1DocumentResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV1}/documents`,
        body: {
          session_id,
          type,
          ...(document_name ? { document_name } : {}),
          ...(document_id ? { document_id } : {}),
          ...(publish ? { publish } : {}),
        },
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to create document,');
      return {
        status_code: mapped.status_code,
        message: mapped.message,
      } as TPostV1DocumentResponse;
    }
  }

  async updateDocument({
    session_id,
    document_name,
    type,
    document_id,
    publish,
    tiptap_json,
    params,
  }: TPostV1DocumentRequest): Promise<TPostV1DocumentResponse> {
    try {
      const response = await this.transport.request<TPostV1DocumentResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV1}/documents${params ? `?${params}` : ''}`,
        body: {
          session_id,
          type,
          ...(document_name ? { document_name } : {}),
          ...(document_id ? { document_id } : {}),
          ...(publish ? { publish } : {}),
          ...(tiptap_json ? { tiptap_json } : {}),
        },
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to update document,');
      return {
        status_code: mapped.status_code,
        message: mapped.message,
      } as TPostV1DocumentResponse;
    }
  }

  async deleteDocument(documentId: string): Promise<TDeleteV1DocumentResponse> {
    try {
      const response = await this.transport.request<TDeleteV1DocumentResponse>({
        method: 'DELETE',
        url: `${this.hosts.voiceV1}/documents/${documentId}`,
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to delete document,');
      return {
        status_code: mapped.status_code,
        message: mapped.message,
      } as TDeleteV1DocumentResponse;
    }
  }

  async publishDocument({
    session_id,
    document_id,
  }: TPostV1DocumentRequest): Promise<TPostV1DocumentResponse> {
    try {
      const response = await this.transport.request<TPostV1DocumentResponse>({
        method: 'POST',
        url: `${this.hosts.voiceV1}/sessions/${session_id}/documents/${document_id}/publish`,
        body: {},
      });

      return { ...response.data, status_code: response.status };
    } catch (error) {
      const mapped = mapTransportError(error, 'Failed to publish document,');
      return {
        status_code: mapped.status_code,
        message: mapped.message,
      } as TPostV1DocumentResponse;
    }
  }
}
