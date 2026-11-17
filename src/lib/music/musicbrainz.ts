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
      if (!(error instanceof HttpError && error.status === 503) || attempt === 5) throw error;
      await sleep(3000 * attempt);
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

const phrase = (value: string) => `"${value.replaceAll("\\", "").replaceAll('"', '\\"')}"`;

export async function searchRecordingIsrcs(title: string, artist: string, signal: AbortSignal): Promise<string[]> {
  const search = async (artistQuery: string) => {
    const params = new URLSearchParams({
      query: `recording:${phrase(title)} AND ${artistQuery}`,
      fmt: "json",
      limit: "5",
    });
    const data = await get<{ recordings?: { score: number; isrcs?: string[] }[] }>(`/recording?${params}`, signal);
    // Lower scores are other versions, e.g. "レオ -オーケストラアレンジver.-"
    return [...new Set((data.recordings ?? []).filter((r) => r.score >= 98).flatMap((r) => r.isrcs ?? []))];
  };
  const byName = await search(`artist:${phrase(artist)}`);
  if (byName.length > 0) return byName;

  // The credit can be in another script than the hint, e.g. "Yuuri" is credited as 優里; artist search also matches aliases
  const params = new URLSearchParams({ query: phrase(artist), fmt: "json", limit: "3" });
  const data = await get<{ artists?: { id: string; score: number }[] }>(`/artist?${params}`, signal);
  const ids = (data.artists ?? []).filter((a) => a.score >= 85).map((a) => `arid:${a.id}`);
  return ids.length > 0 ? search(`(${ids.join(" OR ")})`) : [];
}

export async function searchArtistNames(name: string, signal: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams({ query: `artist:${phrase(name)}`, fmt: "json", limit: "3" });
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
