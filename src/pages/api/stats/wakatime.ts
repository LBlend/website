export async function getWakatimeData() {
  const res = await fetch(
    `${import.meta.env.WAKATIME_URL}users/@${import.meta.env.WAKATIME_USERNAME}/all_time_since_today`,
    {
      method: "GET",
      cache: "force-cache",
      headers: {
        Authorization: `Basic  ${btoa(import.meta.env.WAKATIME_API_KEY ?? "")}`,
      },
    },
  );

  if (!res.ok) {
    return JSON.stringify({ programmingHours: null });
  }

  const data = await res.json();
  return { programmingHours: data.data.total_seconds / 3600 };
}
