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

## Bundler Setup

The SDK uses a SharedWorker for background audio uploads. Modern bundlers (Webpack 5, Vite) automatically handle the worker bundling.

### Vite

Works out of the box - no configuration needed.

```ts
// Just import and use
import { getEkaScribeInstance } from '@eka-care/ekascribe-ts-sdk';
```

### Webpack 5

Works out of the box with default configuration. The `new URL(..., import.meta.url)` pattern is natively supported.

```ts
import { getEkaScribeInstance } from '@eka-care/ekascribe-ts-sdk';
```

### Next.js

For Next.js projects, ensure the SDK is only used on the client side:

```tsx
'use client';

import { getEkaScribeInstance } from '@eka-care/ekascribe-ts-sdk';

// Use inside a client component
const ekascribe = getEkaScribeInstance({ access_token: 'your_token' });
```

### Browser (Script Tag)

For direct browser usage without a bundler:

```html
<script type="module">
  import { getEkaScribeInstance } from 'https://cdn.jsdelivr.net/npm/@eka-care/ekascribe-ts-sdk/dist/index.mjs';

  const ekascribe = getEkaScribeInstance({ access_token: 'your_token' });
</script>
```

## Usage

### 1. Get Ekascribe Instance

Get the SDK instance once and use it everywhere in your application to call all methods.

```ts
// Create a config variable to manage tokens
const sdkConfig = {
  access_token: '<your_access_token>',
};

// Get instance and use it throughout your application
const ekascribe = getEkaScribeInstance(sdkConfig);
```

**Important:** Use this same `ekascribe` instance for all SDK method calls.

### 2. Fetch configurations list

Get supported input languages, output formats, and consultation modes.

```ts
const config = await ekascribe.getEkascribeConfig();
```

- #### Sample Response:

```ts
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

Initialize a transaction before starting recording. This sets up the session with your configuration.

```ts
const response = await ekascribe.initTransaction({
  mode: 'consultation',
  input_language: ['en-IN'],
  output_format_template: [{ template_id: 'your_template_id' }],
  txn_id: 'unique-transaction-id',
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
  additional_data: {},
});
```

**Key Parameters:**

- `input_language`: Language code array (e.g., `['en-IN']`)
- `output_format_template`: Array with `template_id` - depends on your end user's template selection
- `system_info`: Optional - Pass your system configuration to backend
- `patient_details`: Optional - Patient information
- `version`: SDK version
- `additional_data`: Optional - Pass any data you want to receive unchanged in the response
- `transfer`: Audio mode. Use `vaded` for audio already processed with Voice Activity Detection (SDK does this by default); use `non-vaded` only if you are sending raw audio without VAD.
- `model_type`: Transcription model choice. `pro` = most accurate; `lite` = lower latency, more performant.

- #### Sample Response:

```ts
{
  "status_code": 200,
  "message": "Transaction initialized successfully",
  "business_id": "biz_abc123def456",
  "txn_id": "abc-123",
  "oid": "org_789xyz",
  "uuid": "user_uuid_456"
}
```

**Handling 401 Status Code:**

If you receive a `status_code: 401`, update the tokens in your config and reinitialize the instance:

```ts
// Update tokens in your config variable
sdkConfig.access_token = '<new_access_token>';

// Update tokens in the instance
ekascribe.updateAuthTokens({ access_token: sdkConfig.access_token });

// Now you can retry the method call
const response = await ekascribe.initTransaction({ ... });
```

### 4. Start recording

Start recording audio after initializing the transaction.

```ts
const response = await ekascribe.startRecording();
```

- #### Sample Response:

```ts
{
  "status_code": 200,
  "message": "Recording started successfully",
  "txn_id": "abc-123",
  // Possible error codes:
  // - "microphone" -> microphone permission not granted
  // - "vad_not_initialized" -> VAD failed to initialize; reinitialize and retry the same function call
  error_code?: ERROR_CODE
}
```

### 5. Pause recording

Pause the ongoing voice recording.

```ts
const response = await ekascribe.pauseRecording();
```

- #### Sample Response:

```ts
{
  "status_code": 200,
  "message": "Recording paused successfully",
  "is_paused": true,
  error_code?: ERROR_CODE,
}
```

### 6. Resume recording

Resume a paused recording.

```ts
const response = await ekascribe.resumeRecording();
```

- #### Sample Response:

```ts
{
  "status_code": 200,
  "message": "Recording resumed successfully",
  "is_paused": false,
  error_code?: ERROR_CODE,
}
```

### 7. End recording

End the recording session. This method:

- Stops the recording
- Uploads all audio chunks to the server
- Automatically retries failed uploads once
- Calls the commit API to finalize the transaction

```ts
const response = await ekascribe.endRecording();
```

- #### Sample Response:

```ts
{
  "status_code": 200,
  "message": "Recording ended and files uploaded successfully",
  failed_files?: ['1.mp3', '2.mp3'], // Only present if some files failed to upload
  total_audio_files?: ['1.mp3', '2.mp3', '3.mp3', '4.mp3'], // List of all audio files generated
  error_code?: ERROR_CODE;
}
```

**Error handling:**

- Possible Error Codes, `error_code`
- `txn_stop_failed`: Call `endRecording` again.
- `audio_upload_failed`: Use `retryUploadRecording` (step 8).
- `txn_commit_failed`: Call `commitTransactionCall` (step 10).

### 8. Get output template prescriptions

Use this method to fetch the final generated prescription output for a session.

```ts
await ekascribe.getTemplateOutput({ txn_id: 'abc-123' });
```

- #### Response type:

```ts
{
  response?: {
    data: {
      output: TOutputSummary[];
      template_results: {
        integration: TOutputSummary[];
        custom: TOutputSummary[];
      };
      audio_matrix?: {
        quality: string;
      };
      additional_data?: {
        doctor: {
          _id: string;
          profile: {
            personal: {
              name: {
                l: string;
                f: string;
              };
            };
          };
        };
      };
      meta_data?: {
        total_resources?: number;
        total_parsed_resources?: number;
      };
      created_at?: string;
    };
    error?: {
      code: string;
      msg: string;
    };
  } | null;
  status_code: number;
  message?: string;
}

type TOutputSummary = {
  template_id: string;
  value?: string | null; // base64 encoded
  type: string;
  name: string;
  status: 'success' | 'partial_success' | 'failure';
  errors?: Array<{
    type: 'warning' | 'error';
    code?: string;
    msg: string;
  }>;
  warnings?: Array<{
    type: 'warning' | 'error';
    code?: string;
    msg: string;
  }>;
};
```

- #### Example Response:

```ts
{
  status_code: 200,
  response: {
    data: {
      output: [
        {
          template_id: "template_123",
          value: "eyJwYXRpZW50Ijp7Im5hbWUiOiJKb2huIERvZSJ9fQ==",
          type: "custom",
          name: "General Prescription",
          status: "success"
        }
      ],
      template_results: {
        integration: [
          {
            template_id: "integration_template_456",
            value: "eyJkaWFnbm9zaXMiOiJDb21tb24gQ29sZCJ9",
            type: "json",
            name: "Diagnosis Template",
            status: "success"
          }
        ],
        custom: [
          {
            template_id: "custom_template_789",
            value: "eyJtZWRpY2F0aW9ucyI6W119",
            type: "custom",
            name: "Custom Medication Template",
            status: "partial_success",
            warnings: [
              {
                type: "warning",
                code: "FIELD_MISSING",
                msg: "Dosage information not found"
              }
            ]
          }
        ]
      },
      audio_matrix: {
        quality: "4.5"
      },
      additional_data: {
        doctor: {
          _id: "doc_001",
          profile: {
            personal: {
              name: {
                l: "Smith",
                f: "Dr. Jane"
              }
            }
          }
        }
      },
      meta_data: {
        total_resources: 10,
        total_parsed_resources: 9
      },
      created_at: "2024-11-19T10:30:00Z"
    }
  }
}
```

### 9. Retry upload recording

Retry uploading failed audio files after `endRecording`.

```ts
const response = await ekascribe.retryUploadRecording({ force_commit: true });
```

- #### Sample Response:

```ts
{
  "status_code": 200,
  "message": "All files uploaded successfully after retry",
  error_code?: ERROR_CODE;
  failed_files?: ['1.mp3', '2.mp3'];
  total_audio_files?: ['1.mp3', '2.mp3', '3.mp3', '4.mp3'];
}
```

**`force_commit` behavior:**

- `force_commit: true` - Model will initiate the processing if some files still fail after retry
- `force_commit: false` - It will waits until all files are uploaded successfully before processing.

### 10. Patch recording session status

Cancel or update the status of a recording session.

```ts
const response = await ekascribe.patchSessionStatus({
  sessionId: 'abc-123', // txn_id of the session you want to cancel
  processing_status: 'cancelled', // pass exactly this value
  processing_error: {
    error: {
      // Pass these exact values without changing them
      type: 'user_action',
      code: 'cancelled_by_user',
      msg: 'Session cancelled by user',
    },
  },
});
```

- #### Sample Response:

```ts
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

### 11. Commit transaction

Call this if `endRecording` returns `error_code: 'txn_commit_failed'` or the transaction is not yet committed.

```ts
const response = await ekascribe.commitTransactionCall();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
};
```

### 12. Stop transaction

Use this method to stop a transaction that has not yet been stopped or returned a `txn_stop_failed` error in a previous step.

```ts
const response = await ekascribe.stopTransactionCall();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
};
```

### 13. Get previous sessions

Fetch previous sessions. `txn_count` controls how many sessions the API returns.

```ts
const sessions = await ekascribe.getSessionHistory({ txn_count: 10 }); // txn_count = number of sessions to fetch
```

- #### Response type:

```ts
{
  data: [
    {
      b_id: "7174661713699045", // business ID
      created_at: "2025-12-10T10:28:00Z",
      mode: "consultation",
      oid: "174661713843153", // logged-in doctor's org ID
      patient_details: {      // present only if sent in initTransaction
        "age": 18,
        "biologicalSex": "M",
        "username": ""
      },
      // processing_status can be: success | system_failure | request_failure | cancelled | in-progress
      processing_status: "in-progress",
      txn_id: "sc-c2e9be8b-46e5-489a-9473-236ddb5b24fb",
      // user_status can be: init | commit
      user_status: "init",
      uuid: "c44fd76d-8de1-4011-aa54-5ddcca140f0f" // logged-in doctor's user ID
    }
  ],
  status: "success",
  code: 200,
  message: "Sessions fetched",
  retrieved_count: 1
}
```

## Templates SDK Methods

### 1. Get All Templates

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

### 2. Create Template

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

### 3. Edit Template

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

### 4. Delete Template

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

### 5. Generate Template with AI by giving a prompt

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

### 6. Add templates to list

Use this method to mark templates as favourite templates.

```ts
const configUpdate = await ekascribe.updateConfig({
  my_templates: ['template1', 'template2'],
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

### 7. Get All Sections

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

### 8. Create Section in a template

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

### 9. Edit Section in a template

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

### 10. Delete Section from a template

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

### 11. Convert a transaction into another template after prescription generation

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

## Non-vaded flow, upload raw audio to get output summary

### 1. Upload audio file to get output summary

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

### Edit output summary

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

## Generic Callbacks

```ts
const ekaScribe = getEkaScribeInstance({ access_token: 'your_token' });
```

### 1. Event callback

This is a comprehensive callback that provides information about SDK operations, including success events, errors, progress updates, and system status. Use this callback to monitor all SDK activities and handle events globally in your application.

```ts
ekaScribe.onEventCallback((eventData) => {
  console.log('Event callback triggered:', eventData);
});
```

- #### Sample Callback Data:

```ts
{
  callback_type: 'AUDIO_UPLOAD' | 'TRANSACTION_STATUS' | 'VAD_STATUS' | 'RECORDING_STATUS',
  status: 'success' | 'error' | 'progress' | 'info',
  message: 'Audio file uploaded successfully',
  error?: {
    code: 500,
    msg: 'Upload failed',
    details: { fileName: 'audio_chunk_1.mp3' }
  },
  data?: {
    success: 3,
    total: 4,
    is_uploaded: true,
    fileName: 'audio_chunk_1.mp3',
    request: { txn_id: 'abc-123' },
    response: { status: 'uploaded' }
  },
  timestamp: '2024-01-15T10:30:45.123Z',
  metadata?: {
    txn_id: 'abc-123',
    chunk_index: 1
  }
}
```

### 2. User speech callback

This callback will return a boolean indicating whether the user is speaking or not.

```ts
ekaScribe.onUserSpeechCallback((isSpeech) => {
  console.log(isSpeech ? 'User is speaking' : 'User is not speaking');
});
```

### 3. VAD Callback to check if a frame is valid speech or not

This callback provides information about voice activity detection frames and audio processing status.

```ts
ekaScribe.onVadFramesCallback((vadData) => {
  console.log('VAD frame processed:', vadData);
});
```

- #### Sample Callback Data:

```ts
{
  status_code: 200,
  message: 'Audio captured. | No audio captured.',
  error_code?: 'speech_detected' | 'no_audio_capture'
}
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
