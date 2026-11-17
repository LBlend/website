import type { Tx } from "@lib/db/client";
import { saveImageFromUrl } from "@lib/images";

// Simkl ratings and AniList scores, out of 10
export const LIKED_SCORE = 8;

export async function saveMissingImages(tx: Tx, urls: string[], signal: AbortSignal) {
  const saved = new Set(
    (await tx<{ source_url: string }[]>`select source_url from images where source_url = any(${urls})`).map(
      (row) => row.source_url,
    ),
  );
  for (const url of urls) {
    if (saved.has(url)) continue;
    try {
      await tx.savepoint((sp) => saveImageFromUrl(sp, url, signal));
    } catch (error) {
      // One broken poster shouldn't stop the rest
      console.warn(`[media] failed to save poster ${url}`, error);
    }
  }
}
