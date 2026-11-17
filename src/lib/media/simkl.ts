import { SIMKL_ACCESS_TOKEN, SIMKL_CLIENT_ID, SIMKL_URL } from "astro:env/server";
import type { Job } from "@lib/jobs/job";
import { getLatestSnapshot, saveSnapshot } from "@lib/jobs/snapshot";
import { fetchJson, HOUR } from "@lib/sources/source";
import { LIKED_SCORE, saveMissingImages } from "./common";

export const SIMKL_LIKES = "simkl-likes";

interface SimklTitle {
  title: string;
  year: number | null;
  poster: string | null;
  ids: { simkl: number; imdb?: string };
}

export interface SimklItem {
  status: string;
  last_watched_at: string | null;
  user_rating: number | null;
  movie?: SimklTitle;
  show?: SimklTitle;
}

export interface SimklLikes {
  // Only refetched when this changes, as Simkl's API rules require
  activitiesAll: string;
  movies: SimklItem[];
  shows: SimklItem[];
}

export const simklPosterUrl = (poster: string) => `https://simkl.in/posters/${poster}_m.webp`;

function simklFetch<T>(path: string, signal: AbortSignal) {
  const url = new URL(path, SIMKL_URL);
  url.searchParams.set("client_id", SIMKL_CLIENT_ID ?? "");
  url.searchParams.set("app-name", "furumo-website");
  url.searchParams.set("app-version", "1.0");
  return fetchJson<T>(
    url.toString(),
    {
      headers: {
        Authorization: `Bearer ${SIMKL_ACCESS_TOKEN}`,
        "simkl-api-key": SIMKL_CLIENT_ID ?? "",
        "User-Agent": "furumo-website/1.0",
      },
    },
    signal,
  );
}

const isLiked = (item: SimklItem) => (item.user_rating ?? 0) >= LIKED_SCORE;

export const simklLikesJob: Job = {
  name: "media:simkl",
  intervalMs: HOUR,
  timeoutMs: 120_000,
  isConfigured: () => Boolean(SIMKL_CLIENT_ID && SIMKL_ACCESS_TOKEN),
  run: async (tx, signal) => {
    const activities = await simklFetch<{ all: string }>("sync/activities", signal);
    let likes = await getLatestSnapshot<SimklLikes>(tx, SIMKL_LIKES);

    if (likes?.activitiesAll !== activities.all) {
      const [movies, shows] = await Promise.all([
        simklFetch<{ movies?: SimklItem[] } | null>("sync/all-items/movies", signal),
        simklFetch<{ shows?: SimklItem[] } | null>("sync/all-items/shows", signal),
      ]);
      likes = {
        activitiesAll: activities.all,
        movies: (movies?.movies ?? []).filter(isLiked),
        shows: (shows?.shows ?? []).filter(isLiked),
      };
      await saveSnapshot(tx, SIMKL_LIKES, likes);
    }

    const posters = [...likes.movies, ...likes.shows].flatMap((item) => {
      const poster = (item.movie ?? item.show)?.poster;
      return poster ? [simklPosterUrl(poster)] : [];
    });
    await saveMissingImages(tx, posters, signal);
  },
};
