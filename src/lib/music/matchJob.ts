import type { Job } from "@lib/jobs/job";
import { MINUTE } from "@lib/sources/source";
import { createYoutubeTrack, mergeTrack, NoMatchError, resolveTrack } from "./matching";
import { youtubeHint, type YoutubeRaw } from "./youtube";

const BUDGET_MS = 45_000;

interface Entry {
  id: string;
  media_id: string;
  track_id: string | null;
  raw: YoutubeRaw;
}

export const matchJob: Job = {
  name: "music:match",
  intervalMs: MINUTE,
  timeoutMs: BUDGET_MS + 15_000,
  isConfigured: () => true,
  run: async (tx, signal) => {
    const deadline = Date.now() + BUDGET_MS;
    const entries = await tx<Entry[]>`
      select e.id, e.media_id, e.track_id, e.raw
      from music.playlist_entries e
      left join music.tracks t on t.id = e.track_id
      where e.source = 'youtube' and e.match_source = 'auto' and e.removed_at is null
        and (e.track_id is null or t.metadata_source = 'youtube')
        and (e.next_match_at is null or e.next_match_at <= now())
      order by exists (select 1 from music.youtube_likes yl where yl.video_id = e.media_id) desc, e.added_at desc
      limit 100
    `;

    for (const entry of entries) {
      if (Date.now() > deadline || signal.aborted) break;
      const hint = youtubeHint(entry.raw);
      const ids = { youtubeVideoId: entry.media_id };

      try {
        await tx.savepoint(async (sp) => {
          if (!hint) throw new NoMatchError("Video is unavailable or has no metadata");
          const trackId = await resolveTrack(sp, hint, ids, signal);
          if (entry.track_id) await mergeTrack(sp, entry.track_id, trackId);
          await sp`
            update music.playlist_entries set track_id = ${trackId}, next_match_at = null, match_error = null
            where id = ${entry.id}
          `;
        });
        continue;
      } catch (error) {
        if (signal.aborted) break;
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
        if (!(error instanceof NoMatchError)) {
          await tx`
            update music.playlist_entries set next_match_at = now() + interval '1 hour', match_error = ${message}
            where id = ${entry.id}
          `;
          continue;
        }

        // Not on Deezer: keep YouTube's own metadata so the song can still be shown and liked,
        // and check Deezer again later
        try {
          await tx.savepoint(async (sp) => {
            const video = entry.raw.video;
            const youtubeChannelId = video?.snippet.channelTitle.endsWith(" - Topic")
              ? video.snippet.channelId
              : undefined;
            const trackId =
              entry.track_id ??
              (hint ? await createYoutubeTrack(sp, hint, { ...ids, youtubeChannelId }, signal) : null);
            await sp`
              update music.playlist_entries
              set track_id = ${trackId}, next_match_at = now() + ${trackId ? "30 days" : "7 days"}::interval,
                  match_error = ${message}
              where id = ${entry.id}
            `;
          });
        } catch (fallbackError) {
          if (signal.aborted) break;
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          await tx`
            update music.playlist_entries set next_match_at = now() + interval '1 hour', match_error = ${fallbackMessage.slice(0, 1000)}
            where id = ${entry.id}
          `;
        }
      }
    }
  },
};
