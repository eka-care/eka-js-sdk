# Eka Care Ekascribe Typescript SDK Integration

This guide explains how to integrate the Eka Care Ekascribe Typescript SDK into your application.

## Overview

The Eka Care Ekascribe SDK allows you to capture and process audio, generating structured medical documentation using Eka Care's voice transcription API.

## Documentation

[Visit the documentation site](https://developer.eka.care/api-reference/health-ai/ekascribe/SDKs/TS-sdk)

## Prerequisites

Before getting started, ensure you have:

- Node 14 or higher
- `npm` or `yarn` for dependency management
- Access and refresh tokens from Eka Care (optional for some methods)
- Microphone access via browser permissions
- Stable network connectivity

## Installation

Install the SDK using `npm` or `yarn`:

```bash
npm install @eka-care/ekascribe-ts-sdk
# or
yarn add @eka-care/ekascribe-ts-sdk
```

## Usage

### 1. Get Ekascribe Instance

It will give you the main class instance, use this instance to access all methods

```ts
getEkaScribeInstance({
  access_token: '<your_access_token>',
});
```

```ts
const ekaScribe = getEkaScribeInstance({ access_token: 'old_token' });
```

### 2. Fetch configurations list

Get supported input languages, output formats, and consultation modes.

```ts
ekascribe.getEkascribeConfig();
```

- #### Sample Response:

```json
{
  "data": {
    "supported_languages": [
      { "id": "en", "name": "English" },
      { "id": "hi", "name": "Hindi" }
    ],
    "supported_output_formats": [{ "id": "clinical-notes-template", "name": "Clinical Notes" }],
    "consultation_modes": [
      {
        "id": "consultation",
        "name": "Consultation",
        "desc": "Eka Scribe will listen to your conversation and create clinical notes"
      }
    ],
    "max_selection": {
      "supported_languages": 2,
      "supported_output_formats": 2,
      "consultation_modes": 1
    },
    "user_details": {
      "fn": "Dr. John",
      "mn": "",
      "ln": "Doe",
      "dob": "1985-06-15",
      "gen": "M",
      "s": "active",
      "is_paid_doc": true,
      "uuid": "user-uuid-123"
    },
    "wid": "workspace-id-456"
  },
  "message": "Configuration fetched successfully",
  "code": 200
}
```

### 3. Init transaction

Use this method to init a transaction before starting recording.

```ts
await ekascribe.initTransaction({
  mode: 'consultation',
  input_language: ['te', 'en'],
  output_format_template: [{ template_id: 'eka_emr_template' }],
  txn_id: 'abc-123',
  auto_download: false,
  model_training_consent: false,
  transfer: 'vaded' | 'non-vaded',
  model_type: 'pro' | 'lite',
  system_info: {
    platform: 'web',
    language: 'en',
    time_zone: 'Asia/Kolkata',
  },
  patient_details: {
    username: 'John Doe',
    age: 35,
    biologicalSex: 'M',
  },
  version: '1.0.0',
  flavour: 'web' | 'extension',
});
```

- #### Sample Response:

```json
{
  "status_code": 200,
  "message": "Transaction initialized successfully",
  "business_id": "biz_abc123def456",
  "txn_id": "abc-123",
  "oid": "org_789xyz",
  "uuid": "user_uuid_456"
}
```

### 4. Start recording

Start recording with user-selected options.

```ts
await ekascribe.startRecording();
```

- #### Sample Response:

```json
{
  "status_code": 200,
  "message": "Recording started successfully",
  "txn_id": "abc-123",
  error_code?: ERROR_CODE
}
```

### 5. Pause recording

Use the method to pause voice recording

```ts
await ekascribe.pauseRecording();
```

- #### Sample Response:

```json
{
  "status_code": 200,
  "message": "Recording paused successfully",
  "is_paused": true,
  error_code?: ERROR_CODE,
}
```

### 6. Resume recording

Use the method to resume voice recording

```ts
await ekascribe.resumeRecording();
```

- #### Sample Response:

```json
{
  "status_code": 200,
  "message": "Recording resumed successfully",
  "is_paused": false,
  error_code?: ERROR_CODE,
}
```

### 7. End recording

Use the method to end voice recording

```ts
await ekascribe.endRecording();
```

- #### Sample Response:

```json
{
  "status_code": 200,
  "message": "Recording ended and files uploaded successfully",
  failed_files?: ['1.mp3', '2.mp3']; // if there are any failed files
  total_audio_files?: ['1.mp3', '2.mp3', '3.mp3', '4.mp3']; // list of all audio files generated
  error_code?: ERROR_CODE;
}
```

### 8. Retry upload recording

Use this method to retry uploading failed audio files.

```ts
await ekascribe.retryUploadRecording({ force_commit: true });
```

- #### Sample Response:

```json
{
  "status_code": 200,
  "message": "All files uploaded successfully after retry",
  error_code?: ERROR_CODE;
  failed_files?: ['1.mp3', '2.mp3'];
  total_audio_files?: ['1.mp3', '2.mp3', '3.mp3', '4.mp3'];
}
```

`force_commit` behavior

-- If `force_commit` is set to `true`, the SDK will call the commit API even if some audio files still fail to upload after retrying once.

-- If `force_commit` is set to `false`, the SDK will wait until **all audio files** are uploaded successfully before making the commit request.

### 9. Patch recording session status

Use the method to cancel a recording session.

```ts
await ekascribe.patchSessionStatus({
  sessionId: 'abc-123',
  processing_status: 'cancelled',
  processing_error: {
    error: {
      type: 'user_action',
      code: 'cancelled_by_user',
      msg: 'Session cancelled by user',
    },
  },
});
```

- #### Sample Response:

```json
{
  "status": "success",
  "message": "Session status updated successfully",
  "code": 200,
  error?: {
    code: string;
    message: string;
    display_message: string;
  };
}
```

### 10. Commit transaction

Use this method to commit a transaction that is not yet committed or returned a "commit failed" error in a previous step.

```ts
await ekascribe.commitTransactionCall();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
};
```

### 11. Stop transaction

Use this method to stop a transaction that has not yet been stopped or returned a "stop failed" error in a previous step.

```ts
await ekascribe.stopTransactionCall();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
};
```

### 12. Get output template prescriptions

Use this method to fetch the final generated prescription output for a session.

```ts
await ekascribe.getTemplateOutput({ txn_id: 'abc-123' });
```

### 13. Get previous sessions

Use this method to retrieve all the previous sessions for a specific doctor ID

```ts
const sessions = await ekascribe.getSessionHistory({ txn_count: 10 });
```

- #### Response type:

```ts
{
  data: [
    {
      "created_at": "string",
      "b_id": "string",
      "user_status": "string",
      "processing_status": "string",
      "txn_id": "string",
      "mode": "string",
      "uuid": "string",
      "oid": "string"
    }
  ],
  status: "string",
  code: "number",
  message: "string",
  retrieved_count: "number"
}
```

### 14. Get All Templates

Use this method to retrieve all available templates for the current user.

```ts
const templates = await ekascribe.getAllTemplates();
```

- #### Response type:

```ts
{
  items: [
    {
      id: "123;
      title: "Template Name";
      desc: "Template Description";
      section_ids: ["section-1", "section-2"];
      is_editable: true | false;
    }
  ];
  code: number;
  error?: { code: string; message: string };
}
```

### 15. Create Template

Use this method to create a new custom template.

```ts
const newTemplate = await ekascribe.createTemplate({
  title: 'My Custom Template',
  desc: 'Description of the template',
  section_ids: ['section1', 'section2', 'section3'],
});
```

- #### Response type:

```ts
{
  code: number;
  msg: string;
  template_id?: string;
  message?: string;
  error?: { code: string; message: string };
}
```

### 16. Edit Template

Use this method to update an existing template.

```ts
const updatedTemplate = await ekascribe.updateTemplate({
  template_id: 'template-123',
  title: 'Updated Template Title',
  desc: 'Updated description',
  section_ids: ['section1', 'section2', 'section4'],
});
```

- #### Response type:

```ts
{
  code: number;
  msg: string;
  template_id?: string;
  message?: string;
  error?: { code: string; message: string };
}
```

### 17. Delete Template

Use this method to delete an existing template.

```ts
const deleteResult = await ekascribe.deleteTemplate('template-123');
```

- #### Response type:

```ts
{
  code: number;
  msg: string;
  template_id?: string;
  message?: string;
  error?: { code: string; message: string };
}
```

### 18. Generate Template with AI by giving a prompt

Use this method to generate a template using AI with a text prompt.

```ts
const formData = new FormData();
formData.append('content', 'Create a cardiology consultation template');
formData.append('file', file);
formData.append('contentType', 'text/file');

const aiTemplate = await ekascribe.aiGenerateTemplate(formData);
```

- #### Response type:

```ts
{
  title: string;
  desc: string;
  sections: [
    {
      id: string;
      title: string;
      desc: string;
      format: 'P' | 'B';
      example: string;
      default?: boolean;
      parent_section_id?: string;
    }
  ];
  code: number;
  message: string;
}
```

### 19. Add templates to list - EDIT

Use this method to update user preferences and configuration settings.

```ts
const configUpdate = await ekascribe.updateConfig({
  auto_download: true,
  default_languages: ['en', 'hi'],
  my_templates: ['template1', 'template2'],
  scribe_enabled: true,
});
```

- #### Response type:

```ts
{
  auto_download?: boolean;
  default_languages?: string[];
  my_templates?: string[];
  scribe_enabled?: boolean;
  msg: string;
  code: number;
  error?: { code: string; message: string };
}
```

### 20. Get All Sections

Use this method to retrieve all available template sections.

```ts
const sections = await ekascribe.getAllTemplateSections();
```

- #### Response type:

```ts
{
  items: [
    {
      id: string;
      title: string;
      desc: string;
      format: 'P' | 'B';
      example: string;
      default?: boolean;
      parent_section_id?: string;
    }
  ];
  code: number;
  error?: { code: string; message: string };
}
```

### 21. Create Section in a template

Use this method to create a new section that can be used in templates.

```ts
const newSection = await ekascribe.createTemplateSection({
  title: 'Chief Complaint',
  desc: "Patient's primary concern",
  format: 'P', // 'P' for paragraph, 'B' for bullet points
  example: 'Patient presents with chest pain for 2 days',
});
```

- #### Response type:

```ts
{
  msg: string;
  section_id: string;
  code: number;
  action: 'updated' | 'created_custom';
  error?: { code: string; message: string };
}
```

### 22. Edit Section in a template

Use this method to update an existing template section.

```ts
const updatedSection = await ekascribe.updateTemplateSection({
  section_id: 'section-123',
  title: 'Updated Chief Complaint',
  desc: 'Updated description',
  format: 'B',
  example: 'Updated example text',
});
```

- #### Response type:

```ts
{
  msg: string;
  section_id: string;
  code: number;
  action: 'updated' | 'created_custom';
  error?: { code: string; message: string };
}
```

### 23. Delete Section from a template

Use this method to delete a template section.

```ts
const deleteResult = await ekascribe.deleteTemplateSection('section-123');
```

- #### Response type:

```ts
{
  msg: string;
  section_id: string;
  code: number;
  action: 'updated' | 'created_custom';
  error?: { code: string; message: string };
}
```

### 24. Convert a transaction into another template after prescription generation

Use this method to convert an existing transaction's output to use a different template format.

```ts
const convertResult = await ekascribe.postTransactionConvertToTemplate({
  txn_id: 'abc-123',
  template_id: 'new-template-456',
});
```

- #### Response type:

```ts
{
  status: 'success' | 'failed';
  message: string;
  txn_id: string;
  template_id: string;
  b_id: string;
  code: number;
  msg: string;
  error?: { code: string; message: string; display_message: string };
}
```

### 25. Search past sessions by a patient name

Use this method to search through previous sessions by patient name.

```ts
// First get session history
const sessions = await ekascribe.getSessionHistory({ txn_count: 50 });

// Then search by patient name
const filteredSessions = await ekascribe.searchSessionsByPatientName({
  sessions: sessions.data || [],
  patientName: 'John Doe',
});
```

- #### Response type:

```ts
// Returns filtered array of session history data
[
  {
    created_at: 'string',
    b_id: 'string',
    user_status: 'string',
    processing_status: 'string',
    txn_id: 'string',
    mode: 'string',
    uuid: 'string',
    oid: 'string',
    patient_details: {
      username: 'string',
      oid: 'string',
      age: number,
      biologicalSex: 'M' | 'F' | 'O',
      mobile: 'string',
      email: 'string',
    },
  },
];
```

### 26. Upload audio file to get output summary

Use this method to upload audio files directly and get transcription output without real-time recording.

```ts
const audioFiles = [file1, file2]; // File or Blob objects
const audioFileNames = ['audio1.mp3', 'audio2.mp3'];

const uploadResult = await ekascribe.uploadAudioWithPresignedUrl({
  action: 'upload',
  audioFiles,
  audioFileNames,
  mode: 'consultation',
  txn_id: 'upload-session-123',
  input_language: ['en'],
  output_format_template: [{ template_id: 'eka_emr_template' }],
  transfer: 'non-vaded',
  auto_download: false,
  model_training_consent: false,
  system_info: {
    platform: 'web',
    language: 'en',
    time_zone: 'Asia/Kolkata',
  },
  model_type: 'pro',
});
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  business_id?: string;
  txn_id?: string;
  oid?: string;
  uuid?: string;
}
```

### 27. Edit output summary

Use this method to edit the generated output summary for a completed transaction.

```ts
const editResult = await ekascribe.updateResultSummary({
  txnId: 'abc-123',
  data: [
    {
      'template-id': 'eka_emr_template',
      data: 'Updated prescription content here',
    },
  ],
});
```

- #### Response type:

```ts
{
  status: string;
  message: string;
  txn_id: string;
  b_id: string;
  code: number;
  error?: { code: string; message: string; display_message: string };
}
```

## Utility Methods

```ts
const ekaScribe = getEkaScribeInstance({ access_token: 'old_token' });
```

### 1. Get total uploaded files

Use this method to retrieve all the audio files generated for a specific session.

```ts
const files = ekascribe.getTotalAudioFiles();
```

- #### Response type:

```ts
['1.mp3', '2.mp3', '3.mp3', '4.mp3'];
```

### 2. Get successfully uploaded files

Use this method to retrieve all the audio files that were uploaded successfully.

```ts
const successFiles = ekascribe.getSuccessFiles();
```

- #### Response type:

```ts
['3.mp3', '4.mp3'];
```

### 3. Get failed audio files

Use this method to retrieve all the audio files that failed to upload.

```ts
const failedFiles = ekascribe.getFailedFiles();
```

- #### Response type:

```ts
['1.mp3', '2.mp3'];
```

### 4. Reset Class Instance

Use this method to reset the EkaScribe instance and clear all stored data.

```ts
ekaScribe.resetEkaScribe();
```

### 5. Reinitialise VAD Instance

Use this method to reinitialize the Voice Activity Detection (VAD) instance.

```ts
ekaScribe.reinitializeVad();
```

### 6. Pause VAD Instance

Use this method to pause the Voice Activity Detection without stopping the recording session.

```ts
ekaScribe.pauseVad();
```

### 7. Destroy VAD Instance

Use this method to completely destroy the VAD instance and free up resources.

```ts
ekaScribe.destroyVad();
```

### 8. Update Authentication Tokens

Use this method to update the access token without reinitializing the entire SDK instance.

```ts
ekaScribe.updateAuthTokens({ access_token: 'new_token' });
```

### 9. Configure VAD Constants

Use this method to configure Voice Activity Detection parameters for fine-tuning audio processing.

```ts
ekaScribe.configureVadConstants({
  pref_length: 1000,
  desp_length: 500,
  max_length: 2000,
  sr: 16000,
  frame_size: 512,
  pre_speech_pad_frames: 10,
  short_thsld: 0.5,
  long_thsld: 0.8,
});
```

## Generic Callbacks

### 1. Event callback

Whenever an error occurs in the SDK during voice recording, the following callback will be triggered. You can listen to this to handle errors globally.

```ts
onEventCallback;
```

### 2. User speech callback

This callback will return a boolean indicating whether the user is speaking or not.

```ts
onUserSpeechCallback((isSpeech) => {
  console.error(isSpeech ? 'User is speaking' : 'User is not speaking');
});
```

### 3. VAD Callback to check speech or not for a frame

This callback provides the number of successfully uploaded files, the total number of files, the filename, and the chunk data for a particular file.

```ts
onVadFramesCallback;
```

### Error codes

| Error Code            | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| `microphone`          | Microphone access error (permission denied or unavailable)  |
| `txn_init_failed`     | Failed to initialize transaction                            |
| `txn_limit_exceeded`  | Maximum number of concurrent transactions exceeded          |
| `unknown_error`       | An unknown or unclassified error occurred                   |
| `txn_stop_failed`     | Error occurred while stopping the transaction               |
| `audio_upload_failed` | Audio file upload to server failed                          |
| `txn_commit_failed`   | Commit call failed for the current transaction              |
| `invalid_request`     | Request to SDK was malformed or missing required parameters |
| `vad_not_initialized` | Voice activity detection engine was not initialized         |
| `no_audio_capture`    | No audio was captured during the recording session          |
| `txn_status_mismatch` | Invalid operation due to mismatched transaction status      |

## Contribution Guidelines

This is a continually updated, open source project.
Contributions are welcome!

## Tips

- The SDK internally handles shared worker logic to reduce load on the main thread. Try to execute these functions in the main thread to avoid unnecessary issues.

## Advanced Usage (for later use)

- Maximum retries for file upload in case of failure.
- Update VAD configurations

## Under Development

- Opus compression of audio files
- Test cases

Refer [Ekascribe](https://github.com/eka-care/v2rx-extension) for SDK implementations.
