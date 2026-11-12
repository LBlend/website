export const prerender = false;

import { getDb } from "@lib/db/client";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, request }) => {
  const sql = getDb();
  if (!sql || !params.hash || !/^[a-f0-9]{64}$/.test(params.hash)) {
    return new Response("Not found", { status: 404 });
  }

  const etag = `"${params.hash}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const [image] = await sql<{ content_type: string; data: Buffer }[]>`
    select content_type, data from images where sha256 = ${params.hash}
  `;
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.content_type,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
    },
  });
};
