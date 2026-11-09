export const prerender = false;

import { ANILIST_URL, ANILIST_USERNAME } from "astro:env/server";
import cache from "@api/_cache";

interface AnilistData {
  animeDaysWatched: number;
}

export async function getAnilistData(): Promise<AnilistData> {
  const cacheKey = "anilistData";
  const cached = cache.get<AnilistData>(cacheKey);
  if (cached) return cached;

  const query = `query($name: String) {
            User(name: $name) {
                statistics {
                    anime {
                        minutesWatched
                    }
                }
            }
        }`;
  const variables = {
    name: ANILIST_USERNAME,
  };

  const res = await fetch(ANILIST_URL, {
    method: "POST",
    cache: "force-cache",
    body: JSON.stringify({
      query,
      variables,
    }),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return { animeDaysWatched: 0 };
  }

  const data = await res.json();
  const result = { animeDaysWatched: data.data.User.statistics.anime.minutesWatched / 1440 };
  cache.set(cacheKey, result, 12 * 60 * 60 * 1000); // 12 hours
  return result;
}

export async function GET() {
  const anilistData = await getAnilistData();

  return new Response(JSON.stringify(anilistData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
