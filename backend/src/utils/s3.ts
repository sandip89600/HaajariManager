import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const bucketName = process.env.AWS_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// Check if S3 credentials are fully specified
const isConfigured = !!(
  region &&
  bucketName &&
  accessKeyId &&
  secretAccessKey
);

let s3Client: S3Client | null = null;

if (isConfigured) {
  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
}

export function isS3Configured(): boolean {
  return isConfigured;
}

export async function uploadToS3(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (!isConfigured || !s3Client || !bucketName) {
    throw new Error("S3 is not configured");
  }

  const uniqueFileName = `${Date.now()}_${fileName.replace(/\s+/g, "_")}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: uniqueFileName,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  // Return the public S3 URL
  return `https://${bucketName}.s3.${region}.amazonaws.com/${uniqueFileName}`;
}
