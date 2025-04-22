// TODO: check if this import working
import * as AWS from 'aws-sdk';

export function configureAWS({
  accessKeyId,
  secretKey,
  sessionToken,
}: {
  accessKeyId: string;
  secretKey: string;
  sessionToken: string;
}) {
  try {
    AWS.config.update({
      sessionToken,
      accessKeyId,
      secretAccessKey: secretKey,
    });
  } catch (err) {
    console.log(err, 'AWS config error');
  }
}
