import type { Tx } from "@lib/db/client";
import { saveImageFromUrl } from "@lib/images";
import * as deezer from "./deezer";
import * as musicbrainz from "./musicbrainz";

export interface TrackHint {
  title: string;
  artists: string[];
  album?: string;
  durationSec?: number;
  strictDuration?: boolean;
  isrc?: string;
  releaseDate?: string;
  coverUrl?: string;
}

export class NoMatchError extends Error {}

const FEATURING = /\s*(?:[([](?:feat\.?|ft\.?|featuring|with)\s+([^)\]]*)[)\]]|\s(?:feat\.|ft\.|featuring)\s+(.*)$)/gi;

const withoutFeaturing = (title: string) => title.replace(FEATURING, "").trim();

function titleForCredits(title: string, credits: { name: string }[]) {
  const credited = normalize(credits.map((credit) => credit.name).join(" "));
  const featured = [...title.matchAll(FEATURING)].flatMap((match) => (match[1] ?? match[2] ?? "").split(/,|&| and /));
  const allCredited = featured.every((name) => !normalize(name) || credited.includes(normalize(name)));
  return featured.length > 0 && allCredited ? withoutFeaturing(title) : title;
}

export function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(FEATURING, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const isLatin = (value: string) => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}]+$/u.test(value);

function bigrams(value: string) {
  return Array.from({ length: Math.max(value.length - 1, 0) }, (_, i) => value.slice(i, i + 2));
}

function similarity(a: string, b: string) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.length === 0 || right.length === 0) return a === b ? 1 : 0;
  const remaining = [...right];
  let shared = 0;
  for (const pair of left) {
    const index = remaining.indexOf(pair);
    if (index !== -1) {
      shared++;
      remaining.splice(index, 1);
    }
  }
  return (2 * shared) / (left.length + right.length);
}

function artistMatches(hint: TrackHint, candidate: deezer.DeezerSearchTrack) {
  const name = normalize(candidate.artist.name).replaceAll(" ", "");
  return hint.artists.some((artist) => {
    const normalized = normalize(artist).replaceAll(" ", "");
    return (
      normalized === name ||
      normalized.includes(name) ||
      name.includes(normalized) ||
      similarity(normalized, name) >= 0.8
    );
  });
}

function pickCandidate(hint: TrackHint, candidates: deezer.DeezerSearchTrack[]) {
  const title = normalize(hint.title);
  const maxDiff = hint.strictDuration ? 7 : 15;
  const matching = candidates.filter(
    (candidate) =>
      normalize(candidate.title) === title &&
      artistMatches(hint, candidate) &&
      (hint.durationSec === undefined || Math.abs(candidate.duration - hint.durationSec) <= maxDiff),
  );
  const album = hint.album && normalize(hint.album);
  return matching.find((candidate) => album && normalize(candidate.album.title) === album) ?? matching[0];
}

async function findDeezerTrack(hint: TrackHint, signal: AbortSignal): Promise<deezer.DeezerTrack> {
  if (hint.isrc) {
    const track = await deezer.getTrackByIsrc(hint.isrc, signal);
    if (track) return track;
  }
  const title = withoutFeaturing(hint.title);
  const album = hint.album && normalize(hint.album) !== normalize(hint.title) ? hint.album : undefined;
  const search = async (artistHint: TrackHint, artist: string | null) => {
    const queries = artist ? [album && `${artist} ${title} ${album}`, `${artist} ${title}`] : [title];
    for (const query of queries.filter((query): query is string => Boolean(query))) {
      const candidate = pickCandidate(artistHint, await deezer.searchTracks(query, signal));
      if (candidate) return deezer.getTrack(candidate.id, signal);
    }
    return null;
  };

  const track = (await search(hint, hint.artists[0])) ?? (await search(hint, null));
  if (track) return track;

  // YouTube often credits artists in their native script while Deezer uses a Latin name
  const nonLatin = hint.artists.filter((artist) => !isLatin(artist));
  if (nonLatin.length > 0) {
    const aliases: string[] = [];
    for (const artist of nonLatin) aliases.push(...(await musicbrainz.searchArtistNames(artist, signal)));
    const expanded = { ...hint, artists: [...hint.artists, ...aliases] };
    for (const alias of new Set(aliases.filter(isLatin))) {
      const aliasTrack = await search(expanded, alias);
      if (aliasTrack) return aliasTrack;
    }
  }
  throw new NoMatchError(`No confident Deezer match for "${hint.artists.join(", ")} - ${hint.title}"`);
}

async function savePayload(tx: Tx, provider: string, externalId: string, payload: unknown) {
  await tx`
    insert into music.provider_payloads (provider, external_id, payload)
    values (${provider}, ${externalId}, ${tx.json(payload as never)})
    on conflict (provider, external_id) do update set payload = excluded.payload, fetched_at = now()
  `;
}

interface Credit {
  name: string;
  joinPhrase: string;
  deezerId?: number;
  mbid?: string;
  mbName?: string;
}

function deezerCredits(artists: deezer.DeezerArtist[]): Credit[] {
  const main = artists.filter((artist) => artist.role !== "Featured");
  const featured = artists.filter((artist) => artist.role === "Featured");
  return [...main, ...featured].map((artist, i, all): Credit => {
    const next = all[i + 1];
    let joinPhrase = "";
    if (next) {
      if (next.role === "Featured" && artist.role !== "Featured") joinPhrase = " feat. ";
      else if (next === main[main.length - 1] || next === featured[featured.length - 1]) joinPhrase = " & ";
      else joinPhrase = ", ";
    }
    return { name: artist.name, joinPhrase, deezerId: artist.id };
  });
}

function trackCredits(track: deezer.DeezerTrack, recording?: musicbrainz.MusicBrainzRecording): Credit[] {
  const contributors = track.contributors?.length ? track.contributors : [track.artist];
  const mbCredits = recording?.["artist-credit"];
  if (!mbCredits?.length) return deezerCredits(contributors);
  // Names can be in different scripts across the two services, so fall back to matching by position
  const samePositions = mbCredits.length === contributors.length;
  return mbCredits.map((credit, i) => ({
    name: credit.name,
    joinPhrase: credit.joinphrase,
    mbid: credit.artist.id,
    mbName: credit.artist.name,
    deezerId:
      contributors.find((artist) => normalize(artist.name) === normalize(credit.name))?.id ??
      (samePositions ? contributors[i].id : undefined),
  }));
}

async function romanizedName(name: string, mbid: string | undefined, signal: AbortSignal) {
  if (!mbid || isLatin(name)) return null;
  const aliases = (await musicbrainz.getArtistAliases(mbid, signal)).filter((alias) => isLatin(alias.name));
  const preferred =
    aliases.find((alias) => alias.primary && alias.locale?.startsWith("en")) ??
    aliases.find((alias) => alias.primary) ??
    aliases.find((alias) => alias.type === "Artist name") ??
    aliases[0];
  return preferred?.name ?? null;
}

async function upsertArtist(tx: Tx, credit: Credit, signal: AbortSignal): Promise<string> {
  const [existing] = await tx<{ id: string; name_romanized: string | null; musicbrainz_id: string | null }[]>`
    select id, name_romanized, musicbrainz_id from music.artists
    where (${credit.mbid ?? null}::uuid is not null and musicbrainz_id = ${credit.mbid ?? null}::uuid)
       or (${credit.deezerId ?? null}::bigint is not null and deezer_id = ${credit.deezerId ?? null}::bigint)
    limit 1
  `;
  const gainsMbid = Boolean(credit.mbid) && (!existing || !existing.musicbrainz_id);
  const name = (gainsMbid && credit.mbName) || credit.name;
  const romanized = gainsMbid ? await romanizedName(name, credit.mbid, signal) : null;

  if (existing) {
    if (gainsMbid) {
      await tx`
        update music.artists set
          name = ${name},
          name_romanized = coalesce(${romanized}, name_romanized),
          musicbrainz_id = ${credit.mbid ?? null}::uuid,
          deezer_id = coalesce(deezer_id, ${credit.deezerId ?? null}::bigint)
        where id = ${existing.id}
      `;
    }
    return existing.id;
  }
  const [row] = await tx<{ id: string }[]>`
    insert into music.artists (name, name_romanized, musicbrainz_id, deezer_id)
    values (${name}, ${romanized}, ${credit.mbid ?? null}::uuid, ${credit.deezerId ?? null}::bigint)
    returning id
  `;
  return row.id;
}

async function upsertAlbum(tx: Tx, album: deezer.DeezerAlbum, signal: AbortSignal): Promise<string> {
  const [existing] = await tx<{ id: string; cover_image_id: string | null }[]>`
    select id, cover_image_id from music.albums where deezer_id = ${album.id}
  `;
  const coverImageId =
    existing?.cover_image_id ?? (album.cover_xl ? await saveImageFromUrl(tx, album.cover_xl, signal) : null);

  const [row] = await tx<{ id: string }[]>`
    insert into music.albums (title, release_date, cover_image_id, deezer_id)
    values (${album.title}, ${album.release_date || null}::date, ${coverImageId}, ${album.id})
    on conflict (deezer_id) do update set
      title = excluded.title,
      release_date = excluded.release_date,
      cover_image_id = coalesce(music.albums.cover_image_id, excluded.cover_image_id)
    returning id
  `;

  if (!existing) {
    const contributors = album.contributors?.length ? album.contributors : [album.artist];
    const credits = deezerCredits(contributors);
    for (const [position, credit] of credits.entries()) {
      const artistId = await upsertArtist(tx, credit, signal);
      await tx`
        insert into music.album_artists (album_id, artist_id, position, join_phrase)
        values (${row.id}, ${artistId}, ${position}, ${credit.joinPhrase})
      `;
    }
  }
  return row.id;
}

export async function resolveTrack(
  tx: Tx,
  hint: TrackHint,
  ids: { youtubeVideoId?: string; spotifyId?: string },
  signal: AbortSignal,
): Promise<string> {
  const track = await findDeezerTrack(hint, signal);
  await savePayload(tx, "deezer.track", String(track.id), track);

  const album = await deezer.getAlbum(track.album.id, signal);
  if (!album) throw new NoMatchError(`Deezer album ${track.album.id} not found`);
  await savePayload(tx, "deezer.album", String(album.id), album);

  const recordings = track.isrc ? await musicbrainz.getRecordingsByIsrc(track.isrc, signal) : [];
  if (track.isrc) await savePayload(tx, "musicbrainz.isrc", track.isrc, recordings);
  // One ISRC can belong to several recordings (re-releases); the earliest is the original
  const recording = recordings.toSorted((a, b) =>
    (a["first-release-date"] || "9999").localeCompare(b["first-release-date"] || "9999"),
  )[0];
  const recordingIds = recordings.map((r) => r.id);

  const [existing] = await tx<{ id: string; release_date: string | null }[]>`
    select t.id, al.release_date::text from music.tracks t
    left join music.albums al on al.id = t.album_id
    where t.isrc = ${track.isrc ?? null}::text
       or t.deezer_id = ${track.id}
       or t.musicbrainz_recording_id = any(${recordingIds}::uuid[])
    order by t.isrc = ${track.isrc ?? null}::text desc nulls last, t.deezer_id = ${track.id} desc nulls last
    limit 1
  `;

  // The same song can match several releases; keep the earliest, which is usually the original
  const isEarlierRelease =
    existing && album.release_date && (!existing.release_date || album.release_date < existing.release_date);

  if (existing && !isEarlierRelease) {
    await tx`
      update music.tracks set
        musicbrainz_recording_id = coalesce(musicbrainz_recording_id, ${recording?.id ?? null}::uuid),
        youtube_video_id = coalesce(youtube_video_id, ${ids.youtubeVideoId ?? null}),
        spotify_id = coalesce(spotify_id, ${ids.spotifyId ?? null})
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const albumId = await upsertAlbum(tx, album, signal);
  const credits = trackCredits(track, recording);
  const title = titleForCredits(track.title, credits);

  if (existing) {
    await tx`
      update music.tracks set
        title = ${title},
        isrc = ${track.isrc ?? null},
        duration_ms = ${track.duration * 1000},
        album_id = ${albumId},
        musicbrainz_recording_id = coalesce(${recording?.id ?? null}::uuid, musicbrainz_recording_id),
        deezer_id = ${track.id},
        youtube_video_id = coalesce(${ids.youtubeVideoId ?? null}, youtube_video_id),
        spotify_id = coalesce(spotify_id, ${ids.spotifyId ?? null})
      where id = ${existing.id}
    `;
    await tx`delete from music.track_artists where track_id = ${existing.id}`;
  }

  const trackId =
    existing?.id ??
    (
      await tx<{ id: string }[]>`
        insert into music.tracks (title, isrc, duration_ms, album_id, musicbrainz_recording_id, deezer_id, spotify_id, youtube_video_id)
        values (
          ${title}, ${track.isrc ?? null}, ${track.duration * 1000}, ${albumId}, ${recording?.id ?? null}::uuid,
          ${track.id}, ${ids.spotifyId ?? null}, ${ids.youtubeVideoId ?? null}
        )
        returning id
      `
    )[0].id;

  for (const [position, credit] of credits.entries()) {
    const artistId = await upsertArtist(tx, credit, signal);
    await tx`
      insert into music.track_artists (track_id, artist_id, position, join_phrase)
      values (${trackId}, ${artistId}, ${position}, ${credit.joinPhrase})
    `;
  }
  return trackId;
}

async function findOrCreateArtistByName(tx: Tx, name: string, youtubeChannelId?: string): Promise<string> {
  const [existing] = await tx<{ id: string }[]>`
    select id from music.artists where lower(name) = lower(${name}) or lower(name_romanized) = lower(${name})
    order by deezer_id is not null desc
    limit 1
  `;
  if (existing) return existing.id;
  const [row] = await tx<{ id: string }[]>`
    insert into music.artists (name, youtube_channel_id)
    values (
      ${name},
      (select ${youtubeChannelId ?? null}::text where not exists (
        select 1 from music.artists where youtube_channel_id = ${youtubeChannelId ?? null}::text
      ))
    )
    returning id
  `;
  return row.id;
}

export async function createYoutubeTrack(
  tx: Tx,
  hint: TrackHint,
  ids: { youtubeVideoId: string; youtubeChannelId?: string },
  signal: AbortSignal,
): Promise<string> {
  const [existing] = await tx<{ id: string }[]>`
    select id from music.tracks where youtube_video_id = ${ids.youtubeVideoId} limit 1
  `;
  if (existing) return existing.id;

  const artistIds: string[] = [];
  for (const [i, name] of hint.artists.entries()) {
    artistIds.push(await findOrCreateArtistByName(tx, name, i === 0 ? ids.youtubeChannelId : undefined));
  }

  let albumId: string | null = null;
  if (hint.album) {
    const [album] = await tx<{ id: string }[]>`
      select al.id from music.albums al
      join music.album_artists aa on aa.album_id = al.id and aa.position = 0
      where lower(al.title) = lower(${hint.album}) and aa.artist_id = ${artistIds[0]}
      limit 1
    `;
    albumId =
      album?.id ??
      (
        await tx<{ id: string }[]>`
          insert into music.albums (title, release_date) values (${hint.album}, ${hint.releaseDate ?? null}::date)
          returning id
        `
      )[0].id;
    if (!album) {
      await tx`insert into music.album_artists (album_id, artist_id, position) values (${albumId}, ${artistIds[0]}, 0)`;
    }
  }

  const coverImageId = hint.coverUrl ? await saveImageFromUrl(tx, hint.coverUrl, signal, { square: true }) : null;
  const [row] = await tx<{ id: string }[]>`
    insert into music.tracks (title, duration_ms, album_id, cover_image_id, metadata_source, youtube_video_id)
    values (
      ${hint.title}, ${hint.durationSec === undefined ? null : hint.durationSec * 1000}, ${albumId},
      ${coverImageId}, 'youtube', ${ids.youtubeVideoId}
    )
    returning id
  `;

  for (const [position, artistId] of artistIds.entries()) {
    const joinPhrase = position === artistIds.length - 1 ? "" : position === artistIds.length - 2 ? " & " : ", ";
    await tx`
      insert into music.track_artists (track_id, artist_id, position, join_phrase)
      values (${row.id}, ${artistId}, ${position}, ${joinPhrase})
    `;
  }
  return row.id;
}

export async function mergeTrack(tx: Tx, fromId: string, intoId: string) {
  if (fromId === intoId) return;
  await tx`
    insert into music.likes (track_id, liked_at, created_at)
    select ${intoId}, liked_at, created_at from music.likes where track_id = ${fromId}
    on conflict (track_id) do nothing
  `;
  await tx`
    insert into music.track_overrides (track_id, title, title_romanized, artist_credit, artist_credit_romanized, cover_image_id)
    select ${intoId}, title, title_romanized, artist_credit, artist_credit_romanized, cover_image_id
    from music.track_overrides where track_id = ${fromId}
    on conflict (track_id) do nothing
  `;
  await tx`update music.playlist_entries set track_id = ${intoId} where track_id = ${fromId}`;
  await tx`delete from music.tracks where id = ${fromId}`;
}
