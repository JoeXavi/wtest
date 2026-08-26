import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

export const DYNAMO_CLIENT = Symbol('DYNAMO_CLIENT');

export function createDynamoClient(config: ConfigService): DynamoDBDocumentClient {
  const endpoint = config.get<string>('DYNAMODB_ENDPOINT');
  const client = new DynamoDBClient({
    region: config.get<string>('AWS_REGION') ?? 'us-east-1',
    ...(endpoint
      ? {
          endpoint,
          credentials: {
            accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID') ?? 'local',
            secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY') ?? 'local',
          },
        }
      : {}),
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}
