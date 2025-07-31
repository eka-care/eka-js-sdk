import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

const translateClient = new TranslateClient({ region: 'ap-south-1' }); // e.g., "us-east-1"

async function awsTranslateText({
  source_language,
  target_language,
  content,
}: {
  source_language: string;
  target_language: string;
  content: string;
}) {
  const command = new TranslateTextCommand({
    SourceLanguageCode: source_language,
    TargetLanguageCode: target_language,
    Text: content,
  });

  try {
    const result = await translateClient.send(command);
    console.log(result, 'result');
    console.log('Translated text:', result.TranslatedText);
  } catch (error) {
    console.error('Translation error:', error);
  }
}

export default awsTranslateText;
