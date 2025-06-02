interface SimklData {
  movies: {
    hoursWatched: number;
    completedCount: number;
  };
  shows: {
    hoursWatched: number;
    completedCount: number;
  };
}

export async function getSimklData(): Promise<SimklData> {
  const res = await fetch(`${import.meta.env.SIMKL_URL}users/${import.meta.env.SIMKL_USER_ID}/stats`, {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return {
      movies: { hoursWatched: 0, completedCount: 0 },
      shows: { hoursWatched: 0, completedCount: 0 },
    };
  }

  const data = await res.json();
  return {
    movies: { hoursWatched: data.movies.total_mins / 60, completedCount: data.movies.completed.count },
    shows: { hoursWatched: data.tv.total_mins / 60, completedCount: data.tv.completed.count },
  };
}

export async function GET() {
  const simklData = await getSimklData();

  return new Response(JSON.stringify(simklData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
