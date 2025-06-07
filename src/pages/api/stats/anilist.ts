export const prerender = false;

interface AnilistData {
  animeDaysWatched: number;
}

export async function getAnilistData(): Promise<AnilistData> {
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
    name: import.meta.env.ANILIST_USERNAME,
  };

  const res = await fetch(import.meta.env.ANILIST_URL || "https://graphql.anilist.co", {
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
  return { animeDaysWatched: data.data.User.statistics.anime.minutesWatched / 1440 };
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
