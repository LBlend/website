import sources from "@lib/sources";
import type { Job } from "./job";
import { snapshotJob } from "./snapshot";

export const jobs: Job[] = Object.values(sources).map(snapshotJob);
