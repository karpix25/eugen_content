import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import dotenv from "dotenv";

dotenv.config();

export const normalizeRemoteUrl = (url?: string | null) => {
  if (!url) return url || "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(\/|$)/i.test(url)) return `https://${url}`;
  return url;
};

export const buildPublicS3Url = (key: string) => {
  const endpoint = normalizeRemoteUrl(process.env.S3_ENDPOINT || "");
  const bucket = process.env.S3_BUCKET_NAME || "";

  if (endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  }

  return `https://${bucket}.s3.amazonaws.com/${key}`;
};

export const s3Client = new S3Client({
  ...(process.env.S3_ENDPOINT && process.env.S3_ENDPOINT !== 'your_s3_endpoint' && process.env.S3_ENDPOINT !== '' ? { endpoint: process.env.S3_ENDPOINT } : {}),
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

  const result: any = await upload.done();
  const normalizedLocation = normalizeRemoteUrl(result.Location) || buildPublicS3Url(fileName);

  return {
    ...result,
    Location: normalizedLocation
  };
}
