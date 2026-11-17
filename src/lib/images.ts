import { createHash } from "node:crypto";
import type { Tx } from "@lib/db/client";
import { HttpError } from "@lib/sources/source";
import sharp from "sharp";

const THUMBNAIL_SIZE = 256;

const MIME_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

async function insertImage(tx: Tx, data: Buffer, sourceUrl: string | null): Promise<{ id: string; isNew: boolean }> {
  const sha256 = createHash("sha256").update(data).digest("hex");
  const [existing] = await tx<{ id: string }[]>`select id from images where sha256 = ${sha256}`;
  if (existing) return { id: existing.id, isNew: false };

  const { format, width, height } = await sharp(data).metadata();
  const contentType = format && MIME_TYPES[format];
  if (!contentType || !width || !height) throw new Error(`Unsupported image format: ${format}`);

  const [row] = await tx<{ id: string }[]>`
    insert into images (sha256, content_type, width, height, data, source_url)
    values (${sha256}, ${contentType}, ${width}, ${height}, ${data}, ${sourceUrl})
    returning id
  `;
  return { id: row.id, isNew: true };
}

async function cropToSquare(data: Buffer): Promise<Buffer> {
  // Trimming first removes the letterbox bars YouTube adds around album art
  const trimmed = await sharp(data).trim({ threshold: 20 }).toBuffer();
  const { width = 0, height = 0 } = await sharp(trimmed).metadata();
  const size = Math.min(width, height);
  return sharp(trimmed)
    .extract({ left: Math.floor((width - size) / 2), top: Math.floor((height - size) / 2), width: size, height: size })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function saveImageFromUrl(
  tx: Tx,
  url: string,
  signal: AbortSignal,
  options: { square?: boolean } = {},
): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new HttpError(res.status, url);
  const downloaded = Buffer.from(await res.arrayBuffer());
  const data = options.square ? await cropToSquare(downloaded) : downloaded;

  const original = await insertImage(tx, data, url);
  if (original.isNew) {
    const thumbnailData = await sharp(data)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const thumbnail = await insertImage(tx, thumbnailData, null);
    await tx`update images set thumbnail_id = ${thumbnail.id} where id = ${original.id}`;
  }
  return original.id;
}
