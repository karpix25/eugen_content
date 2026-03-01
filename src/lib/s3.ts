import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import dotenv from "dotenv";

dotenv.config();

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

export async function uploadToS3(file: Buffer | Uint8Array, fileName: string, contentType: string) {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: file,
      ContentType: contentType,
      ACL: "public-read",
    },
  });

  return upload.done();
}
