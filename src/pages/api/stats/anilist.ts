export async function getAnilistData() {
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
    return { animeDaysWatched: null };
  }

  const data = await res.json();
  return { animeDaysWatched: data.data.User.statistics.anime.minutesWatched / 1440 };
}
