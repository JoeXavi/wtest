import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const tableName = process.env.TABLE_NAME ?? 'norte-main';
const region = process.env.AWS_REGION ?? 'us-east-1';
const PRODUCT_ID = '01PRODUCTDEVHOURS0';
const STOCK_HOURS = Number(process.env.RESTOCK_HOURS ?? 96);

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region,
    endpoint,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
    },
  }),
  { marshallOptions: { removeUndefinedValues: true } },
);

async function main(): Promise<void> {
  const pk = `PRODUCT#${PRODUCT_ID}`;
  const reservations = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': 'RESERVATION#',
      },
    }),
  );

  let deleted = 0;
  for (const item of reservations.Items ?? []) {
    await client.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: item.PK as string, SK: item.SK as string },
      }),
    );
    deleted += 1;
  }

  const now = new Date().toISOString();
  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: pk, SK: pk },
      UpdateExpression: 'SET stock = :stock, reserved = :zero, updatedAt = :now',
      ExpressionAttributeValues: {
        ':stock': STOCK_HOURS,
        ':zero': 0,
        ':now': now,
      },
    }),
  );

  console.log(
    `Restocked ${PRODUCT_ID}: stock=${STOCK_HOURS}, reserved=0, removed ${deleted} reservation(s)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
