import { ANILIST_URL, ANILIST_USERNAME } from "astro:env/server";
import type { Job } from "@lib/jobs/job";
import { saveSnapshot } from "@lib/jobs/snapshot";
import { fetchJson, HOUR } from "@lib/sources/source";
import { LIKED_SCORE, saveMissingImages } from "./common";

export const ANILIST_LIKES = "anilist-likes";

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AnilistMedia {
  id: number;
  format: string | null;
  siteUrl: string;
  title: { english: string | null; romaji: string };
  startDate: FuzzyDate;
  coverImage: { large: string };
}

export interface AnilistEntry {
  score: number;
  completedAt: FuzzyDate;
  media: AnilistMedia;
}

export interface AnilistLikes {
  favourites: AnilistMedia[];
  entries: AnilistEntry[];
}

const media = `id format siteUrl title { english romaji } startDate { year month day } coverImage { large }`;
const query = `query($name: String) {
  User(name: $name) { favourites { anime(perPage: 50) { nodes { ${media} } } } }
  MediaListCollection(userName: $name, type: ANIME) {
    lists { entries { score(format: POINT_10_DECIMAL) completedAt { year month day } media { ${media} } } }
  }
}`;

interface Response {
  data: {
    User: { favourites: { anime: { nodes: AnilistMedia[] } } };
    MediaListCollection: { lists: { entries: AnilistEntry[] }[] };
  };
}

export const anilistLikesJob: Job = {
  name: "media:anilist",
  intervalMs: HOUR,
  timeoutMs: 120_000,
  isConfigured: () => Boolean(ANILIST_USERNAME),
  run: async (tx, signal) => {
    const { data } = await fetchJson<Response>(
      ANILIST_URL,
      {
        method: "POST",
        body: JSON.stringify({ query, variables: { name: ANILIST_USERNAME } }),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      },
      signal,
    );
    // Music videos are favourited for the song, not as anime
    const isAnime = (anime: AnilistMedia) => anime.format !== "MUSIC";
    const favourites = data.User.favourites.anime.nodes.filter(isAnime);
    const favouriteIds = new Set(favourites.map((anime) => anime.id));
    // Only liked entries, so watching progress doesn't create a new snapshot every hour
    const entries = data.MediaListCollection.lists
      .flatMap((list) => list.entries)
      .filter((entry) => isAnime(entry.media) && (entry.score >= LIKED_SCORE || favouriteIds.has(entry.media.id)));

    await saveSnapshot(tx, ANILIST_LIKES, { favourites, entries } satisfies AnilistLikes);
    await saveMissingImages(
      tx,
      [...favourites, ...entries.map((entry) => entry.media)].map((anime) => anime.coverImage.large),
      signal,
    );
  },
};
