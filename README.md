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

### 2. Fetch configurations list

Get supported input languages, output formats, and consultation modes.

```ts
getEkascribeConfig();
```

- #### Response type:

```ts
{
  data?: {
    supported_languages: [
      { id: '1', name: 'EN' },
      { id: '2', name: 'HI' }
    ];
    supported_output_formats: [
      { id: 'eka-emr-template', name: 'Eka EMR Format' },
      { id: 'clinical-notes-template', name: 'Clinical Notes' }
    ];
    consultation_modes: [
      {
        id: 'consultation',
        name: 'Consultation',
        desc: 'Eka Scribe will listen to your conversation and create clinical notes'
      },
      {
        id: 'dictation',
        name: 'Dictation',
        desc: 'Dictate your notes to Eka Scribe and create clinical notes'
      }
    ];
    max_selection: {
      languages: 2;
      output_formats: 2;
      consultation_mode: 2;
    };
  };
  message?: string;
  code?: number;
}
```

### 3. Init transaction

Use this method to init a transaction before starting recording.

```ts
await initTransaction({
  mode: 'consultation',
  input_language: ['te', 'en'],
  output_format_template: [{ template_id: 'eka_emr_template' }],
  txn_id: 'abc-123',
  auto_download: false,
  model_training_consent: false,
  transfer: 'vaded' | 'non-vaded',
  model: 'pro' | 'lite',
  system_info: {},
  patient_details: {},
  version: '1.0.0',
  flavour: 'web' | 'extension',
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
};
```

### 4. Start recording

Start recording with user-selected options.

```ts
await startRecording();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  txn_id?: string;
};
```

### 5. Pause recording

Use the method to pause voice recording

```ts
await pauseRecording();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  is_paused?: boolean;
};
```

### 6. Resume recording

Use the method to resume voice recording

```ts
await resumeRecording();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  is_paused?: boolean;
};
```

### 7. End recording

Use the method to end voice recording

```ts
await endRecording();
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  failed_files?: ['1.mp3', '2.mp3']; // if there are any failed files
  total_audio_files?: ['1.mp3', '2.mp3', '3.mp3', '4.mp3']; // list of all audio files generated
};
```

### 8. Retry upload recording

Use this method to retry uploading failed audio files.

```ts
await retryUploadRecording({ force_commit: true / false });
```

- #### Response type:

```ts
{
  error_code?: ERROR_CODE;
  status_code: number;
  message: string;
  failed_files?: ['1.mp3', '2.mp3'];
  total_audio_files?: ['1.mp3', '2.mp3', '3.mp3', '4.mp3'];
};
```

`force_commit` behavior

-- If `force_commit` is set to `true`, the SDK will call the commit API even if some audio files still fail to upload after retrying once.

-- If `force_commit` is set to `false`, the SDK will wait until **all audio files** are uploaded successfully before making the commit request.

### 9. Patch recording session status

Use the method to cancel a recording session.

```ts
await patchSessionStatus({
  sessionId: 'abc-123',
  processing_status: 'cancelled',
  processing_error: {
    error: {
      type: '',
      code: 'cancelled_by_user',
      msg: 'Cancelled_by_user',
    },
  },
});
```

- #### Response type:

```ts
{
  status: string;
  message: string;
  code: number;
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
await commitTransactionCall();
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
await stopTransactionCall();
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
await getTemplateOutput({ txn_id: 'abc-123' });
```

### 13. Get previous sessions

Use this method to retrieve all the previous sessions for a specific doctor ID

```ts
const sessions = await getSessionHistory({ txn_count: 10 });
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

### 15. Create Template

### 16. Edit Template

### 17. Delete Template

### 18. Generate Template with AI by giving a prompt

### 19. Add/Remove templates to list

### 20. Get All Sections

### 21. Create Section in a template

### 22. Edit Section in a template

### 23. Delete Section from a template

### 24. Convert a template into another template after prescription generation

### 25. Search past sessions by a patient name

### 26. Upload audio file to get output summary

### 27. Edit output summary

## Utility Methods

### 1. Get total uploaded files

Use this method to retrieve all the audio files generated for a specific session.

```ts
const files = await getTotalAudioFiles();
```

- #### Response type:

```ts
['1.mp3', '2.mp3', '3.mp3', '4.mp3'];
```

### 2. Get successfully uploaded files

Use this method to retrieve all the audio files that were uploaded successfully.

```ts
const successFiles = await getSuccessfullyUploadedFiles();
```

- #### Response type:

```ts
['3.mp3', '4.mp3'];
```

### 3. Get failed audio files

Use this method to retrieve all the audio files that failed to upload.

```ts
const failedFiles = await getFailedFiles();
```

- #### Response type:

```ts
['1.mp3', '2.mp3'];
```

### 4. Reset Class Instance

### 5. Reinitialise VAD Instance

### 6. Pause VAD Instance

### 7. Destroy VAD Instance

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
