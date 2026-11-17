import {
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  YOUTUBE_PLAYLIST_IDS,
  YOUTUBE_REFRESH_TOKEN,
} from "astro:env/server";
import type { Job } from "@lib/jobs/job";
import { fetchJson, HOUR } from "@lib/sources/source";
import type { TrackHint } from "./matching";

const API = "https://www.googleapis.com/youtube/v3";

export interface YoutubePlaylistItem {
  id: string;
  snippet: {
    publishedAt: string;
    title: string;
    videoOwnerChannelTitle?: string;
    videoOwnerChannelId?: string;
    resourceId: { videoId: string };
  };
}

type Thumbnails = Partial<Record<"default" | "medium" | "high" | "standard" | "maxres", { url: string }>>;

export interface YoutubeVideo {
  id: string;
  snippet: { title: string; description: string; channelTitle: string; channelId: string; thumbnails?: Thumbnails };
  contentDetails: { duration: string };
}

export interface YoutubeRaw {
  item: YoutubePlaylistItem;
  video: YoutubeVideo | null;
}

const playlistIds = () =>
  (YOUTUBE_PLAYLIST_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

let accessToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(signal: AbortSignal): Promise<string> {
  if (accessToken && Date.now() < accessToken.expiresAt) return accessToken.value;
  const data = await fetchJson<{ access_token: string; expires_in: number }>(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: YOUTUBE_CLIENT_ID ?? "",
        client_secret: YOUTUBE_CLIENT_SECRET ?? "",
        refresh_token: YOUTUBE_REFRESH_TOKEN ?? "",
        grant_type: "refresh_token",
      }),
    },
    signal,
  );
  accessToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 - 60_000 };
  return accessToken.value;
}

async function api<T>(path: string, params: Record<string, string>, signal: AbortSignal): Promise<T> {
  const headers = { Authorization: `Bearer ${await getAccessToken(signal)}` };
  return fetchJson<T>(`${API}/${path}?${new URLSearchParams(params)}`, { headers }, signal);
}

async function getAllPages<T>(path: string, params: Record<string, string>, signal: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const page = await api<{ items: T[]; nextPageToken?: string }>(
      path,
      { ...params, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
      signal,
    );
    items.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

async function getVideos(ids: string[], signal: AbortSignal): Promise<Map<string, YoutubeVideo>> {
  const videos = new Map<string, YoutubeVideo>();
  for (let i = 0; i < ids.length; i += 50) {
    const page = await api<{ items: YoutubeVideo[] }>(
      "videos",
      { part: "snippet,contentDetails", id: ids.slice(i, i + 50).join(",") },
      signal,
    );
    for (const video of page.items) videos.set(video.id, video);
  }
  return videos;
}

export const youtubeSyncJob: Job = {
  name: "music:youtube",
  intervalMs: HOUR,
  timeoutMs: 120_000,
  isConfigured: () =>
    Boolean(YOUTUBE_CLIENT_ID && YOUTUBE_CLIENT_SECRET && YOUTUBE_REFRESH_TOKEN && playlistIds().length > 0),
  run: async (tx, signal) => {
    for (const playlistId of playlistIds()) {
      const items = await getAllPages<YoutubePlaylistItem>("playlistItems", { part: "snippet", playlistId }, signal);
      const itemIds = items.map((item) => item.id);

      const known = new Set(
        (
          await tx<{ item_id: string }[]>`
            select item_id from music.playlist_entries
            where source = 'youtube' and playlist_id = ${playlistId}
          `
        ).map((row) => row.item_id),
      );
      const newItems = items.filter((item) => !known.has(item.id));
      const videos = await getVideos(
        newItems.map((item) => item.snippet.resourceId.videoId),
        signal,
      );

      for (const item of newItems) {
        const videoId = item.snippet.resourceId.videoId;
        const raw: YoutubeRaw = { item, video: videos.get(videoId) ?? null };
        await tx`
          insert into music.playlist_entries (source, playlist_id, item_id, media_id, added_at, raw)
          values ('youtube', ${playlistId}, ${item.id}, ${videoId}, ${item.snippet.publishedAt}, ${tx.json(raw as never)})
        `;
      }

      await tx`
        update music.playlist_entries set removed_at = null
        where source = 'youtube' and playlist_id = ${playlistId} and removed_at is not null and item_id = any(${itemIds})
      `;
      await tx`
        update music.playlist_entries set removed_at = now()
        where source = 'youtube' and playlist_id = ${playlistId} and removed_at is null and item_id <> all(${itemIds})
      `;
    }

    const liked = await getAllPages<{ id: string }>("videos", { part: "id", myRating: "like" }, signal);
    const likedIds = liked.map((video) => video.id);
    await tx`delete from music.youtube_likes where video_id <> all(${likedIds})`;
    await tx`
      insert into music.youtube_likes (video_id) select unnest(${likedIds}::text[])
      on conflict (video_id) do nothing
    `;
  },
};

const NOISE =
  /\s*[([](?:official\s*)?(?:music\s*)?(?:video|audio|lyrics?|lyric video|visuali[sz]er|mv|m\/v|hd|4k)[)\]]/gi;

function parseIsoDuration(duration: string): number | undefined {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return undefined;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// Auto-generated YouTube Music uploads carry label metadata in the description:
// "Provided to YouTube by <label>\n\n<title> · <artist> · <artist>\n\n<album>\n\n℗ ..."
function parseProvidedDescription(description: string) {
  const lines = description.split("\n").map((line) => line.trim());
  const start = lines.findIndex((line) => line.startsWith("Provided to YouTube by"));
  if (start === -1) return null;
  const rest = lines.slice(start + 1).filter(Boolean);
  const [title, ...artists] = (rest[0] ?? "").split(" · ").map((part) => part.trim());
  if (!title || artists.length === 0) return null;
  const album = rest[1] && !rest[1].startsWith("℗") && !rest[1].startsWith("Released on:") ? rest[1] : undefined;
  const releaseDate = /^Released on: (\d{4}-\d{2}-\d{2})$/m.exec(description)?.[1];
  return { title, artists, album, releaseDate };
}

export function youtubeHint(raw: YoutubeRaw): TrackHint | null {
  const { video } = raw;
  if (!video) return null;
  const { thumbnails = {} } = video.snippet;
  const base = {
    durationSec: parseIsoDuration(video.contentDetails.duration),
    coverUrls: [thumbnails.maxres, thumbnails.standard, thumbnails.high, thumbnails.medium].flatMap((t) =>
      t ? [t.url] : [],
    ),
  };

  const provided = parseProvidedDescription(video.snippet.description);
  if (provided) return { ...base, ...provided, strictDuration: true };

  const channel = video.snippet.channelTitle;
  if (channel.endsWith(" - Topic")) {
    return {
      ...base,
      title: video.snippet.title,
      artists: [channel.slice(0, -" - Topic".length)],
      strictDuration: true,
    };
  }

  const title = video.snippet.title.replace(NOISE, "").trim();
  const dash = title.indexOf(" - ");
  if (dash !== -1) {
    return { ...base, title: title.slice(dash + 3), artists: [title.slice(0, dash)], strictDuration: false };
  }
  return { ...base, title, artists: [channel.replace(/VEVO$|\s*Official$/i, "").trim()], strictDuration: false };
}
