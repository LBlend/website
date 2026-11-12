import { getDb } from "@lib/db/client";
import sources from "@lib/sources";
import type { SnapshotSource } from "@lib/sources/source";

type Sources = typeof sources;
export type StatName = keyof Sources;
export type Stats = { [K in StatName]: Sources[K]["fallback"] };

async function getLatestPayloads(names: string[]): Promise<Map<string, unknown>> {
  const sql = getDb();
  if (!sql) return new Map();
  try {
    const rows = await sql<{ source: string; payload: unknown }[]>`
      select distinct on (source) source, payload
      from source_snapshots
      where source = any(${names})
      order by source, fetched_at desc
    `;
    return new Map(rows.map((row) => [row.source, row.payload]));
  } catch (error) {
    console.warn("[stats] failed to read snapshots", error);
    return new Map();
  }
}

function deriveOrFallback(source: SnapshotSource, payload: unknown): unknown {
  if (payload === undefined) return source.fallback;
  try {
    return source.derive(payload);
  } catch (error) {
    console.warn(`[stats] failed to derive ${source.name}`, error);
    return source.fallback;
  }
}

export async function getStats(): Promise<Stats> {
  const payloads = await getLatestPayloads(Object.values(sources).map((source) => source.name));
  return Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, deriveOrFallback(source, payloads.get(source.name))]),
  ) as Stats;
}

export function isStatName(name: string): name is StatName {
  return Object.hasOwn(sources, name);
}
