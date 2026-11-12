import { SCHEDULER_ENABLED } from "astro:env/server";
import { getDb, type Sql } from "@lib/db/client";
import { migrate } from "@lib/db/migrations";
import { HttpError, MINUTE } from "@lib/sources/source";
import { jobs } from "./index";
import type { Job } from "./job";

const TICK_MS = MINUTE;
const RETRY_MS = 5 * MINUTE;
const TIMEOUT_MS = 15 * 1000;

const g = globalThis as { __furumoScheduler?: boolean };
let ticking = false;

export function startScheduler() {
  if (g.__furumoScheduler) return;
  const sql = getDb();
  if (!sql || !(SCHEDULER_ENABLED ?? import.meta.env.PROD)) return;
  g.__furumoScheduler = true;

  void (async () => {
    try {
      await migrate(sql);
    } catch (error) {
      console.error("[scheduler] migration failed, will retry on next request", error);
      g.__furumoScheduler = false;
      return;
    }
    console.log(`[scheduler] started with ${jobs.filter((job) => job.isConfigured()).length} jobs`);
    void tick(sql);
    setInterval(() => void tick(sql), TICK_MS).unref();
  })();
}

async function tick(sql: Sql) {
  if (ticking) return;
  ticking = true;
  try {
    // Sequential, so the scheduler never holds more than one pooled connection
    for (const job of jobs) {
      if (!job.isConfigured()) continue;
      try {
        await runIfDue(sql, job);
      } catch (error) {
        console.error(`[scheduler] ${job.name} failed`, error);
      }
    }
  } finally {
    ticking = false;
  }
}

async function runIfDue(sql: Sql, job: Job) {
  await sql.begin(async (tx) => {
    // Lets overlapping containers during a deploy skip a job the other one is running
    const [{ locked }] = await tx<{ locked: boolean }[]>`
      select pg_try_advisory_xact_lock(hashtext(${`furumo-website:job:${job.name}`})) as locked
    `;
    if (!locked) return;

    const [{ fresh, retrying }] = await tx<{ fresh: boolean; retrying: boolean }[]>`
      select
        coalesce(bool_or(ok and started_at > now() - ${job.intervalMs - TICK_MS / 2}::float8 * interval '1 millisecond'), false) as fresh,
        coalesce(bool_or(started_at > now() - ${RETRY_MS}::float8 * interval '1 millisecond'), false) as retrying
      from job_runs
      where job = ${job.name}
        and started_at > now() - ${Math.max(job.intervalMs, RETRY_MS)}::float8 * interval '1 millisecond'
    `;
    if (fresh || retrying) return;

    try {
      await tx.savepoint((sp) => job.run(sp, AbortSignal.timeout(TIMEOUT_MS)));
      await tx`insert into job_runs (job, ok) values (${job.name}, true)`;
    } catch (error) {
      const status = error instanceof HttpError ? error.status : null;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[scheduler] ${job.name} failed: ${message}`);
      await tx`
        insert into job_runs (job, ok, http_status, error)
        values (${job.name}, false, ${status}, ${message.slice(0, 1000)})
      `;
    }
  });
}
