import { getDb } from "@lib/db/client";
import { getLatestPayloads } from "@lib/stats";
import { ANILIST_LIKES, type AnilistLikes, type AnilistMedia, type FuzzyDate } from "./anilist";
import { SIMKL_LIKES, simklPosterUrl, type SimklLikes } from "./simkl";

export interface LikedMedia {
  title: string;
  year: number | null;
  kind: "movie" | "show" | "anime";
  url: string;
  poster: { src: string; src2x: string } | null;
}

interface Candidate extends Omit<LikedMedia, "poster"> {
  completedAt: number | null;
  posterUrl: string | null;
}

function fromSimkl(likes: SimklLikes): Candidate[] {
  const items = [
    ...likes.movies.map((item) => ({ item, title: item.movie, kind: "movie" as const, path: "movies" })),
    ...likes.shows.map((item) => ({ item, title: item.show, kind: "show" as const, path: "tv" })),
  ];
  return items.flatMap(({ item, title, kind, path }) =>
    title
      ? [
          {
            title: title.title,
            year: title.year,
            kind,
            url: title.ids.imdb
              ? `https://www.imdb.com/title/${title.ids.imdb}/`
              : `https://simkl.com/${path}/${title.ids.simkl}`,
            completedAt: item.last_watched_at ? Date.parse(item.last_watched_at) : null,
            posterUrl: title.poster ? simklPosterUrl(title.poster) : null,
          },
        ]
      : [],
  );
}

const fuzzyDate = ({ year, month, day }: FuzzyDate) => (year ? Date.UTC(year, (month ?? 1) - 1, day ?? 1) : null);

function fromAnilist(likes: AnilistLikes): Candidate[] {
  const byId = new Map<number, { media: AnilistMedia; completedAt: number | null }>();
  for (const media of likes.favourites) byId.set(media.id, { media, completedAt: null });
  for (const { media, completedAt } of likes.entries) {
    byId.set(media.id, { media, completedAt: fuzzyDate(completedAt) });
  }
  return [...byId.values()].map(({ media, completedAt }) => ({
    title: media.title.english ?? media.title.romaji,
    year: media.startDate.year,
    kind: "anime",
    url: media.siteUrl,
    // Without a completed date, the release date is the best guess
    completedAt: completedAt ?? fuzzyDate(media.startDate),
    posterUrl: media.coverImage.large,
  }));
}

export async function getLikedMedia(limit: number): Promise<LikedMedia[]> {
  const sql = getDb();
  if (!sql) return [];
  try {
    const payloads = await getLatestPayloads([SIMKL_LIKES, ANILIST_LIKES]);
    const simkl = payloads.get(SIMKL_LIKES) as SimklLikes | undefined;
    const anilist = payloads.get(ANILIST_LIKES) as AnilistLikes | undefined;
    const candidates = [...(simkl ? fromSimkl(simkl) : []), ...(anilist ? fromAnilist(anilist) : [])]
      .sort((a, b) => (b.completedAt ?? -Infinity) - (a.completedAt ?? -Infinity))
      .slice(0, limit);

    const urls = candidates.flatMap((candidate) => (candidate.posterUrl ? [candidate.posterUrl] : []));
    const images = await sql<{ source_url: string; sha256: string; thumbnail_sha256: string | null }[]>`
      select i.source_url, i.sha256, t.sha256 as thumbnail_sha256
      from images i
      left join images t on t.id = i.thumbnail_id
      where i.source_url = any(${urls})
    `;
    const posters = new Map(
      images.map((image) => [
        image.source_url,
        { src: `/api/images/${image.thumbnail_sha256 ?? image.sha256}`, src2x: `/api/images/${image.sha256}` },
      ]),
    );
    return candidates.map(({ completedAt: _, posterUrl, ...rest }) => ({
      ...rest,
      poster: (posterUrl && posters.get(posterUrl)) || null,
    }));
  } catch (error) {
    console.warn("[media] failed to read liked media", error);
    return [];
  }
}
