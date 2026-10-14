import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const ROOT = path.join(process.cwd(), "storage");

const TYPES: Record<string, { kind: "IMAGE" | "VIDEO" | "DOCUMENT"; max: number; magic: (bytes: Uint8Array) => boolean }> = {
  "image/jpeg": { kind: "IMAGE", max: 8_000_000, magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { kind: "IMAGE", max: 8_000_000, magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/webp": { kind: "IMAGE", max: 8_000_000, magic: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 },
  "image/gif": { kind: "IMAGE", max: 8_000_000, magic: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  "video/mp4": { kind: "VIDEO", max: 50_000_000, magic: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  "video/quicktime": { kind: "VIDEO", max: 50_000_000, magic: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  "application/pdf": { kind: "DOCUMENT", max: 15_000_000, magic: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
};

export function inspectUpload(mimeType: string, bytes: Uint8Array) {
  const rule = TYPES[mimeType];
  if (!rule) return { error: "Tipo de archivo no admitido." } as const;
  if (bytes.byteLength > rule.max) return { error: "El archivo supera el tamaño permitido." } as const;
  if (bytes.byteLength < 12 || !rule.magic(bytes)) return { error: "El contenido no coincide con el tipo declarado." } as const;
  return { kind: rule.kind } as const;
}

function s3() {
  if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) return null;
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
  });
}

export async function saveBytes(workspaceId: string, filename: string, mimeType: string, bytes: Uint8Array) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "archivo";
  const key = `${workspaceId}/${randomBytes(16).toString("hex")}-${safe}`;
  const client = s3();
  if (client && process.env.S3_BUCKET) {
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: bytes, ContentType: mimeType }));
  } else {
    const full = path.join(ROOT, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
  const publicUrl = process.env.S3_PUBLIC_BASE_URL ? `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}` : undefined;
  return { key, publicUrl };
}

export async function readBytes(storageKey: string) {
  if (storageKey.includes("..")) throw new Error("Ruta no válida.");
  const client = s3();
  if (client && process.env.S3_BUCKET) {
    const result = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: storageKey }));
    const body = result.Body;
    if (!body) throw new Error("Archivo vacío.");
    return Buffer.from(await body.transformToByteArray());
  }
  return readFile(path.join(ROOT, storageKey));
}
