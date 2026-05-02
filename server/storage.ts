import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";

type ForgeStorageConfig = { baseUrl: string; apiKey: string };

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const segmentStart = relKey.lastIndexOf("/");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1 || lastDot <= segmentStart) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function getForgeStorageConfig(): ForgeStorageConfig | null {
  const baseUrl = ENV.forgeApiUrl.trim();
  const apiKey = ENV.forgeApiKey.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildForgeUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildForgeDownloadUrl(baseUrl: string, relKey: string, apiKey: string): Promise<string> {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return (await response.json()).url;
}

function toFormData(data: Buffer | Uint8Array | string, contentType: string, fileName: string): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function getS3Config() {
  const bucket = ENV.s3Bucket.trim();
  const region = ENV.s3Region.trim();
  const accessKeyId = ENV.awsAccessKeyId.trim();
  const secretAccessKey = ENV.awsSecretAccessKey.trim();
  let endpoint = ENV.s3Endpoint.trim();

  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;

  // Cloudflare's UI sometimes shows an S3 endpoint URL that includes `/<bucket>` at the end.
  // The AWS SDK expects `endpoint` to be the service host, with bucket provided separately.
  if (endpoint.length > 0) {
    try {
      const url = new URL(endpoint);
      const segments = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
      if (segments.length === 1 && segments[0] === bucket) {
        url.pathname = "/";
        endpoint = url.toString().replace(/\/+$/, "");
      }
    } catch {
      // ignore invalid endpoint here; S3Client will throw a clearer error later
    }
  }

  return { bucket, region, accessKeyId, secretAccessKey, endpoint };
}

function buildPublicObjectUrl(bucket: string, region: string, key: string): string {
  const base = ENV.s3PublicBaseUrl.trim().replace(/\/+$/, "");
  if (base.length > 0) {
    return `${base}/${encodeURI(key).replace(/%2F/g, "/")}`;
  }

  // Default AWS virtual-hosted-style URL (works for standard AWS S3 buckets).
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key).replace(/%2F/g, "/")}`;
}

let _s3Client: S3Client | null = null;

function getS3Client() {
  const cfg = getS3Config();
  if (!cfg) {
    throw new Error("S3 storage is not configured");
  }

  if (!_s3Client) {
    _s3Client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint.length > 0 ? cfg.endpoint : undefined,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: ENV.s3ForcePathStyle,
    });
  }

  return { client: _s3Client, bucket: cfg.bucket, region: cfg.region };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));

  const forge = getForgeStorageConfig();
  if (forge) {
    const uploadUrl = buildForgeUploadUrl(forge.baseUrl, key);
    const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${forge.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
    }

    const url = (await response.json()).url as string;
    return { key, url };
  }

  const s3 = getS3Client();
  const body = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.isBuffer(data) ? data : Buffer.from(data);

  await s3.client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: buildPublicObjectUrl(s3.bucket, s3.region, key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  const forge = getForgeStorageConfig();
  if (forge) {
    return {
      key,
      url: await buildForgeDownloadUrl(forge.baseUrl, key, forge.apiKey),
    };
  }

  const s3 = getS3Client();
  return { key, url: buildPublicObjectUrl(s3.bucket, s3.region, key) };
}
