# Eka Care Ekascribe Typescript SDK Integration

This guide explains how to integrate the Eka Care Ekascribe Typescript SDK into your application.

## Overview

The Eka Care Ekascribe SDK allows you to capture and process audio, generating structured medical documentation using Eka Care's voice transcription API.

## Documentation

[Visit the documentation site](https://developer.eka.care/api-reference/general-tools/medical/voice/SDKs/TS-sdk)

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
npm install ekascribe-ts-sdk
# or
yarn add ekascribe-ts-sdk
```

## Usage

### 1. Initialize Ekascribe

Before using any other method, initialize the SDK with access and refresh tokens.

```ts
initEkascribe({
  access_token: '<your_access_token>',
  refresh_token: '<your_refresh_token>',
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

### 3. Start recording

Start recording with user-selected options.

```ts
await startVoiceRecording({
  mode: 'consultation',
  input_language: ['te', 'en'],
  output_format_template: [{ template_id: 'eka_emr_template' }],
  txn_id: 'abc-123',
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
};
```

### 4. Pause recording

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

### 5. Resume recording

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

### 6. End recording

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

### 7. Retry upload recording

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

### 8. Cancel recording session

Use the method to cancel a recording session.

```ts
await cancelRecordingSession({ txn_id: 'abc-123' });
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

### 9. Commit transaction

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

### 10. Stop transaction

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

### 11. Get output template prescriptions

Use this method to fetch the final generated prescription output for a session.

```ts
await getTemplateOutput({ txn_id: 'abc-123' });
```

### 12. Get total uploaded files

Use this method to retrieve all the audio files generated for a specific session.

```ts
const files = await getTotalAudioFiles();
```

- #### Response type:

```ts
['1.mp3', '2.mp3', '3.mp3', '4.mp3'];
```

### 13. Get successfully uploaded files

Use this method to retrieve all the audio files that were uploaded successfully.

```ts
const successFiles = await getSuccessfullyUploadedFiles();
```

- #### Response type:

```ts
['3.mp3', '4.mp3'];
```

### 14. Get failed audio files

Use this method to retrieve all the audio files that failed to upload.

```ts
const failedFiles = await getFailedFiles();
```

- #### Response type:

```ts
['1.mp3', '2.mp3'];
```

### 15. Generic Error Callback

Whenever an error occurs in the SDK during voice recording, the following callback will be triggered. You can listen to this to handle errors globally.

```ts
onError(({ error_code, status_code, message }) => {
  console.error('Ekascribe SDK Error:', { error_code, status_code, message });
});
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

---

## Tips

Helpful tricks and practices for smoother development and usage.

---

## Advanced Usage (for later use)

---

## Under Development

Features and methods that are being worked on. Not stable or ready for use.

---

Refer [Ekascribe](https://github.com/eka-care/v2rx-extension) for SDK implementations.
