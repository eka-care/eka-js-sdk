import * as AWS from 'aws-sdk';

type TAwsCredentials = {
  accessKeyId: string;
  secretKey: string;
  sessionToken: string;
};

let currentAwsCredentials: TAwsCredentials | null = null;

export function configureAWS({ accessKeyId, secretKey, sessionToken }: TAwsCredentials) {
  try {
    // Store credentials for consumers like aws4-based S3 uploads
    currentAwsCredentials = {
      accessKeyId,
      secretKey,
      sessionToken,
    };

    // Also configure the global AWS SDK client (used in legacy paths / shared worker)
    AWS.config.update({
      sessionToken,
      accessKeyId,
      secretAccessKey: secretKey,
    });
  } catch (err) {
    console.log(err, 'AWS config error');
    throw err;
  }
}

export function getConfiguredAwsCredentials(): TAwsCredentials | null {
  return currentAwsCredentials;
}
