import { fetchJson } from "@lib/sources/source";

const API = "https://api.deezer.com";

export interface DeezerArtist {
  id: number;
  name: string;
  role?: string;
}

export interface DeezerSearchTrack {
  id: number;
  title: string;
  duration: number;
  artist: DeezerArtist;
  album: { id: number; title: string };
}

export interface DeezerTrack extends DeezerSearchTrack {
  isrc?: string;
  contributors?: DeezerArtist[];
}

export interface DeezerAlbum {
  id: number;
  title: string;
  release_date?: string;
  cover_xl?: string;
  artist: DeezerArtist;
  contributors?: DeezerArtist[];
}

type DeezerError = { error: { type: string; message: string; code: number } };

// Deezer answers errors with HTTP 200 and an `error` object
async function get<T>(path: string, signal: AbortSignal): Promise<T | null> {
  const data = await fetchJson<T | DeezerError>(`${API}${path}`, {}, signal);
  if (data && typeof data === "object" && "error" in data) {
    if (data.error.code === 800) return null;
    throw new Error(`Deezer error ${data.error.code}: ${data.error.message}`);
  }
  return data as T;
}

export const getTrack = (id: number, signal: AbortSignal) => get<DeezerTrack>(`/track/${id}`, signal);

export const getTrackByIsrc = (isrc: string, signal: AbortSignal) =>
  get<DeezerTrack>(`/track/isrc:${encodeURIComponent(isrc)}`, signal);

export const getAlbum = (id: number, signal: AbortSignal) => get<DeezerAlbum>(`/album/${id}`, signal);

export async function searchTracks(query: string, signal: AbortSignal): Promise<DeezerSearchTrack[]> {
  const result = await get<{ data: DeezerSearchTrack[] }>(
    `/search?` + new URLSearchParams({ q: query, limit: "15" }),
    signal,
  );
  return result?.data ?? [];
}
