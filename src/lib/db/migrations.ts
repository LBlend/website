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
