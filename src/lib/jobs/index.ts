import { matchJob } from "@lib/music/matchJob";
import { youtubeSyncJob } from "@lib/music/youtube";
import sources from "@lib/sources";
import type { Job } from "./job";
import { snapshotJob } from "./snapshot";

export const jobs: Job[] = [...Object.values(sources).map(snapshotJob), youtubeSyncJob, matchJob];
