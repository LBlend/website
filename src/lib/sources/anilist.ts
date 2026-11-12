import { ANILIST_URL, ANILIST_USERNAME } from "astro:env/server";
import { defineSource, fetchJson, HOUR } from "./source";

interface AnilistPayload {
  data: { User: { statistics: { anime: { minutesWatched: number } } } };
}

const query = `query($name: String) {
  User(name: $name) {
    statistics {
      anime {
        minutesWatched
      }
    }
  }
}`;

export default defineSource({
  name: "anilist",
  intervalMs: HOUR,
  isConfigured: () => Boolean(ANILIST_USERNAME),
  fetch: (signal) =>
    fetchJson<AnilistPayload>(
      ANILIST_URL,
      {
        method: "POST",
        body: JSON.stringify({ query, variables: { name: ANILIST_USERNAME } }),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      },
      signal,
    ),
  derive: (payload) => ({ animeDaysWatched: payload.data.User.statistics.anime.minutesWatched / 1440 }),
  fallback: { animeDaysWatched: 0 },
});
