import { getDb } from "@lib/db/client";

export interface LikedSong {
  title: string;
  titleRomanized: string | null;
  artist: string;
  artistRomanized: string | null;
  likedAt: Date;
  coverUrl: string | null;
}

export async function getRecentlyLikedSongs(limit: number): Promise<LikedSong[]> {
  const sql = getDb();
  if (!sql) return [];
  try {
    const rows = await sql<
      {
        title: string;
        title_romanized: string | null;
        artist_credit: string | null;
        artist_credit_romanized: string | null;
        liked_at: Date;
        thumbnail_sha256: string | null;
      }[]
    >`
      select d.title, d.title_romanized, d.artist_credit, d.artist_credit_romanized, d.liked_at,
             coalesce(thumbnail.sha256, cover.sha256) as thumbnail_sha256
      from music.display_tracks d
      left join images cover on cover.id = d.cover_image_id
      left join images thumbnail on thumbnail.id = cover.thumbnail_id
      where d.liked
      order by d.liked_at desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      title: row.title,
      titleRomanized: row.title_romanized,
      artist: row.artist_credit ?? "",
      artistRomanized: row.artist_credit_romanized,
      likedAt: row.liked_at,
      coverUrl: row.thumbnail_sha256 ? `/api/images/${row.thumbnail_sha256}` : null,
    }));
  } catch (error) {
    console.warn("[music] failed to read liked songs", error);
    return [];
  }
}
