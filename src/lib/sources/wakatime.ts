import { WAKATIME_ACCESS_TOKEN, WAKATIME_URL, WAKATIME_USERNAME } from "astro:env/server";
import { defineSource, fetchJson, HOUR } from "./source";

interface WakatimePayload {
  data: { total_seconds: number };
}

export default defineSource({
  name: "wakatime",
  intervalMs: HOUR,
  isConfigured: () => Boolean(WAKATIME_ACCESS_TOKEN && WAKATIME_USERNAME),
  fetch: (signal) =>
    fetchJson<WakatimePayload>(
      `${WAKATIME_URL}users/@${WAKATIME_USERNAME}/all_time_since_today`,
      { headers: { Authorization: `Bearer ${WAKATIME_ACCESS_TOKEN}` } },
      signal,
    ),
  derive: (payload) => {
    if (typeof payload.data?.total_seconds !== "number") throw new Error("Unexpected WakaTime response");
    return { programmingHours: payload.data.total_seconds / 3600 };
  },
  fallback: { programmingHours: 0 },
});
