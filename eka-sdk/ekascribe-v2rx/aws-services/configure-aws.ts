type TAwsCredentials = {
  accessKeyId: string;
  secretKey: string;
  sessionToken: string;
};

let currentAwsCredentials: TAwsCredentials | null = null;

export function configureAWS({ accessKeyId, secretKey, sessionToken }: TAwsCredentials) {
  try {
    // Store credentials for aws4fetch-based S3 uploads
    currentAwsCredentials = {
      accessKeyId,
      secretKey,
      sessionToken,
    };
  } catch (err) {
    console.log(err, 'AWS config error');
    throw err;
  }
}

export function getConfiguredAwsCredentials(): TAwsCredentials | null {
  return currentAwsCredentials;
}
