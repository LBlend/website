import type { Sql } from "./client";

// Never edit a migration that has shipped. Add a new one instead.
const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "0001_snapshots_and_job_runs",
    sql: `
      create table source_snapshots (
        id           bigserial primary key,
        source       text not null,
        fetched_at   timestamptz not null default now(),
        payload      jsonb not null,
        payload_hash text not null
      );
      create index source_snapshots_source_fetched_at_idx on source_snapshots (source, fetched_at desc);

      create table job_runs (
        id          bigserial primary key,
        job         text not null,
        started_at  timestamptz not null default now(),
        finished_at timestamptz not null default clock_timestamp(),
        ok          boolean not null,
        http_status integer,
        error       text
      );
      create index job_runs_job_started_at_idx on job_runs (job, started_at desc);
    `,
  },
  {
    name: "0002_images_and_music",
    sql: `
      create table images (
        id           bigserial primary key,
        sha256       text not null unique,
        content_type text not null,
        width        integer not null,
        height       integer not null,
        data         bytea not null,
        thumbnail_id bigint references images (id),
        source_url   text,
        created_at   timestamptz not null default now()
      );

      create schema music;

      create table music.artists (
        id                 bigserial primary key,
        name               text not null,
        name_romanized     text,
        musicbrainz_id     uuid unique,
        deezer_id          bigint unique,
        spotify_id         text unique,
        youtube_channel_id text unique
      );

      create table music.albums (
        id                     bigserial primary key,
        title                  text not null,
        title_romanized        text,
        release_date           date,
        cover_image_id         bigint references images (id),
        musicbrainz_release_id uuid unique,
        deezer_id              bigint unique,
        spotify_id             text unique,
        youtube_browse_id      text unique
      );

      create table music.album_artists (
        album_id    bigint not null references music.albums (id) on delete cascade,
        artist_id   bigint not null references music.artists (id),
        position    smallint not null,
        join_phrase text not null default '',
        primary key (album_id, position)
      );

      create table music.tracks (
        id                       bigserial primary key,
        title                    text not null,
        title_romanized          text,
        isrc                     text unique,
        duration_ms              integer,
        album_id                 bigint references music.albums (id),
        cover_image_id           bigint references images (id),
        metadata_source          text not null default 'deezer' check (metadata_source in ('deezer', 'youtube')),
        musicbrainz_recording_id uuid,
        deezer_id                bigint unique,
        spotify_id               text unique,
        youtube_video_id         text
      );

      create table music.track_artists (
        track_id    bigint not null references music.tracks (id) on delete cascade,
        artist_id   bigint not null references music.artists (id),
        position    smallint not null,
        join_phrase text not null default '',
        primary key (track_id, position)
      );

      create table music.playlist_entries (
        id                 bigserial primary key,
        source             text not null check (source in ('spotify', 'youtube')),
        playlist_id        text not null,
        item_id            text not null,
        media_id           text not null,
        track_id           bigint references music.tracks (id),
        match_source       text not null default 'auto' check (match_source in ('auto', 'manual')),
        next_match_at      timestamptz,
        match_error        text,
        added_at           timestamptz not null,
        removed_at         timestamptz,
        raw                jsonb not null,
        unique (source, playlist_id, item_id)
      );
      create index playlist_entries_track_id_idx on music.playlist_entries (track_id);

      create table music.provider_payloads (
        provider    text not null,
        external_id text not null,
        payload     jsonb not null,
        fetched_at  timestamptz not null default now(),
        primary key (provider, external_id)
      );

      create table music.track_overrides (
        track_id              bigint primary key references music.tracks (id) on delete cascade,
        title                 text,
        title_romanized       text,
        artist_credit         text,
        artist_credit_romanized text,
        cover_image_id        bigint references images (id)
      );

      -- Videos liked on YouTube (Music), replaced on every sync
      create table music.youtube_likes (
        video_id text primary key
      );

      -- Likes added by hand, and liked date overrides for songs liked on YouTube Music.
      -- Without a liked_at, the earliest playlist added date is used.
      create table music.likes (
        track_id   bigint primary key references music.tracks (id) on delete cascade,
        liked_at   timestamptz,
        created_at timestamptz not null default now()
      );

      create view music.display_tracks as
      with entries as (
        select track_id, min(added_at) as first_added_at, bool_or(removed_at is null) as in_playlist
        from music.playlist_entries
        where track_id is not null
        group by track_id
      ),
      credits as (
        select ta.track_id,
               string_agg(ar.name || ta.join_phrase, '' order by ta.position) as artist_credit,
               string_agg(coalesce(ar.name_romanized, ar.name) || ta.join_phrase, '' order by ta.position)
                 as artist_credit_romanized
        from music.track_artists ta
        join music.artists ar on ar.id = ta.artist_id
        group by ta.track_id
      ),
      youtube_liked as (
        select distinct e.track_id
        from music.playlist_entries e
        join music.youtube_likes yl on yl.video_id = e.media_id
        where e.source = 'youtube' and e.track_id is not null
      )
      select t.id,
             coalesce(o.title, t.title)                                         as title,
             coalesce(o.title_romanized, t.title_romanized)                     as title_romanized,
             coalesce(o.artist_credit, c.artist_credit)                         as artist_credit,
             coalesce(o.artist_credit_romanized, c.artist_credit_romanized)     as artist_credit_romanized,
             al.title                                                           as album_title,
             e.first_added_at                                                   as added_at,
             e.in_playlist,
             l.track_id is not null or yl.track_id is not null                  as liked,
             case when l.track_id is not null or yl.track_id is not null
               then coalesce(l.liked_at, e.first_added_at) end                  as liked_at,
             coalesce(o.cover_image_id, t.cover_image_id, al.cover_image_id)    as cover_image_id,
             t.metadata_source,
             t.youtube_video_id,
             t.spotify_id
      from music.tracks t
      join entries e on e.track_id = t.id
      left join music.albums al on al.id = t.album_id
      left join credits c on c.track_id = t.id
      left join music.track_overrides o on o.track_id = t.id
      left join music.likes l on l.track_id = t.id
      left join youtube_liked yl on yl.track_id = t.id;
    `,
  },
];

export async function migrate(sql: Sql) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('furumo-website:migrations'))`;
    await tx`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `;
    const applied = new Set((await tx<{ name: string }[]>`select name from schema_migrations`).map((row) => row.name));

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.name)) continue;
      await tx.unsafe(migration.sql).simple();
      await tx`insert into schema_migrations (name) values (${migration.name})`;
      console.log(`[db] applied migration ${migration.name}`);
    }
  });
}
