export const prerender = false;

import type { APIRoute } from "astro";
import cache from "@api/_cache";

export interface LastFMResponse {
  lovedtracks: Lovedtracks;
}

export interface Lovedtracks {
  track: Track[];
  "@attr": Attr;
}

export interface Attr {
  perPage: string;
  totalPages: string;
  page: string;
  total: string;
  user: string;
}

export interface Track {
  artist: Artist;
  date: DateClass;
  mbid: string;
  url: string;
  name: string;
  image: Image[];
  streamable: Streamable;
  albumImage?: string;
}

export interface Artist {
  url: string;
  name: string;
  mbid: string;
}

export interface DateClass {
  uts: string;
  "#text": string;
}

export interface Image {
  size: Size;
  "#text": string;
}

export enum Size {
  Extralarge = "extralarge",
  Large = "large",
  Medium = "medium",
  Small = "small",
}

export interface Streamable {
  fulltrack: string;
  "#text": string;
}

async function fetchAlbumImage(
  artist: string,
  track: string,
  apiKey: string,
  baseUrl: string,
  username: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      method: "track.getInfo",
      format: "json",
      api_key: apiKey,
      artist: artist,
      track: track,
      username: username,
    });

    const res = await fetch(`${baseUrl}?` + params, {
      method: "GET",
      cache: "force-cache",
    });

    if (!res.ok) return null;

    const data = await res.json();
    const images = data?.track?.album?.image || [];
    const mediumImage = images.find((img: { size: string; "#text": string }) => img.size === "medium")?.["#text"];

    return mediumImage || null;
  } catch {
    return null;
  }
}

async function getLovedTracks(): Promise<LastFMResponse> {
  const cacheKey = "lastfmTracksWithImages";
  const cached = cache.get<LastFMResponse>(cacheKey);
  if (cached) return cached;

  const emptyResponse = {
    lovedtracks: {
      track: [],
      "@attr": { perPage: "0", totalPages: "0", page: "0", total: "0", user: "" },
    },
  };

  try {
    const apiKey = import.meta.env.LASTFM_API_KEY;
    const baseUrl = import.meta.env.LASTFM_URL;
    if (!apiKey) {
      console.warn("LastFM API key not configured");
      return emptyResponse;
    }

    const params = new URLSearchParams({
      method: "user.getlovedtracks",
      format: "json",
      api_key: apiKey,
      user: import.meta.env.LASTFM_USERNAME,
      limit: "1000",
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${baseUrl}?` + params, {
      method: "GET",
      cache: "force-cache",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn("Failed to fetch loved tracks", res.status, res.statusText);
      return emptyResponse;
    }

    const data: LastFMResponse = await res.json();

    // Fetch album images for the first 100 tracks in parallel
    const username = import.meta.env.LASTFM_USERNAME;
    const tracksToEnhance = data.lovedtracks.track.slice(0, 100);
    const imagePromises = tracksToEnhance.map((track) =>
      fetchAlbumImage(track.artist.name, track.name, apiKey, baseUrl, username),
    );

    const albumImages = await Promise.all(imagePromises);

    // Add album images to tracks
    tracksToEnhance.forEach((track, index) => {
      if (albumImages[index]) {
        track.albumImage = albumImages[index] as string;
      }
    });

    cache.set(cacheKey, data, 10 * 60 * 1000);
    return data;
  } catch (error) {
    console.warn("LastFM API error:", error);
    return emptyResponse;
  }
}

export const GET: APIRoute = async () => {
  try {
    const data = await getLovedTracks();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch loved tracks" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
