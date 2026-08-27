import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const tableName = process.env.TABLE_NAME ?? 'norte-main';
const region = process.env.AWS_REGION ?? 'us-east-1';

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

const PRODUCT_ID = '01PRODUCTDEVHOURS0';
const now = new Date().toISOString();

async function main(): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `PRODUCT#${PRODUCT_ID}`,
        SK: `PRODUCT#${PRODUCT_ID}`,
        GSI1PK: 'PRODUCT',
        GSI1SK: 'JoeXavi Dev Hours',
        entityType: 'PRODUCT',
        schemaVersion: 1,
        productId: PRODUCT_ID,
        name: 'JoeXavi Dev Hours',
        description:
          'Senior full-stack pairing time. Architecture, delivery, and hands-on implementation. Even better with AI assistance.',
        unit: 'HOUR',
        unitPriceCents: 5_000_000,
        currency: 'COP',
        usdUnitPrice: 20,
        usdRateCop: 2500,
        stock: 96,
        reserved: 0,
        image: {
          key: '/images/dev-hours.svg',
          width: 1200,
          height: 750,
          alt: 'Laptop and code editor on a desk',
        },
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );
  console.log(`Seeded product ${PRODUCT_ID}`);
}

main().catch((error) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'ConditionalCheckFailedException'
  ) {
    console.log('Product already seeded');
    return;
  }
  console.error(error);
  process.exit(1);
});
