import { MUSICBRAINZ_CONTACT } from "astro:env/server";
import { fetchJson, HttpError } from "@lib/sources/source";

const API = "https://musicbrainz.org/ws/2";
const MIN_INTERVAL_MS = 1100;

export interface MusicBrainzArtistCredit {
  name: string;
  joinphrase: string;
  artist: { id: string; name: string };
}

export interface MusicBrainzRecording {
  id: string;
  title: string;
  "first-release-date"?: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
}

export interface MusicBrainzAlias {
  name: string;
  locale: string | null;
  primary: boolean | null;
  type: string | null;
}

let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const userAgent = MUSICBRAINZ_CONTACT ? `personal-website/1.0 ( ${MUSICBRAINZ_CONTACT} )` : "personal-website/1.0";
  for (let attempt = 1; ; attempt++) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      return await fetchJson<T>(
        `${API}${path}`,
        { headers: { Accept: "application/json", "User-Agent": userAgent } },
        signal,
      );
    } catch (error) {
      // MusicBrainz answers 503 when throttling, including when its servers are busy for everyone
      if (!(error instanceof HttpError && error.status === 503) || attempt === 4) throw error;
      await sleep(2000 * attempt);
    }
  }
}

export async function getRecordingsByIsrc(isrc: string, signal: AbortSignal): Promise<MusicBrainzRecording[]> {
  try {
    const data = await get<{ recordings: MusicBrainzRecording[] }>(
      `/isrc/${encodeURIComponent(isrc)}?fmt=json&inc=artist-credits`,
      signal,
    );
    return data.recordings ?? [];
  } catch (error) {
    // 400 means MusicBrainz considers the ISRC malformed, which some Deezer tracks have
    if (error instanceof HttpError && (error.status === 400 || error.status === 404)) return [];
    throw error;
  }
}

export async function searchArtistNames(name: string, signal: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams({ query: `artist:"${name}"`, fmt: "json", limit: "3" });
  const data = await get<{ artists?: { score: number; name: string; aliases?: MusicBrainzAlias[] }[] }>(
    `/artist?${params}`,
    signal,
  );
  return (data.artists ?? [])
    .filter((artist) => artist.score >= 95)
    .flatMap((artist) => [artist.name, ...(artist.aliases ?? []).map((alias) => alias.name)]);
}

export async function getArtistAliases(mbid: string, signal: AbortSignal): Promise<MusicBrainzAlias[]> {
  const data = await get<{ aliases?: MusicBrainzAlias[] }>(`/artist/${mbid}?fmt=json&inc=aliases`, signal);
  return data.aliases ?? [];
}
