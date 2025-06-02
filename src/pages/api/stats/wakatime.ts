interface WakatimeData {
  programmingHours: number; // in hours
}

export async function getWakatimeData(): Promise<WakatimeData> {
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
    return { programmingHours: 0 };
  }

  const data = await res.json();
  return { programmingHours: data.data.total_seconds / 3600 };
}

export async function GET() {
  const wakatimeData = await getWakatimeData();

  return new Response(JSON.stringify(wakatimeData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
